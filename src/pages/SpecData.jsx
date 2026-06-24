import { useMemo, useState, useRef, useCallback, useEffect, forwardRef } from "react";
import AnimatedActionButton from "../components/AnimatedActionButton.jsx";
import { OperationStatus } from "../components/OperationStatus.jsx";
import { withMinimumDelay } from "../utils/actionTiming.js";
import { pocEndPoints } from "../axios/endPoints.js";
import { getUserInfo } from "../utils/cookieUtils.js";
import { APIcallGet, APIcallPost, APIcallPostFile } from "../axios/apiCall.js";
import * as XLSX from "xlsx";
import { useI18n } from "../i18n.jsx";
import { isStaticDataMode } from "../utils/staticDataMode.js";
import {
  specDataColumns as staticSpecDataColumns,
  specFilterDataAndTableData,
} from "./static-data/SpecData.js";
import { List } from "react-window";
import {
  savePreviewRows,
  getAllPreviewRows,
  updatePreviewRow,
  deletePreviewRow,
  clearPreviewRows,
} from "../utils/previewDb.js";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function buildExcelToJsonKeyMap(columnDefs) {
  const list = Array.isArray(columnDefs)
    ? columnDefs
    : Array.isArray(columnDefs?.data)
      ? columnDefs.data
      : [];
  return list.reduce((acc, col) => {
    if (col.excelColumnName && col.jsonKey) {
      acc[col.excelColumnName.trim()] = col.jsonKey;
    }
    return acc;
  }, {});
}

function remapRowKeys(row, excelToJsonKey, validKeys = null) {
  return Object.entries(row).reduce((acc, [key, value]) => {
    const trimmedKey = key.trim();
    const mappedKey = excelToJsonKey[trimmedKey] ?? trimmedKey;
    if (
      !validKeys ||
      validKeys.has(trimmedKey.toLowerCase()) ||
      validKeys.has(mappedKey.toLowerCase()) ||
      mappedKey === "id"
    ) {
      acc[mappedKey] = value;
    }
    return acc;
  }, {});
}

function normalizeDuplicateValue(value, key = "") {
  if (value == null) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}${month}${day}`;
  }

  let str = String(value).trim();
  if (key.toLowerCase().includes("date") || key === "workedon") {
    str = str.split(/[T ]/)[0];

    // Check if it's in DD-MM-YYYY format or similar
    const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (dmyMatch) {
      const day = dmyMatch[1].padStart(2, "0");
      const month = dmyMatch[2].padStart(2, "0");
      const year = dmyMatch[3];
      return `${year}${month}${day}`;
    }

    // Check if it's in YYYY-MM-DD format
    const ymdMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (ymdMatch) {
      const year = ymdMatch[1];
      const month = ymdMatch[2].padStart(2, "0");
      const day = ymdMatch[3].padStart(2, "0");
      return `${year}${month}${day}`;
    }

    // Try to parse using Javascript Date
    const parsedDate = new Date(str);
    if (!isNaN(parsedDate.getTime())) {
      const year = parsedDate.getFullYear();
      const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
      const day = String(parsedDate.getDate()).padStart(2, "0");
      return `${year}${month}${day}`;
    }

    return str.replace(/[-/.]/g, "").toLowerCase();
  }

  return str.toLowerCase();
}

function buildDuplicateKey(row, excelToJsonKey, columns) {
  const remapped = remapRowKeys(row ?? {}, excelToJsonKey);
  const normalized = columns.reduce((acc, key) => {
    acc[key] = normalizeDuplicateValue(remapped[key], key);
    return acc;
  }, {});
  return JSON.stringify(normalized);
}

// Stable composite key — immune to duplicate `id` values in test/real data.
function rowKey(row, index) {
  return `${index}__${row.id ?? ""}__${row.equipmentCode ?? row.설비코드 ?? ""}__${row.specName ?? row.사양항목 ?? ""}`;
}

function getMissingMandatoryFields(row, columns, columnDefs) {
  const list = Array.isArray(columnDefs)
    ? columnDefs
    : Array.isArray(columnDefs?.data)
      ? columnDefs.data
      : [];

  const missing = [];
  list.forEach((col) => {
    if (col.isMandatory) {
      const excelName = col.excelColumnName?.trim().toLowerCase();
      const jsonKey = col.jsonKey?.trim().toLowerCase();
      const krName = col.columnNameKr?.trim().toLowerCase();

      const matchedKey = Object.keys(row).find((k) => {
        const lk = k.trim().toLowerCase();
        return lk === excelName || lk === jsonKey || lk === krName;
      });

      const val = matchedKey !== undefined ? row[matchedKey] : undefined;
      if (val === undefined || val === null || String(val).trim() === "") {
        missing.push(col.excelColumnName || col.columnNameKr || col.jsonKey);
      }
    }
  });
  return missing;
}

// ─────────────────────────────────────────────────────────────────────────────
// SelectSkeleton — prevents white-flash while dropdown options are loading
// ─────────────────────────────────────────────────────────────────────────────
function SelectSkeleton({ width = "100%" }) {
  return (
    <div
      style={{
        width: width,
        height: "38px",
        borderRadius: "6px",
        background: "linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.4s infinite",
        border: "1px solid var(--color-border-base, #e5e7eb)",
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TableSkeleton
// ─────────────────────────────────────────────────────────────────────────────
function TableSkeleton({ rowsCount = 8, columns = [], t, COLUMN_LABEL_KEYS = {} }) {
  return (
    <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 39vh)" }}>
      <table className="min-w-full text-left text-sm">
        <thead className="table-header">
          <tr>
            {columns.map((col) => (
              <th key={col} className="px-4 py-3 text-text-subtle whitespace-nowrap">
                {t(COLUMN_LABEL_KEYS[col] ?? `field.${col}`, col)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {Array.from({ length: rowsCount }).map((_, rIdx) => (
            <tr key={rIdx} className="border-t border-border-base">
              {columns.map((col, cIdx) => (
                <td key={cIdx} className="px-4 py-3">
                  <div
                    className="h-4 bg-gray-100 rounded animate-pulse"
                    style={{
                      width: `${50 + ((rIdx * col.length * 3) % 40)}%`,
                    }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EditableCell
// ─────────────────────────────────────────────────────────────────────────────
function EditableCell({ value, isEditing, col, onChange, duplicate = false, isEmptyMandatory = false }) {
  const { t } = useI18n();
  const inputRef = useRef(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  if (!isEditing) {
    return (
      <span
        style={{
          display: "block",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: "220px",
          color: duplicate || isEmptyMandatory
            ? "#dc2626"
            : value == null || value === ""
              ? "var(--color-text-subtle, #9ca3af)"
              : "var(--color-text-default, #111827)",
          fontWeight: duplicate || isEmptyMandatory ? 700 : undefined,
        }}
        title={String(value ?? "")}
      >
        {value == null || value === ""
          ? (isEmptyMandatory ? t("preview.required", "Required") : "-")
          : String(value)}
      </span>
    );
  }

  return (
    <input
      ref={inputRef}
      style={{
        width: "100%",
        minWidth: "80px",
        padding: "4px 8px",
        fontSize: "12px",
        border: "1.5px solid #2563eb",
        borderRadius: "4px",
        background: "#fff",
        color: "#111",
        outline: "none",
        boxSizing: "border-box",
      }}
      value={value ?? ""}
      onChange={(e) => onChange(col, e.target.value)}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EditableModalRow — inside the upload preview modal
// ─────────────────────────────────────────────────────────────────────────────
function EditableModalRow({
  index,
  style,
  rows,
  columns,
  columnDefs,
  editingCell,
  onStartEdit,
  onSave,
  onCancel,
  isDuplicateRow,
  onDelete,
}) {
  const row = rows[index];
  if (!row) return null;
  const isDuplicate = isDuplicateRow(row);
  const isEditingAnyCell = editingCell && editingCell.rowIndex === index;
  const isCellEditing = useCallback(
    (col) => editingCell && editingCell.rowIndex === index && editingCell.colKey === col,
    [editingCell, index]
  );
  const [draft, setDraft] = useState({});
  const rowRef = useRef(null);

  const handleStartEdit = (col) => {
    setDraft({ ...row });
    onStartEdit(index, col);
  };

  const handleDraftChange = useCallback((col, value) => {
    setDraft((prev) => ({ ...prev, [col]: value }));
  }, []);

  const isMandatoryField = useCallback((colKey) => {
    if (!columnDefs) return false;
    const keyLower = colKey.trim().toLowerCase();
    const colDef = columnDefs.find(c =>
      c.excelColumnName?.trim().toLowerCase() === keyLower ||
      c.jsonKey?.trim().toLowerCase() === keyLower ||
      c.columnNameKr?.trim().toLowerCase() === keyLower
    );
    return colDef?.isMandatory === true;
  }, [columnDefs]);

  const handleSave = useCallback(
    (e) => {
      e?.stopPropagation();
      onSave(index, { ...row, ...draft });
    },
    [index, draft, row, onSave],
  );

  const handleCancel = (e) => {
    e?.stopPropagation();
    setDraft({});
    onCancel();
  };

  useEffect(() => {
    if (!isEditingAnyCell) return;
    const handler = (e) => {
      if (rowRef.current && rowRef.current.contains(e.target)) return;
      const clickedRow = e.target.closest(".table-row");
      const insideModal = e.target.closest(".fixed");
      if (insideModal && !clickedRow) {
        return;
      }
      handleSave();
    };
    const t = setTimeout(() => document.addEventListener("mousedown", handler), 80);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", handler);
    };
  }, [isEditingAnyCell, handleSave]);

  useEffect(() => {
    if (!isEditingAnyCell) return;
    const handler = (e) => {
      if (e.key === "Enter") handleSave(e);
      if (e.key === "Escape") handleCancel(e);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isEditingAnyCell, handleSave]);

  const totalWidth = 60 + 80 + columns.length * 180;

  const hasMissingMandatory = useMemo(() => {
    return columns.some((col) => {
      const val = row[col];
      return isMandatoryField(col) && (val === undefined || val === null || String(val).trim() === "");
    });
  }, [row, columns, isMandatoryField]);

  return (
    <div
      ref={rowRef}
      className="table-row"
      style={{
        ...style,
        zIndex: isEditingAnyCell ? 10 : 1,
        width: totalWidth,
        display: "flex",
        alignItems: "center",
        borderBottom: "1px solid var(--color-border-base, #e5e7eb)",
        background: isEditingAnyCell
          ? "#eff6ff"
          : isDuplicate
            ? "#fff1f2"
          : hasMissingMandatory
            ? "#fff7ed"
          : index % 2 === 0
            ? "var(--color-surface-default, #fff)"
            : "var(--color-surface-raised, #f9fafb)",
        outline: isEditingAnyCell ? "2px solid #2563eb" : "none",
        outlineOffset: "-1px",
        transition: "background 0.1s",
        cursor: isEditingAnyCell ? "default" : "pointer",
        boxSizing: "border-box",
      }}
    >
      <div
        className="px-4 py-2.5 text-xs tabular-nums"
        style={{
          color: "var(--color-text-subtle, #9ca3af)",
          whiteSpace: "nowrap",
          userSelect: "none",
          width: "60px",
          flexShrink: 0,
          boxSizing: "border-box",
        }}
      >
        <span style={{ color: isDuplicate ? "#dc2626" : "inherit", fontWeight: isDuplicate ? 700 : undefined }}>
          {(row._originalIndex ?? index) + 1}
        </span>
      </div>

      <div
        className="px-3 py-2"
        style={{
          whiteSpace: "nowrap",
          width: "80px",
          flexShrink: 0,
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
        }}
      >
        {!isEditingAnyCell && onDelete && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.(index);
            }}
            title={isDuplicate ? "Delete duplicate" : "Delete row"}
            className={`inline-flex h-[26px] w-[26px] items-center justify-center rounded-md border-0 transition-transform hover:scale-110 ${
              isDuplicate ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-500"
            }`}
          >
            <i className="fas fa-trash-alt" style={{ fontSize: "10px" }} />
          </button>
        )}
      </div>

      {columns.map((col) => {
        const editing = isCellEditing(col);
        const val = editing ? draft[col] : row[col];
        const isEmptyMandatory = isMandatoryField(col) && (val === undefined || val === null || String(val).trim() === "");
        return (
          <div
            key={col}
            onDoubleClick={(e) => {
              if (editing) return;
              e.stopPropagation();
              handleStartEdit(col);
            }}
            style={{
              padding: editing ? "4px 6px" : "8px 16px",
              width: "180px",
              flexShrink: 0,
              whiteSpace: "nowrap",
              overflow: editing ? "visible" : "hidden",
              textOverflow: "ellipsis",
              boxSizing: "border-box",
              background: isEmptyMandatory ? "#fef2f2" : undefined,
              border: isEmptyMandatory ? "1px solid #f87171" : undefined,
              position: "relative",
            }}
          >
            <EditableCell
              value={val}
              isEditing={editing}
              col={col}
              onChange={handleDraftChange}
              duplicate={isDuplicate}
              isEmptyMandatory={isEmptyMandatory}
            />
            {editing && (
              <div
                style={{
                  position: "absolute",
                  right: "6px",
                  top: "100%",
                  marginTop: "4px",
                  display: "flex",
                  gap: "4px",
                  zIndex: 40,
                  background: "#fff",
                  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                  border: "1px solid #e2e8f0",
                  borderRadius: "6px",
                  padding: "4px",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={handleSave}
                  title="저장 (Enter)"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "22px",
                    height: "22px",
                    borderRadius: "4px",
                    border: "none",
                    background: "#16a34a",
                    color: "#fff",
                    cursor: "pointer",
                  }}
                >
                  <i className="fas fa-check" style={{ fontSize: "9px" }} />
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  title="취소 (Esc)"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "22px",
                    height: "22px",
                    borderRadius: "4px",
                    border: "none",
                    background: "#e5e7eb",
                    color: "#6b7280",
                    cursor: "pointer",
                  }}
                >
                  <i className="fas fa-times" style={{ fontSize: "9px" }} />
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// UploadPreviewModal
// ─────────────────────────────────────────────────────────────────────────────
export function UploadPreviewModal({
  rows: initialRows,
  columns,
  duplicateRowKeys = new Set(),
  getDuplicateKey,
  onClose,
  onConfirm,
  columnDefs = [],
}) {
  const { t } = useI18n();
  const [rows, setRows] = useState([]);
  const [editingCell, setEditingCell] = useState(null);
  const [filterType, setFilterType] = useState("all"); // "all" | "duplicate" | "missing"
  const headerRef = useRef(null);

  // Synchronize initialRows with IndexedDB
  useEffect(() => {
    if (initialRows && initialRows.length > 0) {
      const rowsWithIndex = initialRows.map((row, idx) => ({
        ...row,
        _originalIndex: idx,
      }));
      savePreviewRows(rowsWithIndex, "spec_preview_rows")
        .then(() => {
          setRows(rowsWithIndex);
        })
        .catch(console.error);
    } else {
      clearPreviewRows("spec_preview_rows")
        .then(() => {
          setRows([]);
        })
        .catch(console.error);
    }
    setEditingCell(null);
    setFilterType("all");
  }, [initialRows]);

  // Cleanup preview rows on unmount
  useEffect(() => {
    return () => {
      clearPreviewRows("spec_preview_rows").catch(console.error);
    };
  }, []);

  const detectedColumns = columns?.length ? columns : rows.length > 0 ? Object.keys(rows[0]) : [];

  const previewKeysCount = useMemo(() => {
    const counts = {};
    if (!getDuplicateKey) return counts;
    rows.forEach((row) => {
      const key = getDuplicateKey(row);
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [rows, getDuplicateKey]);

  const isDuplicateRow = useCallback(
    (row) => {
      if (!getDuplicateKey) return false;
      const key = getDuplicateKey(row);
      
      try {
        const parsedKey = JSON.parse(key);
        const isEmptyRow = Object.values(parsedKey).every(v => v === undefined || v === null || String(v).trim() === "");
        if (isEmptyRow) return false;
      } catch (e) {
        // Safe fallback
      }

      if (duplicateRowKeys.has(key)) return true;
      if ((previewKeysCount[key] || 0) > 1) return true;
      return false;
    },
    [duplicateRowKeys, getDuplicateKey, previewKeysCount],
  );

  const duplicateCount = useMemo(
    () => rows.filter((row) => isDuplicateRow(row)).length,
    [rows, isDuplicateRow],
  );

  const getRowMissingMandatoryFields = useCallback((row) => {
    return getMissingMandatoryFields(row, detectedColumns, columnDefs);
  }, [detectedColumns, columnDefs]);

  const missingMandatoryCount = useMemo(() => {
    return rows.filter((row) => getRowMissingMandatoryFields(row).length > 0).length;
  }, [rows, getRowMissingMandatoryFields]);

  const filteredRows = useMemo(() => {
    if (filterType === "all") return rows;
    if (filterType === "duplicate") {
      return rows.filter((row) => isDuplicateRow(row));
    }
    if (filterType === "missing") {
      return rows.filter((row) => getRowMissingMandatoryFields(row).length > 0);
    }
    return rows;
  }, [rows, filterType, isDuplicateRow, getRowMissingMandatoryFields]);

  const handleSaveRow = useCallback((filteredIndex, payload) => {
    const originalIndex = payload._originalIndex;
    setRows((prev) => {
      const next = [...prev];
      const realIndex = next.findIndex(r => r._originalIndex === originalIndex);
      if (realIndex !== -1) {
        next[realIndex] = payload;
        updatePreviewRow(realIndex, payload, "spec_preview_rows").catch(console.error);
      }
      return next;
    });
    setEditingCell(null);
  }, []);

  const handleCancelEdit = useCallback(() => setEditingCell(null), []);

  const handleDeleteRow = useCallback((filteredIndex) => {
    const rowToDelete = filteredRows[filteredIndex];
    if (!rowToDelete) return;
    const originalIndex = rowToDelete._originalIndex;

    setRows((prev) => {
      const realIndex = prev.findIndex(r => r._originalIndex === originalIndex);
      if (realIndex === -1) return prev;

      const next = prev.filter((_, rowIndex) => rowIndex !== realIndex);
      deletePreviewRow(realIndex, prev.length, "spec_preview_rows").catch(console.error);

      const updatedNext = next.map((row, idx) => ({
        ...row,
        _originalIndex: idx,
      }));
      savePreviewRows(updatedNext, "spec_preview_rows").catch(console.error);

      return updatedNext;
    });
    setEditingCell(null);
  }, [filteredRows]);

  const handleRemoveDuplicates = useCallback(() => {
    setRows((prev) => {
      const filtered = prev.filter((row) => !isDuplicateRow(row));
      const updatedNext = filtered.map((row, idx) => ({
        ...row,
        _originalIndex: idx,
      }));
      savePreviewRows(updatedNext, "spec_preview_rows").catch(console.error);
      return updatedNext;
    });
    setEditingCell(null);
  }, [isDuplicateRow]);

  const handleConfirm = async () => {
    if (duplicateCount > 0) {
      alert(t("preview.duplicateWarning", "중복된 항목이 있습니다. 먼저 중복 항목을 제거한 후 저장해주세요."));
      return;
    }

    try {
      const currentRows = await getAllPreviewRows("spec_preview_rows");

      for (let i = 0; i < currentRows.length; i++) {
        const missingFields = getMissingMandatoryFields(currentRows[i], detectedColumns, columnDefs);
        if (missingFields.length > 0) {
          const fieldNames = missingFields.map(col => t(COLUMN_LABEL_KEYS[col] ?? `field.${col}`, col)).join(", ");
          alert(
            t(
              "preview.mandatoryFieldsRequired",
              "Row {rowNumber} has empty mandatory fields: {fields}"
            )
            .replace("{rowNumber}", i + 1)
            .replace("{fields}", fieldNames)
          );
          return;
        }
      }

      await clearPreviewRows("spec_preview_rows");
      onClose();
      window.setTimeout(() => onConfirm?.(currentRows), 0);
    } catch (error) {
      console.error("Failed to read confirmed rows from IndexedDB:", error);
      alert("Error saving data. Please try again.");
    }
  };

  const handleClose = () => {
    clearPreviewRows("spec_preview_rows").catch(console.error);
    onClose();
  };

  // Synchronize header scroll with virtual list horizontal scroll
  const handleScroll = useCallback((event) => {
    if (headerRef.current) {
      headerRef.current.scrollLeft = event.currentTarget.scrollLeft;
    }
  }, []);

  if (!initialRows) return null;

  const totalWidth = 60 + 80 + detectedColumns.length * 180;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)" }}
    >
      <div
        className="flex flex-col rounded-2xl shadow-2xl overflow-hidden"
        style={{
          background: "var(--color-surface-default, #fff)",
          border: "1px solid var(--color-border-base, #e5e7eb)",
          width: "min(95vw, 1200px)",
          maxHeight: "88vh",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 shrink-0 gap-4"
          style={{
            borderBottom: "1px solid var(--color-border-base, #e5e7eb)",
            background: "var(--color-surface-raised, #f9fafb)",
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg text-sm"
              style={{
                background: "var(--color-brand-10, #eff6ff)",
                color: "var(--color-brand-60, #2563eb)",
              }}
            >
              <i className="fas fa-table" />
            </div>
            <div>
              <h2
                className="text-base font-bold"
                style={{ color: "var(--color-text-default, #111827)" }}
              >
                {t("preview.title")}
              </h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--color-text-subtle, #6b7280)" }}>
                {t("preview.total")} <span className="font-semibold">{rows.length}{t("preview.row")}</span>
                {" · "}
                {detectedColumns.length}{t("preview.subtitle")}
                {duplicateCount > 0 && (
                  <span className="ml-2 font-bold text-red-600">
                    {duplicateCount} duplicates
                  </span>
                )}
                {missingMandatoryCount > 0 && (
                  <span className="ml-2 font-bold text-red-600">
                    {missingMandatoryCount}{t("preview.missingRequired")}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Filters Segmented Control */}
            <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs" style={{ border: "1px solid #e2e8f0" }}>
              <button
                type="button"
                onClick={() => setFilterType("all")}
                className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                  filterType === "all"
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {t("preview.filterAll", "전체")} ({rows.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterType("duplicate")}
                className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                  filterType === "duplicate"
                    ? "bg-white text-red-600 shadow-sm font-semibold"
                    : "text-slate-500 hover:text-red-600"
                }`}
              >
                {t("preview.filterDuplicate", "중복")} ({duplicateCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterType("missing")}
                className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                  filterType === "missing"
                    ? "bg-white text-orange-600 shadow-sm font-semibold"
                    : "text-slate-500 hover:text-orange-600"
                }`}
              >
                {t("preview.filterMissing", "필수 누락")} ({missingMandatoryCount})
              </button>
            </div>

            <button
              type="button"
              onClick={handleClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
              style={{ color: "var(--color-text-subtle, #6b7280)", background: "transparent" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "var(--color-fill-active, #f3f4f6)")
              }
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              aria-label={t("app.close")}
            >
              <i className="fas fa-times text-sm" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {rows.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center gap-3 py-16 text-center flex-1"
              style={{ color: "var(--color-text-subtle, #6b7280)" }}
            >
              <i className="fas fa-inbox text-4xl opacity-30" />
              <p className="text-sm">{t("preview.noData")}</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Table Header Row (Horizontal Scrolling Only) */}
              <div
                ref={headerRef}
                style={{
                  background: "var(--color-surface-raised, #f9fafb)",
                  borderBottom: "1px solid var(--color-border-base, #e5e7eb)",
                  display: "flex",
                  width: "100%",
                  overflowX: "hidden",
                  boxSizing: "border-box",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    width: totalWidth,
                    boxSizing: "border-box",
                  }}
                >
                  <div
                    className="px-4 py-3 text-xs font-semibold tracking-wide"
                    style={{
                      color: "var(--color-text-subtle, #6b7280)",
                      width: "60px",
                      flexShrink: 0,
                      boxSizing: "border-box",
                    }}
                  >
                    #
                  </div>
                  <div
                    className="px-3 py-3 text-xs font-semibold tracking-wide"
                    style={{
                      color: "var(--color-text-subtle, #6b7280)",
                      width: "80px",
                      flexShrink: 0,
                      boxSizing: "border-box",
                    }}
                  >
                    {t("preview.edit")}
                  </div>
                  {detectedColumns.map((col) => (
                    <div
                      key={col}
                      className="px-4 py-3 text-xs font-semibold tracking-wide"
                      style={{
                        color: "var(--color-text-subtle, #6b7280)",
                        width: "180px",
                        flexShrink: 0,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        boxSizing: "border-box",
                      }}
                    >
                      {t(COLUMN_LABEL_KEYS[col] ?? `field.${col}`, col)}
                    </div>
                  ))}
                </div>
              </div>

              {/* Table Body (Virtualized Scrolling) */}
              <div className="flex-1 overflow-hidden" style={{ position: "relative" }}>
                {filteredRows.length === 0 ? (
                  <div
                    className="flex flex-col items-center justify-center gap-3 py-16 text-center flex-1"
                    style={{ color: "var(--color-text-subtle, #6b7280)" }}
                  >
                    <i className="fas fa-search text-4xl opacity-30" />
                    <p className="text-sm">
                      {filterType === "duplicate"
                        ? t("preview.noDuplicates", "중복된 항목이 없습니다.")
                        : t("preview.noMissing", "누락된 필수 항목이 없습니다.")}
                    </p>
                  </div>
                ) : (
                  <List
                    style={{ height: 440, width: "100%", overflowX: "auto" }}
                    rowCount={filteredRows.length}
                    rowHeight={44}
                    onScroll={handleScroll}
                    rowComponent={EditableModalRow}
                    rowProps={{
                      rows: filteredRows,
                      columns: detectedColumns,
                      columnDefs,
                      editingCell,
                      onStartEdit: (rowIndex, colKey) => setEditingCell({ rowIndex, colKey }),
                      onSave: handleSaveRow,
                      onCancel: handleCancelEdit,
                      isDuplicateRow,
                      onDelete: handleDeleteRow,
                    }}
                  >
                    <div style={{ width: totalWidth, height: 1, pointerEvents: "none" }} />
                  </List>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between gap-3 px-6 py-4 shrink-0"
          style={{
            borderTop: "1px solid var(--color-border-base, #e5e7eb)",
            background: "var(--color-surface-raised, #f9fafb)",
          }}
        >
          <p className="text-xs" style={{ color: "var(--color-text-subtle, #6b7280)" }}>
            <i className="fas fa-info-circle mr-1" />
            {duplicateCount > 0
              ? "Duplicate rows are marked red. Delete them before saving if needed."
              : t("preview.tip")}
          </p>
          <div className="flex gap-3">
            {duplicateCount > 0 && (
              <button
                type="button"
                onClick={handleRemoveDuplicates}
                className="btn-base btn-secondary text-red-700"
              >
                <i className="fas fa-trash-alt mr-1.5" />
                Remove duplicates ({duplicateCount})
              </button>
            )}
            <button type="button" onClick={handleClose} className="btn-base btn-secondary">
              <i className="fas fa-times mr-1.5" />
              {t("app.cancel")}
            </button>
            {onConfirm && rows.length > 0 && (
              <button type="button" onClick={handleConfirm} className="btn-base btn-primary">
                <i className="fas fa-check mr-1.5" />
                {t("preview.saveCount").replace("{count}", rows.length)}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EditableRow — inline editable row in the main table
// ─────────────────────────────────────────────────────────────────────────────
function EditableRow({
  row,
  index,
  columns,
  isEditing,
  onStartEdit,
  onSave,
  onCancel,
  isSelected,
  onToggleSelect,
}) {
  const [draft, setDraft] = useState({});
  const rowRef = useRef(null);

  const handleStartEdit = (e) => {
    e.stopPropagation();
    setDraft({ ...row });
    onStartEdit(index);
  };

  const handleSave = useCallback(
    (e) => {
      e?.stopPropagation();
      onSave(index, draft);
    },
    [index, draft, onSave],
  );

  const handleCancel = (e) => {
    e?.stopPropagation();
    onCancel();
  };

  // Enter / Escape
  useEffect(() => {
    if (!isEditing) return;
    const handler = (e) => {
      if (e.key === "Enter") handleSave(e);
      if (e.key === "Escape") handleCancel(e);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isEditing, handleSave]);

  // Save on outside click
  useEffect(() => {
    if (!isEditing) return;
    const handleOutsideClick = (e) => {
      if (rowRef.current && !rowRef.current.contains(e.target)) handleSave();
    };
    const timer = setTimeout(() => document.addEventListener("mousedown", handleOutsideClick), 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isEditing, handleSave]);

  return (
    <tr
      ref={rowRef}
      style={{
        borderBottom: "1px solid var(--color-border-base, #e5e7eb)",
        background: isEditing
          ? "#eff6ff"
          : isSelected
            ? "rgba(79, 70, 229, 0.05)"
            : index % 2 === 0
              ? "var(--color-surface-default, #fff)"
              : "var(--color-surface-raised, #f9fafb)",
        outline: isEditing ? "2px solid #2563eb" : "none",
        outlineOffset: "-1px",
      }}
    >
      {/* Checkbox */}
      {/* <td className="px-4 py-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => {
            e.stopPropagation();
            onToggleSelect(index);
          }}
        />
      </td> */}

      {/* Edit controls */}
      {/* <td className="px-3 py-2" style={{ whiteSpace: "nowrap" }}>
        {isEditing ? (
          <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
            <button
              type="button"
              onClick={handleSave}
              title="저장 (Enter)"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "28px",
                height: "28px",
                borderRadius: "5px",
                border: "none",
                background: "#16a34a",
                color: "#fff",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              <i className="fas fa-check" style={{ fontSize: "11px" }} />
            </button>
            <button
              type="button"
              onClick={handleCancel}
              title="취소 (Esc)"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "28px",
                height: "28px",
                borderRadius: "5px",
                border: "none",
                background: "#e5e7eb",
                color: "#6b7280",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              <i className="fas fa-times" style={{ fontSize: "11px" }} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleStartEdit}
            title="행 편집"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "28px",
              height: "28px",
              borderRadius: "5px",
              border: "none",
              background: "var(--color-brand-10, #eff6ff)",
              color: "var(--color-brand-60, #2563eb)",
              cursor: "pointer",
            }}
          >
            <i className="fas fa-pencil-alt" style={{ fontSize: "11px" }} />
          </button>
        )}
      </td> */}

      {columns.map((col) =>
        isEditing ? (
          <td key={col} style={{ padding: "4px 6px", minWidth: "100px" }}>
            <input
              style={{
                width: "100%",
                minWidth: "80px",
                padding: "5px 8px",
                fontSize: "12px",
                border: "1.5px solid #2563eb",
                borderRadius: "4px",
                background: "#fff",
                color: "#111",
                outline: "none",
              }}
              value={draft[col] ?? ""}
              onChange={(e) => setDraft((prev) => ({ ...prev, [col]: e.target.value }))}
              onClick={(e) => e.stopPropagation()}
            />
          </td>
        ) : (
          <td
            key={col}
            className="px-4 py-3 text-text-subtle whitespace-nowrap"
            style={{ maxWidth: "240px", overflow: "hidden", textOverflow: "ellipsis" }}
            title={String(row[col] ?? "")}
          >
            {row[col] == null || row[col] === "" ? "—" : String(row[col])}
          </td>
        ),
      )}
    </tr>
  );
}

const COLUMN_LABEL_KEYS = {
  process: "field.process",
  maintGroup: "field.maintenanceType",
  site: "field.site",
  representativeWork: "field.repWork",
  priority: "field.priority",
  category: "field.category",
  period: "field.period",
  work: "field.work",
  report: "field.report",
  equipmentCode: "field.equipmentCode",
  equipmentName: "field.equipmentName",
  situation: "field.situation",
  cause: "field.cause",
  bom: "field.bom",
  sparePart: "field.sparePart",
  hwBefore: "field.hwBefore",
  hwAfter: "field.hwAfter",
  swBefore: "field.swBefore",
  swAfter: "field.swAfter",
  woCode: "field.woCode",
  workedOn: "field.workedOn",
  type: "field.type",
  title: "field.title",
  author: "field.author",
  date: "field.date",
  role: "field.role",
  management: "field.management",
  maintId: "field.maintenance",
  maintGroupName: "field.maintenanceType",
  processName: "field.process",
  siteName: "field.site",
  representativeWorkName: "field.repWork",
  priorityName: "field.priority",
  categoryName: "field.category",
  version: "field.version",
  specName: "field.specName",
  사양항목: "field.specName",
};

// ─────────────────────────────────────────────────────────────────────────────
// Main SpecData component
// ─────────────────────────────────────────────────────────────────────────────
function RowEditModal({ row, index, columns, onSave, onClose }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(() => ({ ...(row ?? {}) }));
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setDraft({ ...(row ?? {}) });
    setErrors({});
  }, [row]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!row) return null;

  const longTextFields = new Set(["specName", "specValue", "report", "bom", "work"]);

  const isColRequired = (colName) => {
    const requiredGroups = {
      site: ["site", "Site", "법인"],
      process: ["process", "Process", "공정"],
      maintGroup: [
        "maintGroup",
        "Maintenance Part",
        "보전파트",
        "보전그룹",
        "maintGroupName",
        "보전파트명",
      ],
      specName: ["specName", "SpecName", "사양항목", "사양명"],
    };
    const trimmed = colName.trim().toLowerCase();
    return Object.values(requiredGroups).some((aliases) =>
      aliases.some((a) => a.toLowerCase() === trimmed),
    );
  };

  const handleFieldChange = (col, val) => {
    setDraft((prev) => ({ ...prev, [col]: val }));
    if (errors[col]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[col];
        return next;
      });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const nextErrors = {};
    columns.forEach((col) => {
      if (isColRequired(col)) {
        const val = draft[col];
        if (val === undefined || val === null || String(val).trim() === "") {
          nextErrors[col] = t("page.mp.requiredFieldError", "This field is required.");
        }
      }
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }
    onSave(index, draft);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(17, 24, 39, 0.55)", backdropFilter: "blur(3px)" }}
      onMouseDown={onClose}
    >
      <form
        className="flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl shadow-2xl"
        style={{
          maxHeight: "88vh",
          background: "var(--color-surface-default, #fff)",
          border: "1px solid var(--color-border-base, #e5e7eb)",
        }}
        onSubmit={handleSubmit}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-start justify-between gap-4 px-6 py-5"
          style={{
            background: "linear-gradient(90deg, #eef2ff 0%, #ecfeff 100%)",
            borderBottom: "1px solid var(--color-border-base, #e5e7eb)",
          }}
        >
          <div>
            <h2 className="text-xl font-extrabold text-text-default">
              <i className="fas fa-pen-to-square mr-2 text-brand-60" />
              {t("app.edit")} {t("page.specData.title")}
            </h2>
            <p className="mt-1 text-sm text-text-subtle">
              {t("preview.total")} <span className="font-semibold">#{index + 1}</span>
            </p>
          </div>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-text-subtle"
            onClick={onClose}
            aria-label={t("app.close")}
          >
            <i className="fas fa-times" />
          </button>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-4 overflow-auto p-6 md:grid-cols-2">
          {columns.map((col) => {
            const label = t(COLUMN_LABEL_KEYS[col] ?? `field.${col}`, col);
            const value = draft[col] ?? "";
            const useTextarea = longTextFields.has(col) || String(value).length > 80;
            const required = isColRequired(col);
            const hasError = !!errors[col];

            return (
              <label key={col} className={useTextarea ? "md:col-span-2" : ""}>
                <span className="mb-2 block text-xs font-bold uppercase text-text-subtle">
                  {label}
                  {required && <span className="text-red-500"> *</span>}
                </span>
                {useTextarea ? (
                  <textarea
                    className="input-base"
                    rows={3}
                    value={value}
                    onChange={(e) => handleFieldChange(col, e.target.value)}
                    style={{
                      width: "100%",
                      resize: "vertical",
                      borderColor: hasError ? "var(--color-text-danger, #dc2626)" : undefined,
                      borderWidth: hasError ? "1.5px" : undefined,
                    }}
                  />
                ) : (
                  <input
                    className="input-base"
                    value={value}
                    onChange={(e) => handleFieldChange(col, e.target.value)}
                    style={{
                      width: "100%",
                      borderColor: hasError ? "var(--color-text-danger, #dc2626)" : undefined,
                      borderWidth: hasError ? "1.5px" : undefined,
                    }}
                  />
                )}
                {hasError && (
                  <span className="mt-1 block text-[11px] font-semibold text-red-500 animate-fade-in">
                    <i className="fas fa-exclamation-circle mr-1" />
                    {errors[col]}
                  </span>
                )}
              </label>
            );
          })}
        </div>

        <div
          className="flex justify-end gap-3 px-6 py-4"
          style={{
            background: "var(--color-surface-raised, #f9fafb)",
            borderTop: "1px solid var(--color-border-base, #e5e7eb)",
          }}
        >
          <button type="button" className="btn-base btn-ghost" onClick={onClose}>
            {t("app.cancel")}
          </button>
          <button type="submit" className="btn-base btn-primary">
            <i className="fas fa-check mr-2" />
            {t("app.save")}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function SpecData({ data, onUpload, onExport, searchText }) {
  const { t } = useI18n();
  // null = "전체" (no filter applied); a number = selected id
  const [selectedProcessId, setSelectedProcessId] = useState(null);
  const [selectedMaintenanceId, setSelectedMaintenanceId] = useState(null);

  const fileInput = useRef(null);

  const [changeDataColumns, setChangeDataColumns] = useState([]);
  // null means still loading; object means loaded (may have empty arrays)
  const [filterPayload, setFilterPayload] = useState(null);
  const [filterError, setFilterError] = useState(null);
  const [changedRecords, setChangedRecords] = useState([]);
  const [apiRecords, setApiRecords] = useState([]);

  // FIX 1: specDataId now has TWO sources:
  //   - columnDefsId: the `id` from the CHANGE_DATA_COLUMNS response root (initially 0)
  //   - specDataJsonId: the `id` captured from GET_SPEC_DATA specDataJson items
  // The POST payload uses specDataId which is resolved from these in priority order:
  //   specDataJsonId (if > 0) → columnDefsId (if > 0) → 0
  const [columnDefsId, setColumnDefsId] = useState(0);
  const [specDataJsonId, setSpecDataJsonId] = useState(0);

  // Derived: the id to use when POSTing — prefer the specDataJson id if available
  const specDataId = specDataJsonId > 0 ? specDataJsonId : columnDefsId;

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [editingIndex, setEditingIndex] = useState(null);
  const [previewRows, setPreviewRows] = useState(null);
  const [previewColumns, setPreviewColumns] = useState(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importFileName, setImportFileName] = useState("");
  const [exportBusy, setExportBusy] = useState(false);
  const [operationStatus, setOperationStatus] = useState({
    isVisible: false,
    status: "loading",
    message: "",
    autoClose: true,
  });

  // Show skeleton while filterPayload hasn't arrived yet
  const filterLoading = filterPayload === null && filterError === null;

  const [isFiltering, setIsFiltering] = useState(false);
  const [prevFilters, setPrevFilters] = useState({
    processId: null,
    maintenanceId: null,
    searchText: "",
  });

  if (
    selectedProcessId !== prevFilters.processId ||
    selectedMaintenanceId !== prevFilters.maintenanceId ||
    searchText !== prevFilters.searchText
  ) {
    setPrevFilters({
      processId: selectedProcessId,
      maintenanceId: selectedMaintenanceId,
      searchText,
    });
    if (selectedProcessId !== null) {
      setIsFiltering(true);
    }
  }

  useEffect(() => {
    if (isFiltering) {
      const timer = setTimeout(() => {
        setIsFiltering(false);
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [isFiltering]);

  // ── Process list (flat) ───────────────────────────────────────────────────
  const processList = useMemo(() => {
    return (filterPayload?.process ?? []).filter((p) => p.isSpecData === true);
  }, [filterPayload]);

  // ── Maintenance list — cascade-filtered by selected process ───────────────
  const maintenanceList = useMemo(() => {
    const all = (filterPayload?.maintenance ?? []).filter((m) => m.isSpecData === true);
    if (!selectedProcessId) return all;
    return all.filter((m) => m.processId === selectedProcessId);
  }, [filterPayload, selectedProcessId]);

  // ── Process change → reset maintenance selection ──────────────────────────
  const handleProcessChange = (e) => {
    const val = e.target.value;
    setSelectedProcessId(val === "" ? null : Number(val));
    setSelectedMaintenanceId(null);
  };

  const handleMaintenanceChange = (e) => {
    const val = e.target.value;
    setSelectedMaintenanceId(val === "" ? null : Number(val));
  };

  // ── excelColumnName → jsonKey map ─────────────────────────────────────────
  const excelToJsonKey = useMemo(
    () => buildExcelToJsonKeyMap(changeDataColumns),
    [changeDataColumns],
  );

  // ── Helper to sort keys by mockup order ───────────────────────────────────
  const getColumnGroupIndex = useCallback((key) => {
    const groups = [
      ["process", "공정"],
      ["maintGroup", "maintType", "maintenanceType", "보전유형", "보전그룹", "보전파트"],
      ["equipmentCode", "설비코드"],
      ["equipmentName", "설비명"],
      ["version", "버전"],
      ["specName", "사양항목"],
      ["specValue", "사양값"],
    ];
    const idx = groups.findIndex((g) => g.includes(key));
    return idx !== -1 ? idx : 999;
  }, []);

  // FIX 2: Columns ordered by `sequence` from changeDataColumns.
  // Falls back to dynamic key order if changeDataColumns is empty.
  const orderedJsonKeys = useMemo(() => {
    if (changeDataColumns.length === 0) return null; // signal: not ready yet
    return [...changeDataColumns]
      .sort((a, b) => a.sequence - b.sequence)
      .map((col) => col.jsonKey)
      .filter(Boolean);
  }, [changeDataColumns]);

  const validKeys = useMemo(() => {
    return changeDataColumns?.length > 0
      ? new Set(
          changeDataColumns
            .flatMap((c) => [
              c.excelColumnName?.trim().toLowerCase(),
              c.columnNameKr?.trim().toLowerCase(),
              c.jsonKey?.trim().toLowerCase(),
            ])
            .filter(Boolean),
        )
      : null;
  }, [changeDataColumns]);

  // ── Remap all rows to English jsonKeys to keep keys consistent ────────────────
  const combinedData = useMemo(() => {
    const remapRow = (row) => {
      if (!row) return row;
      return Object.entries(row).reduce((acc, [key, value]) => {
        const mappedKey = excelToJsonKey[key.trim()] ?? key;
        acc[mappedKey] = value;
        return acc;
      }, {});
    };

    return changedRecords.map(remapRow);
  }, [changedRecords, excelToJsonKey]);

  // Columns to hide from the table display (used internally only)
  const HIDDEN_COLUMNS = new Set(["id"]);

  // FIX 2 (cont.): dynamicColumns respects sequence order when available;
  // falls back to Object.keys order when changeDataColumns hasn't loaded yet.
  // `id` and other internal keys are always excluded from display.
  const dynamicColumns = useMemo(() => {
    if (orderedJsonKeys && orderedJsonKeys.length > 0) {
      // Only include keys that actually exist in the data (avoid phantom columns)
      const dataKeys = combinedData.length > 0 ? new Set(Object.keys(combinedData[0])) : new Set();
      const sequenced = orderedJsonKeys.filter(
        (key) => dataKeys.has(key) && !HIDDEN_COLUMNS.has(key),
      );
      // Append any extra keys present in data but not in column defs, excluding hidden keys
      const extra =
        combinedData.length > 0
          ? Object.keys(combinedData[0]).filter(
              (k) => !orderedJsonKeys.includes(k) && !HIDDEN_COLUMNS.has(k),
            )
          : [];
      const merged = [...sequenced, ...extra];
      return merged.sort((a, b) => getColumnGroupIndex(a) - getColumnGroupIndex(b));
    }
    if (combinedData.length > 0) {
      const keys = Object.keys(combinedData[0]).filter((k) => !HIDDEN_COLUMNS.has(k));
      return keys.sort((a, b) => getColumnGroupIndex(a) - getColumnGroupIndex(b));
    }
    return [];
  }, [combinedData, orderedJsonKeys, getColumnGroupIndex]);

  // ── Filtered rows ─────────────────────────────────────────────────────────
  const duplicateKeyColumns = useMemo(
    () =>
      (orderedJsonKeys && orderedJsonKeys.length > 0 ? orderedJsonKeys : dynamicColumns).filter(
        (key) => key !== "id" && key !== "_sourceId",
      ),
    [orderedJsonKeys, dynamicColumns],
  );

  const existingDuplicateKeys = useMemo(() => {
    const remapRow = (row) => {
      if (!row) return row;
      return Object.entries(row).reduce((acc, [key, value]) => {
        const mappedKey = excelToJsonKey[key.trim()] ?? key;
        acc[mappedKey] = value;
        return acc;
      }, {});
    };
    const remappedApiRecords = apiRecords.map(remapRow);
    return new Set(
      remappedApiRecords.map((row) => buildDuplicateKey(row, excelToJsonKey, duplicateKeyColumns)),
    );
  }, [apiRecords, excelToJsonKey, duplicateKeyColumns]);

  const getPreviewDuplicateKey = useCallback(
    (row) => buildDuplicateKey(row, excelToJsonKey, duplicateKeyColumns),
    [excelToJsonKey, duplicateKeyColumns],
  );

  const filtered = useMemo(() => {
    if (!selectedProcessId) {
      return [];
    }

    const selectedProcess = selectedProcessId
      ? processList.find((p) => p.id === selectedProcessId)
      : null;
    const selectedMaint = (filterPayload?.maintenance ?? []).find(
      (m) => m.id === selectedMaintenanceId,
    );

    return combinedData.filter((item) => {
      const itemProcess = item.process ?? item["ê³µì •"] ?? "";
      const itemMaint =
        item.maintGroup ??
        item["ë³´ì „íŒŒíŠ¸"] ??
        item["ë³´ì „ê·¸ë£¹"] ??
        item["ë³´ì „ìœ í˜•"] ??
        "";

      if (!selectedProcess || !selectedMaint) {
        const text = Object.values(item)
          .map((v) => String(v ?? ""))
          .join(" ")
          .toLowerCase();
        const matchesProcSelection =
          !selectedProcess || itemProcess === selectedProcess.processName;
        const matchesMaintSelection =
          !selectedMaint || itemMaint === selectedMaint.maintenanceGroupName;
        const matchesSearch = searchText ? text.includes(searchText.toLowerCase()) : true;

        return matchesProcSelection && matchesMaintSelection && matchesSearch;
      }

      const matchesProc = (item.process ?? item.공정) === (selectedProcess?.processName ?? "");

      const matchesMaint =
        (item.maintGroup ?? item.보전파트 ?? item.보전그룹 ?? item.보전유형) ===
        (selectedMaint?.maintenanceGroupName ?? "");

      const text = Object.values(item)
        .map((v) => String(v ?? ""))
        .join(" ")
        .toLowerCase();
      const matchesSearch = searchText ? text.includes(searchText.toLowerCase()) : true;

      return matchesProc && matchesMaint && matchesSearch;
    });
  }, [
    combinedData,
    processList,
    filterPayload,
    selectedProcessId,
    selectedMaintenanceId,
    searchText,
  ]);

  // ── Multi-select ──────────────────────────────────────────────────────────
  const toggleSelect = (index) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(filtered.map((_, i) => i)));
  };

  useEffect(() => {
    setSelectedIds(new Set());
  }, [selectedProcessId, selectedMaintenanceId, searchText]);

  // ── Ref so handleModalConfirm / handleSaveRow can call getFilterData
  //    without a stale closure
  const getFilterDataRef = useRef(null);

  // ── Shared helper: build changeDataList from an array of rows ─────────────
  const buildChangeDataList = useCallback(
    (rows) => {
      return rows.map((row) => {
        const remapped = remapRowKeys(row, excelToJsonKey, validKeys);
        const mandatoryDefaults = {};
        changeDataColumns.forEach((col) => {
          if (col.isMandatory && col.jsonKey) {
            mandatoryDefaults[col.jsonKey] = remapped[col.jsonKey] ?? "";
          }
        });
        return { ...remapped, ...mandatoryDefaults, id: remapped.id ?? 0 };
      });
    },
    [excelToJsonKey, validKeys, changeDataColumns],
  );

  // ── Inline row save ────────────────────────────────────────────────────────
  const handleSaveRow = useCallback(
    (filteredIndex, draft) => {
      const originalRow = filtered[filteredIndex];
      const mergedRow = { ...originalRow, ...draft };

      const updatedRows = combinedData.map((row) => {
        const sameObject = row === originalRow;
        const sameId = row.id != null && mergedRow.id != null && row.id === mergedRow.id;
        return sameObject || sameId ? mergedRow : row;
      });

      const SpecDataList = buildChangeDataList(updatedRows);
      const payload = { SpecDataList, id: specDataId };

      setOperationStatus({
        isVisible: true,
        status: "loading",
        message: t("toast.saving"),
        autoClose: false,
      });

      if (isStaticDataMode) {
        setChangedRecords([...SpecDataList].sort((a, b) => (b.id ?? 0) - (a.id ?? 0)));
        setEditingIndex(null);
        setOperationStatus({
          isVisible: true,
          status: "success",
          message: `${SpecDataList.length} ${t("app.rows")} - ${t("toast.saveSuccess")}`,
          autoClose: true,
        });
        onUpload?.("spec_rows", payload);
        return;
      }

      APIcallPost(pocEndPoints?.SAVE_SPEC_DATA, payload, {}, (responseData, status) => {
        if (status === 200) {
          setEditingIndex(null);
          setOperationStatus({
            isVisible: true,
            status: "success",
            message: `${SpecDataList.length} ${t("app.rows")} - ${t("toast.saveSuccess")}`,
            autoClose: true,
          });
          onUpload?.("spec_rows", payload);
          getFilterDataRef.current?.();
        } else {
          console.error("행 저장 실패:", responseData);
          setOperationStatus({
            isVisible: true,
            status: "error",
            message: t("toast.rowSaveError"),
            autoClose: true,
          });
        }
      });
    },
    [filtered, combinedData, buildChangeDataList, onUpload, specDataId, t],
  );

  const handleCancelEdit = useCallback(() => setEditingIndex(null), []);

  // ── Modal confirm → POST ──────────────────────────────────────────────────
  const handleModalConfirm = useCallback(
    (updatedRows) => {
      const uploadedRows = buildChangeDataList(updatedRows);
      const uploadedKeys = new Set(
        uploadedRows.map((row) => buildDuplicateKey(row, {}, duplicateKeyColumns)),
      );
      const existingRows = buildChangeDataList(combinedData).filter(
        (row) => !uploadedKeys.has(buildDuplicateKey(row, {}, duplicateKeyColumns)),
      );
      const SpecDataList = [...uploadedRows, ...existingRows];
      const payload = { SpecDataList, id: specDataId };

      if (isStaticDataMode) {
        setPreviewRows(null);
        setPreviewColumns(null);
        setChangedRecords([...SpecDataList].sort((a, b) => (b.id ?? 0) - (a.id ?? 0)));
        setOperationStatus({
          isVisible: true,
          status: "success",
          message: `${SpecDataList.length} ${t("app.rows")} - ${t("toast.saveSuccess")}`,
          autoClose: true,
        });
        onUpload?.("spec_rows", payload);
        return;
      }

      APIcallPost(pocEndPoints?.SAVE_SPEC_DATA, payload, {}, (responseData, status) => {
        if (status === 200) {
          setPreviewRows(null);
          setPreviewColumns(null);
          setOperationStatus({
            isVisible: true,
            status: "success",
            message: `${SpecDataList.length} ${t("app.rows")} - ${t("toast.saveSuccess")}`,
            autoClose: true,
          });
          onUpload?.("spec_rows", payload);
          getFilterDataRef.current?.();
        } else {
          console.error("일괄 저장 실패:", responseData);
          setOperationStatus({
            isVisible: true,
            status: "error",
            message: t("toast.saveError"),
            autoClose: true,
          });
        }
      });
    },
    [buildChangeDataList, combinedData, duplicateKeyColumns, onUpload, specDataId, t],
  );

  // ── Upload Excel → parse via API → show preview modal ────────────────────
  const uploadExcelFile = useCallback(
    async (file, callback) => {
      if (isStaticDataMode) {
        try {
          const data = await file.arrayBuffer();
          const workbook = XLSX.read(data, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
          callback({ columnNames: rows.length > 0 ? Object.keys(rows[0]) : [], rows }, 200);
        } catch (error) {
          console.error("Static spreadsheet parsing failed:", error);
          callback(error, 500);
        }
        return;
      }

      const filterColumns = changeDataColumns
        .map((item) => item.excelColumnName)
        .filter(Boolean)
        .join(",");

      const url = `${pocEndPoints?.UPLOAD_EXCEL}?FilterColumns=${encodeURIComponent(
        filterColumns,
      )}&SheetName=sheet1`;

      const formData = new FormData();
      formData.append("UploadedBy", getUserInfo()?.name || "");
      formData.append("File", file);

      await APIcallPostFile(url, formData, {}, callback);
    },
    [changeDataColumns],
  );

  const handleUploadExcel = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";
    setImportFileName(file.name);
    setImportBusy(true);

    try {
      await withMinimumDelay(async () => {
        await uploadExcelFile(file, (res, statusCode) => {
          if (statusCode === 200) {
            // Always show all active columns from changeDataColumns in sequence order
            const orderedCols = [...changeDataColumns]
              .filter((c) => c.isActive !== false)
              .sort((a, b) => a.sequence - b.sequence)
              .map((c) => c.excelColumnName)
              .filter(Boolean);

            // Normalize row keys to match excelColumnName exactly (case-insensitive fallback)
            const rawRows = Array.isArray(res?.rows) ? res.rows : [];
            const normalizedRows = rawRows.map((row) => {
              const cleanRow = {};
              changeDataColumns.forEach((col) => {
                if (col.excelColumnName) {
                  const matchedKey = Object.keys(row).find(
                    (k) => k.trim().toLowerCase() === col.excelColumnName.trim().toLowerCase(),
                  );
                  cleanRow[col.excelColumnName] =
                    matchedKey !== undefined ? row[matchedKey] : undefined;
                }
              });
              return cleanRow;
            });

            setPreviewColumns(orderedCols);
            setPreviewRows(normalizedRows);
            setOperationStatus({
              isVisible: true,
              status: "success",
              message: `${normalizedRows.length} ${t("toast.rowsLoaded")}`,
              autoClose: true,
            });
          } else {
            setOperationStatus({
              isVisible: true,
              status: "error",
              message: t("toast.uploadFailed"),
              autoClose: true,
            });
          }
        });
      });
    } finally {
      setImportBusy(false);
    }
  };

  // ── Export filtered rows ──────────────────────────────────────────────────
  const handleExport = async () => {
    if (!filtered || filtered.length === 0) {
      setOperationStatus({
        isVisible: true,
        status: "error",
        message: t("toast.noRecordsExport"),
        autoClose: true,
      });
      return;
    }

    setExportBusy(true);
    setOperationStatus({
      isVisible: true,
      status: "loading",
      message: `${filtered.length} ${t("toast.exporting")}`,
      autoClose: false,
    });

    try {
      await withMinimumDelay(async () => {
        const sortedCols = [...changeDataColumns]
          .filter((col) => col.isActive !== false && col.jsonKey && col.jsonKey !== "id")
          .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));

        const exportCols = sortedCols.map((col) => col.excelColumnName || col.jsonKey);

        const exportData = filtered.map((row) => {
          const orderedRow = {};
          sortedCols.forEach((col) => {
            const header = col.excelColumnName || col.jsonKey;
            orderedRow[header] = row[col.jsonKey] ?? "";
          });
          return orderedRow;
        });

        const worksheet = XLSX.utils.json_to_sheet(exportData, { header: exportCols });
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Spec Data");
        XLSX.writeFile(workbook, "spec-data.xlsx");

        setOperationStatus({
          isVisible: true,
          status: "success",
          message: `${filtered.length} ${t("toast.exportSuccess")}`,
          autoClose: true,
        });
      });
    } catch (error) {
      console.error("Excel export failed:", error);
      setOperationStatus({
        isVisible: true,
        status: "error",
        message: t("toast.exportFailed"),
        autoClose: true,
      });
    } finally {
      setExportBusy(false);
    }
  };

  // ── Fetch filter data + specDataJson ──────────────────────────────────────
  const getFilterData = useCallback(() => {
    if (isStaticDataMode) {
      try {
        const payload = specFilterDataAndTableData;
        setFilterPayload(payload);

        if (Array.isArray(payload?.specDataJson)) {
          const allRecords = [];
          let capturedId = 0;

          payload.specDataJson.forEach((item) => {
            try {
              if (item.content) {
                capturedId = item.id ?? capturedId;
                const parsed =
                  typeof item.content === "string" ? JSON.parse(item.content) : item.content;
                if (Array.isArray(parsed)) allRecords.push(...parsed);
              }
            } catch (parseError) {
              console.warn("[SpecData] Failed to parse static specDataJson:", parseError);
            }
          });

          allRecords.sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
          setChangedRecords(allRecords);
          setApiRecords(allRecords);
          setSpecDataJsonId(capturedId);
        } else {
          setChangedRecords([]);
          setApiRecords([]);
          setSpecDataJsonId(0);
        }

        setFilterError(null);
      } catch (error) {
        console.error("[SpecData] Error processing static data:", error);
        setFilterPayload({ process: [], maintenance: [] });
        setChangedRecords([]);
        setApiRecords([]);
        setSpecDataJsonId(0);
        setFilterError(t("toast.filterError"));
      }
      return;
    }

    APIcallGet(`${pocEndPoints?.GET_SPEC_DATA}`, {}, (responseData, status) => {
      try {
        if (status === 200 && responseData) {
          const payload = responseData?.data || responseData;

          setFilterPayload(payload);

          if (Array.isArray(payload?.specDataJson)) {
            const allRecords = [];
            let capturedId = 0;

            payload.specDataJson.forEach((item) => {
              try {
                if (item.content) {
                  capturedId = item.id ?? capturedId;
                  const parsed =
                    typeof item.content === "string" ? JSON.parse(item.content) : item.content;
                  if (Array.isArray(parsed)) allRecords.push(...parsed);
                }
              } catch (parseError) {
                console.warn("[SpecData] Failed to parse specDataJson content:", parseError);
              }
            });

            allRecords.sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
            setChangedRecords(allRecords);
            setApiRecords(allRecords);
            setSpecDataJsonId(capturedId);
          } else {
            setChangedRecords([]);
            setApiRecords([]);
            setSpecDataJsonId(0);
          }

          setFilterError(null);
        } else {
          console.warn("[SpecData] Filter API invalid status:", status);
          setFilterPayload({ process: [], maintenance: [] });
          setChangedRecords([]);
          setApiRecords([]);
          setSpecDataJsonId(0);
          setFilterError(t("toast.filterLoadError"));
        }
      } catch (error) {
        console.error("[SpecData] Error processing filter data:", error);
        setFilterPayload({ process: [], maintenance: [] });
        setChangedRecords([]);
        setApiRecords([]);
        setSpecDataJsonId(0);
        setFilterError(t("toast.filterError"));
      }
    });
  }, [t]);

  // Keep ref in sync
  useEffect(() => {
    getFilterDataRef.current = getFilterData;
  }, [getFilterData]);

  // ── Fetch column definitions on mount ────────────────────────────────────
  useEffect(() => {
    if (isStaticDataMode) {
      setColumnDefsId(0);
      setChangeDataColumns(staticSpecDataColumns);
      getFilterData();
      return;
    }

    APIcallGet(`${pocEndPoints?.CHANGE_DATA_COLUMNS}/2`, {}, (responseData, status) => {
      if (status !== 200 || !responseData) return;

      // FIX 1: Capture `id` from the column definitions response root level.
      // The API returns { data: [...], id: 0, statusCode: 200, ... }
      // Even if id is 0 here, we store it; specDataJsonId from GET_SPEC_DATA
      // will take priority via the `specDataId` derived value above.
      const rootId = responseData?.id ?? 0;
      setColumnDefsId(rootId);

      if (Array.isArray(responseData) && responseData.length > 0) {
        setChangeDataColumns(responseData);
        return;
      }
      if (Array.isArray(responseData?.data) && responseData.data.length > 0) {
        setChangeDataColumns(responseData.data);
        return;
      }
      console.warn("[SpecData] Unexpected column API shape:", responseData);
    });
    getFilterData();
  }, [getFilterData]);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Shimmer animation for skeleton loaders */}
      <style>{`
        @keyframes shimmer {
          0%   { background-position:  200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      <section className="space-y-6">
        {/* Page header */}
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold text-text-default">
              {t("page.specData.title")}
            </h1>
            <p className="mt-2 text-sm text-text-subtle">{t("page.specData.desc")}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <AnimatedActionButton
              className="btn-secondary"
              onClick={() => fileInput.current?.click()}
              busy={importBusy}
              busyLabel="Loading..."
              icon="fas fa-file-import"
            >
              {t("app.importCsv")}
            </AnimatedActionButton>

            <input
              ref={fileInput}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={handleUploadExcel}
            />

            <AnimatedActionButton
              className="btn-primary"
              onClick={handleExport}
              busy={exportBusy}
              busyLabel="Exporting..."
              icon="fas fa-file-export"
            >
              {t("app.exportCsv")}
            </AnimatedActionButton>
          </div>
        </header>

        {/* Filters */}
        <div className="card p-4 mb-4">
          {filterError && (
            <div
              className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-start gap-2"
              role="alert"
            >
              <i className="fas fa-exclamation-circle mt-0.5 flex-shrink-0" />
              <div>{filterError}</div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              {/* 공정 (Process) */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-600">
                  {t("field.process")}
                </label>
                {filterLoading ? (
                  <SelectSkeleton width="120px" />
                ) : (
                  <select
                    className="input-base"
                    value={selectedProcessId ?? ""}
                    onChange={handleProcessChange}
                    style={{ width: "120px", marginTop: 0 }}
                  >
                    <option value="">{t("app.all")}</option>
                    {processList.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.processName}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* 보전유형 */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-600">
                  {t("field.maintenanceType")}
                </label>
                {filterLoading ? (
                  <SelectSkeleton width="140px" />
                ) : (
                  <select
                    className="input-base"
                    value={selectedMaintenanceId ?? ""}
                    onChange={handleMaintenanceChange}
                    disabled={!selectedProcessId}
                    style={{ width: "140px", marginTop: 0 }}
                  >
                    <option value="">{t("app.all")}</option>
                    {maintenanceList.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.maintenanceGroupName}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Spacer + row count */}
            <div className="flex items-center">
              <span className="badge badge-primary">
                {filtered.length}
                {t("app.rows")}
              </span>
            </div>
          </div>
        </div>

        {/* Data table */}
        <div className="card overflow-hidden">
          {selectedProcessId === null ? (
            <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-10 text-center">
               <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#ecf2ff] text-[#4f46e5] text-4xl">
                <i className="fas fa-history" />
              </div>
              <h2 className="text-xl font-bold text-gray-800">
                {t("landing.selectProcessAndMaintType")}
              </h2>
              <p className="text-sm text-gray-400 max-w-md">
                {t("landing.selectProcessAndMaintTypeDesc")}
              </p>
            </div>
          ) : isFiltering ? (
            <TableSkeleton
              rowsCount={filtered.length > 0 ? filtered.length : 8}
              columns={dynamicColumns}
              t={t}
              COLUMN_LABEL_KEYS={COLUMN_LABEL_KEYS}
            />
          ) : filtered.length === 0 ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 p-10 text-center text-text-subtle">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-10 text-brand-60 text-3xl">
                <i className="fas fa-microchip" />
              </div>
              <h2 className="text-xl font-bold text-text-default">{t("empty.noSpecMatch")}</h2>
              <p>{t("empty.specHint")}</p>
            </div>
          ) : (
            <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 39vh)" }}>
              <table className="min-w-full text-left text-sm">
                <thead className="table-header">
                  <tr>
                    {/* Select-all */}
                    {/* <th className="px-4 py-3 w-12">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === filtered.length && filtered.length > 0}
                        onChange={toggleSelectAll}
                      />
                    </th> */}
                    {/* Edit column header */}
                    {/* <th
                      className="px-3 py-3 text-text-subtle whitespace-nowrap"
                      style={{ fontSize: "11px", fontWeight: 600, width: "72px" }}
                    >
                      {t("app.edit")}
                    </th> */}
                    {dynamicColumns.map((col) => (
                      <th key={col} className="px-4 py-3 text-text-subtle whitespace-nowrap">
                        {t(COLUMN_LABEL_KEYS[col] ?? `field.${col}`, col)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row, index) => (
                    <EditableRow
                      key={rowKey(row, index)}
                      row={row}
                      index={index}
                      columns={dynamicColumns}
                      isEditing={false}
                      onStartEdit={setEditingIndex}
                      onSave={handleSaveRow}
                      onCancel={handleCancelEdit}
                      isSelected={selectedIds.has(index)}
                      onToggleSelect={toggleSelect}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Upload preview modal */}
      <UploadPreviewModal
        rows={previewRows}
        columns={previewColumns}
        duplicateRowKeys={existingDuplicateKeys}
        getDuplicateKey={getPreviewDuplicateKey}
        onClose={() => {
          setPreviewRows(null);
          setPreviewColumns(null);
        }}
        onConfirm={handleModalConfirm}
        columnDefs={changeDataColumns}
      />

      <RowEditModal
        row={editingIndex !== null ? filtered[editingIndex] : null}
        index={editingIndex}
        columns={dynamicColumns}
        onSave={handleSaveRow}
        onClose={handleCancelEdit}
      />

      {/* Operation status toast */}
      <OperationStatus
        isVisible={operationStatus.isVisible}
        status={operationStatus.status}
        message={operationStatus.message}
        autoClose={operationStatus.autoClose}
        onClose={() =>
          setOperationStatus({ isVisible: false, status: "loading", message: "", autoClose: true })
        }
      />

      {/* Modern Premium Glassmorphic Loading Overlay */}
      {importBusy && (
        <div
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-4 backdrop-blur-md"
          style={{ backgroundColor: "rgba(15, 23, 42, 0.45)" }}
        >
          <div
            className="flex flex-col items-center justify-center p-8 rounded-2xl shadow-2xl border animate-fade-in"
            style={{
              background: "rgba(255, 255, 255, 0.95)",
              borderColor: "rgba(226, 232, 240, 0.8)",
              maxWidth: "360px",
              width: "100%",
            }}
          >
            {/* Spinning Loader Ring with Gradient */}
            <div className="relative flex items-center justify-center mb-6">
              <div
                className="w-16 h-16 rounded-full border-4 border-slate-100 animate-spin"
                style={{
                  borderTopColor: "var(--color-brand-60, #2563eb)",
                  borderRightColor: "var(--color-brand-60, #2563eb)",
                }}
              />
              <i
                className="fas fa-file-csv absolute text-xl text-blue-600 animate-pulse"
                style={{ animationDuration: "1.5s" }}
              />
            </div>

            <h3 className="text-lg font-bold text-slate-800 mb-1">Importing Data...</h3>
            {importFileName && (
              <p
                className="text-sm font-semibold text-blue-600 mb-2 truncate max-w-full"
                title={importFileName}
              >
                {importFileName}
              </p>
            )}
            <p className="text-sm text-slate-500 text-center animate-pulse">Please wait.</p>
          </div>
        </div>
      )}
    </>
  );
}
