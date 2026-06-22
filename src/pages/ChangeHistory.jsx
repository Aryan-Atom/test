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
  changeDataColumns as staticChangeDataColumns,
  changeFilterDataAndTableData,
} from "./static-data/ChangeHistoryData.js";
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
    if (!validKeys || validKeys.has(trimmedKey.toLowerCase()) || validKeys.has(mappedKey.toLowerCase()) || mappedKey === "id") {
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

function buildOrderedColumns(columnDefs) {
  const list = Array.isArray(columnDefs)
    ? columnDefs
    : Array.isArray(columnDefs?.data)
      ? columnDefs.data
      : [];
  return list
    .filter((col) => col.isActive !== false)
    .filter((col) => col.jsonKey && col.jsonKey !== "id")
    .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
    .map((col) => col.jsonKey);
}

function rowKey(row, index) {
  return `${index}__${row.id ?? ""}__${row.equipmentCode ?? ""}__${
    row.work ?? row.representativeWork ?? ""
  }`;
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

async function readSpreadsheetRows(file) {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
  const columnNames = rows.length > 0 ? Object.keys(rows[0]) : [];
  return { columnNames, rows };
}

// ─────────────────────────────────────────────────────────────────────────────
// SelectSkeleton
// ─────────────────────────────────────────────────────────────────────────────
function SelectSkeleton({ width = "120px" }) {
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
          color:
            duplicate || isEmptyMandatory
              ? "#dc2626"
              :
            value == null || value === ""
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
    const colDef = columnDefs.find(c =>
      c.excelColumnName?.trim().toLowerCase() === colKey.trim().toLowerCase() ||
      c.jsonKey?.trim().toLowerCase() === colKey.trim().toLowerCase()
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
      savePreviewRows(rowsWithIndex)
        .then(() => {
          setRows(rowsWithIndex);
        })
        .catch(console.error);
    } else {
      clearPreviewRows()
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
      clearPreviewRows().catch(console.error);
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
        updatePreviewRow(realIndex, payload).catch(console.error);
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
      deletePreviewRow(realIndex, prev.length).catch(console.error);

      const updatedNext = next.map((row, idx) => ({
        ...row,
        _originalIndex: idx,
      }));
      savePreviewRows(updatedNext).catch(console.error);

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
      savePreviewRows(updatedNext).catch(console.error);
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
      const currentRows = await getAllPreviewRows();

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

      await clearPreviewRows();
      onClose();
      window.setTimeout(() => onConfirm?.(currentRows), 0);
    } catch (error) {
      console.error("Failed to read confirmed rows from IndexedDB:", error);
      alert("Error saving data. Please try again.");
    }
  };

  const handleClose = () => {
    clearPreviewRows().catch(console.error);
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
  onOpenDetail,
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

  useEffect(() => {
    if (!isEditing) return;
    const handler = (e) => {
      if (e.key === "Enter") handleSave(e);
      if (e.key === "Escape") handleCancel(e);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isEditing, handleSave]);

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
      className={!isEditing ? "cursor-pointer" : ""}
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
      onClick={() => !isEditing && onOpenDetail?.(row)}
    >
      {/* Checkbox */}
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" checked={isSelected} onChange={() => onToggleSelect(index)} />
      </td>

      {/* Edit controls */}
      <td className="px-3 py-2" style={{ whiteSpace: "nowrap" }}>
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
      </td>

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
  // English keys
  process: "field.process",
  maintGroup: "field.maintenance",
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
  improvement: "field.improvement",
  // Korean keys
  "법인": "field.site",
  "공정": "field.process",
  "보전파트": "field.maintenance",
  "보전그룹": "field.maintenanceGroup",
  "보전유형": "field.maintenanceType",
  "설비코드": "field.equipmentCode",
  "설비명": "field.equipmentName",
  "W/O코드": "field.woCode",
  "Report내용": "field.report",
  "BOM": "field.bom",
  "자재명": "field.sparePart",
  "작업완료일": "field.workedOn",
  "개선 작업": "field.improvement",
  "작업목적": "field.work",
  "문제 현상": "field.situation",
  "문제 원인": "field.cause",
  "HW 변경 전": "field.hwBefore",
  "HW 변경 후": "field.hwAfter",
  "SW 변경 전": "field.swBefore",
  "SW 변경 후": "field.swAfter",
  "대표 작업명": "field.repWork",
  "중요도": "field.priority",
  "효과 유형": "field.category",

  type: "field.type",
  title: "field.title",
  author: "field.author",
  date: "field.date",
  role: "field.role",
  management: "field.management",
  maintId: "field.maintenance",
  maintGroupName: "field.maintenanceGroup",
  processName: "field.process",
  siteName: "field.site",
  representativeWorkName: "field.repWork",
  priorityName: "field.priority",
  categoryName: "field.category",
  version: "field.version",
};

// ─────────────────────────────────────────────────────────────────────────────
// Main ChangeHistory component
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

  const modalFields = [
    { key: "process", labelKey: "field.process", readonly: true },
    { key: "maintGroup", labelKey: "field.maintenance", readonly: true },
    { key: "representativeWork", labelKey: "field.repWork", required: true },
    { key: "work", labelKey: "field.work", required: true },
    { key: "situation", labelKey: "field.situation", required: true },
    { key: "cause", labelKey: "field.cause", required: true },
    { key: "bom", labelKey: "field.bom", multiline: true },
    { key: "sparePart", labelKey: "field.sparePart", multiline: true },
    { key: "hwAsWas", labelKey: "field.hwBefore", required: true },
    { key: "hwAsIs", labelKey: "field.hwAfter", required: true },
    { key: "swAsWas", labelKey: "field.swBefore", required: true },
    { key: "swAsIs", labelKey: "field.swAfter", required: true },
    { key: "priority", labelKey: "field.priority", required: true, type: "select", compact: true },
    { key: "category", labelKey: "field.category", required: true, type: "select", compact: true },
    { key: "workedOn", labelKey: "field.workedOn", required: true, type: "date", compact: true },
  ];

  const handleFieldChange = (key, val) => {
    setDraft((prev) => ({ ...prev, [key]: val }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const nextErrors = {};
    modalFields.forEach((field) => {
      if (field.required) {
        const val = draft[field.key];
        if (val === undefined || val === null || String(val).trim() === "") {
          nextErrors[field.key] = t("page.mp.requiredFieldError", "This field is required.");
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
        className="flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl shadow-2xl"
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
            background: "#ecfeff",
            borderBottom: "1px solid var(--color-border-base, #e5e7eb)",
          }}
        >
          <div>
            <h2 className="text-xl font-extrabold text-text-default">
              <i className="fas fa-circle-plus mr-2 text-cyan-500" />
              {t("app.edit")} {t("page.change.title")}
            </h2>
            <p className="mt-1 text-sm text-text-subtle">
              {t("page.mp.modalDesc")}
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

        <div
          className="grid flex-1 grid-cols-1 gap-4 overflow-auto p-6 md:grid-cols-6"
          style={{ background: "#f3f4f6" }}
        >
          {modalFields.map((field) => {
            const label = t(field.labelKey, field.key);
            const value = draft[field.key] ?? "";
            const options =
              field.type === "select"
                ? [value, field.key === "priority" ? t("priority.normal") : t("category.etc")]
                    .filter(Boolean)
                    .filter((item, itemIndex, arr) => arr.indexOf(item) === itemIndex)
                : [];

            const hasError = !!errors[field.key];

            return (
              <label
                key={field.key}
                className={field.compact ? "md:col-span-2" : "md:col-span-3"}
              >
                <span className="mb-2 block text-xs font-bold uppercase text-text-subtle">
                  {label}
                  {field.required && <span className="text-red-500"> *</span>}
                </span>
                {field.multiline ? (
                  <textarea
                    className="input-base"
                    rows={3}
                    value={value}
                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                    style={{
                      width: "100%",
                      resize: "vertical",
                      borderColor: hasError ? "var(--color-text-danger, #dc2626)" : undefined,
                      borderWidth: hasError ? "1.5px" : undefined,
                    }}
                    disabled={field.readonly}
                  />
                ) : field.type === "select" ? (
                  <select
                    className="input-base"
                    value={value}
                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                    style={{
                      width: "100%",
                      borderColor: hasError ? "var(--color-text-danger, #dc2626)" : undefined,
                      borderWidth: hasError ? "1.5px" : undefined,
                    }}
                    disabled={field.readonly}
                  >
                    {options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field.type === "date" ? "date" : "text"}
                    className="input-base"
                    value={value}
                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                    style={{
                      width: "100%",
                      background: field.readonly ? "#e8eef7" : undefined,
                      color: field.readonly ? "#334155" : undefined,
                      borderColor: hasError ? "var(--color-text-danger, #dc2626)" : undefined,
                      borderWidth: hasError ? "1.5px" : undefined,
                    }}
                    readOnly={field.readonly}
                    disabled={field.readonly}
                  />
                )}
                {hasError && (
                  <span className="mt-1 block text-[11px] font-semibold text-red-500 animate-fade-in">
                    <i className="fas fa-exclamation-circle mr-1" />
                    {errors[field.key]}
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

export default function ChangeHistory({ data, onUpload, onExport, onOpenDetail, searchText }) {
  const { t } = useI18n();
  const [selectedProcessId, setSelectedProcessId] = useState(null);
  const [selectedMaintenanceId, setSelectedMaintenanceId] = useState(null);
  const [filter, setFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [previewRows, setPreviewRows] = useState(null);
  const [previewColumns, setPreviewColumns] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [changeDataColumns, setChangeDataColumns] = useState([]);
  const [filterPayload, setFilterPayload] = useState(null);
  const [filterError, setFilterError] = useState(null);

  // ── All flat records parsed from changedDataJson[0].content ───────────────
  const [changedRecords, setChangedRecords] = useState([]);
  const [apiRecords, setApiRecords] = useState([]);

  // ── The single envelope id from changedDataJson[0].id ─────────────────────
  // This is the id we MUST send back on every save so the backend replaces
  // the entire content blob for that record.
  const [changedDataId, setChangedDataId] = useState(0);

  const [importBusy, setImportBusy] = useState(false);
  const [importFileName, setImportFileName] = useState("");
  const [exportBusy, setExportBusy] = useState(false);
  const [operationStatus, setOperationStatus] = useState({
    isVisible: false,
    status: "loading",
    message: "",
    autoClose: true,
  });
  const fileInput = useRef(null);
  const getFilterDataRef = useRef(null);

  const filterLoading = filterPayload === null && filterError === null;

  // ── Filter option lists ───────────────────────────────────────────────────
  const processList = useMemo(() => {
    const all = filterPayload?.process ?? [];
    return all.filter((p) => p.isChangedData === true);
  }, [filterPayload]);

  const maintenanceList = useMemo(() => {
    const all = filterPayload?.maintenance ?? [];
    const filtered = all.filter((m) => m.isChangedData === true);
    if (!selectedProcessId) return filtered;
    return filtered.filter((m) => m.processId === selectedProcessId);
  }, [filterPayload, selectedProcessId]);

  const handleProcessChange = (e) => {
    const val = e.target.value;
    setSelectedProcessId(val === "" ? null : Number(val));
    setSelectedMaintenanceId(null);
  };

  const handleMaintenanceChange = (e) => {
    const val = e.target.value;
    setSelectedMaintenanceId(val === "" ? null : Number(val));
  };

  // ── Column helpers ────────────────────────────────────────────────────────
  const excelToJsonKey = useMemo(
    () => buildExcelToJsonKeyMap(changeDataColumns),
    [changeDataColumns],
  );

  const orderedJsonKeys = useMemo(
    () => buildOrderedColumns(changeDataColumns),
    [changeDataColumns],
  );

  const validKeys = useMemo(() => {
    const allowedKeys = new Set([
      "site",
      "process",
      "maintgroup",
      "equipmentcode",
      "equipmentname",
      "wocode",
      "report",
      "bom",
      "sparepart",
      "workedon",
      "work",
      "purpose",
      "situation",
      "cause",
      "hwaswas",
      "hwasis",
      "swaswas",
      "swasis",
      "representativework",
      "priority",
      "category",
      // Excel names
      "site",
      "process",
      "equipment",
      "equipment_code",
      "equipment_name",
      "wo_code",
      "report_content",
      "bom",
      "spare part",
      "work_date",
      "work",
      "purpose",
      "situation",
      "cause",
      "hw_was",
      "hw_is",
      "sw_was",
      "sw_is",
      "rep_work",
      "priority",
      "category"
    ]);

    if (!changeDataColumns || changeDataColumns.length === 0) return null;
    const keys = new Set();
    changeDataColumns.forEach(c => {
      const excelName = c.excelColumnName?.trim().toLowerCase();
      const jsonKey = c.jsonKey?.trim().toLowerCase();
      const krName = c.columnNameKr?.trim().toLowerCase();
      
      if (allowedKeys.has(excelName) || allowedKeys.has(jsonKey)) {
        if (excelName) keys.add(excelName);
        if (jsonKey) keys.add(jsonKey);
        if (krName) keys.add(krName);
      }
    });
    return keys;
  }, [changeDataColumns]);

  // ── Helper to sort keys by mockup order ───────────────────────────────────
  const getColumnGroupIndex = useCallback((key) => {
    const groups = [
      ["site", "법인"],
      ["process", "공정"],
      ["maintGroup", "보전파트", "보전그룹"],
      ["equipmentCode", "설비코드"],
      ["equipmentName", "설비명"],
      ["woCode", "wOCode", "W/O코드"],
      ["report", "Report내용"],
      ["bom", "BOM"],
      ["sparePart", "자재명"],
      ["workedOn", "작업완료일"],
      ["improvement", "개선 작업"],
      ["work", "작업목적"],
      ["situation", "문제 현상"],
      ["cause", "문제 원인"],
      ["hwBefore", "hwAsWas", "HW 변경 전"],
      ["hwAfter", "hwAsIs", "HW 변경 후"],
      ["swBefore", "swAsWas", "SW 변경 전"],
      ["swAfter", "swAsIs", "SW 변경 후"],
      ["representativeWork", "대표 작업명"],
      ["priority", "중요도"],
      ["category", "효과 유형"]
    ];
    const idx = groups.findIndex(g => g.includes(key));
    return idx !== -1 ? idx : 999;
  }, []);

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

  // ── Table columns: sequence-sorted jsonKeys, id excluded ──────────────────
  const dynamicColumns = useMemo(() => {
    if (orderedJsonKeys.length > 0) return orderedJsonKeys;
    if (combinedData.length > 0) {
      const keys = Object.keys(combinedData[0]).filter((k) => k !== "id" && k !== "_sourceId");
      return keys.sort((a, b) => getColumnGroupIndex(a) - getColumnGroupIndex(b));
    }
    return [];
  }, [orderedJsonKeys, combinedData, getColumnGroupIndex]);

  const duplicateKeyColumns = useMemo(
    () =>
      (orderedJsonKeys.length > 0 ? orderedJsonKeys : dynamicColumns).filter(
        (key) => key !== "id" && key !== "_sourceId",
      ),
    [orderedJsonKeys, dynamicColumns],
  );

  const existingDuplicateKeys = useMemo(
    () => {
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
    },
    [apiRecords, excelToJsonKey, duplicateKeyColumns],
  );

  const getPreviewDuplicateKey = useCallback(
    (row) => buildDuplicateKey(row, excelToJsonKey, duplicateKeyColumns),
    [excelToJsonKey, duplicateKeyColumns],
  );

  // ── Filtered rows ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!selectedProcessId && !selectedMaintenanceId && !filter && !searchText) {
      return combinedData;
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
        item.maintGroup ?? item["ë³´ì „íŒŒíŠ¸"] ?? item["ë³´ì „ê·¸ë£¹"] ?? "";

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
        const matchesFilter = filter ? text.includes(filter.toLowerCase()) : true;

        return matchesProcSelection && matchesMaintSelection && matchesSearch && matchesFilter;
      }

      const matchesProc =
        (item.process ?? item.공정) === (selectedProcess?.processName ?? "");

      const matchesMaint =
        (item.maintGroup ?? item.보전파트 ?? item.보전그룹) ===
          (selectedMaint?.maintenanceGroupName ?? "");

      const text = Object.values(item)
        .map((v) => String(v ?? ""))
        .join(" ")
        .toLowerCase();
      const matchesSearch = searchText ? text.includes(searchText.toLowerCase()) : true;
      const matchesFilter = filter ? text.includes(filter.toLowerCase()) : true;

      return matchesProc && matchesMaint && matchesSearch && matchesFilter;
    });
  }, [
    combinedData,
    processList,
    filterPayload,
    selectedProcessId,
    selectedMaintenanceId,
    filter,
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
  }, [selectedProcessId, selectedMaintenanceId, filter, searchText]);

  // ── Build a clean row for the payload (strip internal keys, fill columns) ──
  const buildCleanRow = useCallback(
    (row) => {
      // Safely strip internal tracking field (_sourceId may not exist)
      const clean = Object.entries(row).reduce((acc, [key, value]) => {
        if (key !== "_sourceId") acc[key] = value;
        return acc;
      }, {});
      const fullRow = { id: clean.id ?? 0 };
      orderedJsonKeys.forEach((key) => {
        fullRow[key] = clean[key] ?? "";
      });
      // Carry over any extra keys not in orderedJsonKeys
      Object.entries(clean).forEach(([key, value]) => {
        if (!(key in fullRow)) fullRow[key] = value;
      });
      return fullRow;
    },
    [orderedJsonKeys],
  );

  // ── SAVE ROW ──────────────────────────────────────────────────────────────
  // When saving ONE edited row, we must send the ENTIRE changedRecords list
  // (all 20 rows) with the single edited row merged in, plus id = changedDataId.
  // The backend replaces the whole content blob for that envelope id.
  const handleSaveRow = useCallback(
    (filteredIndex, draft) => {
      const originalRow = filtered[filteredIndex];

      // Merge draft into the original row
      const mergedRow = { ...originalRow, ...draft };

      // Build the full changeDataList:
      // Take ALL changedRecords, replace the matching row (by row id) with
      // the edited+merged version, then clean every row for the payload.
      const changeDataList = changedRecords.map((r) => {
        const isEditedRow = r.id != null && r.id === mergedRow.id;
        return buildCleanRow(isEditedRow ? mergedRow : r);
      });

      // If the edited row isn't in changedRecords yet (e.g. it came from
      // the `data` prop), append it so the backend doesn't lose it.
      const editedExists = changedRecords.some((r) => r.id === mergedRow.id);
      if (!editedExists) {
        changeDataList.push(buildCleanRow(mergedRow));
      }

      const payload = {
        changeDataList,
        id: changedDataId, // ← the envelope id from changedDataJson[0].id
      };

      setOperationStatus({
        isVisible: true,
        status: "loading",
        message: t("toast.saving"),
        autoClose: false,
      });

      if (isStaticDataMode) {
        setChangedRecords([...changeDataList].sort((a, b) => (b.id ?? 0) - (a.id ?? 0)));
        setEditingIndex(null);
        setOperationStatus({
          isVisible: true,
          status: "success",
          message: `${changeDataList.length} ${t("app.rows")} - ${t("toast.saveSuccess")}`,
          autoClose: true,
        });
        onUpload?.("change_rows", payload);
        return;
      }

      APIcallPost(pocEndPoints?.SAVE_DATA_CHANGES, payload, {}, (responseData, status) => {
        if (status === 200) {
          setEditingIndex(null);
          setOperationStatus({
            isVisible: true,
            status: "success",
            message: `${changeDataList.length} ${t("app.rows")} - ${t("toast.saveSuccess")}`,
            autoClose: true,
          });
          onUpload?.("change_rows", payload);
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
    [filtered, changedRecords, changedDataId, buildCleanRow, onUpload, t],
  );

  const handleCancelEdit = useCallback(() => setEditingIndex(null), []);

  // ── MODAL CONFIRM (bulk upload) ───────────────────────────────────────────
  // For a fresh bulk upload, merge uploaded rows with existing changedRecords
  // and send everything with changedDataId.
  const handleModalConfirm = useCallback(
    (updatedRows) => {
      const maxId = changedRecords.reduce((max, r) => Math.max(max, Number(r.id) || 0), 0);
      let nextId = maxId + 1;

      // Remap excel column names → json keys and assign unique IDs
      const remappedRows = updatedRows.map((row) => {
        const remapped = remapRowKeys(row, excelToJsonKey, validKeys);
        const clean = buildCleanRow(remapped);
        if (!clean.id || clean.id === 0) {
          clean.id = nextId++;
        }
        return clean;
      });

      // Merge: uploaded rows override existing records with same duplicate key,
      // then append any existing records NOT present in the upload.
      const uploadedDuplicateKeys = new Set(
        remappedRows.map((r) => buildDuplicateKey(r, excelToJsonKey, duplicateKeyColumns))
      );
      const existingNotOverridden = changedRecords
        .filter((r) => {
          const dupKey = buildDuplicateKey(r, excelToJsonKey, duplicateKeyColumns);
          return !uploadedDuplicateKeys.has(dupKey);
        })
        .map((r) => {
          const clean = buildCleanRow(r);
          if (!clean.id || clean.id === 0) {
            clean.id = nextId++;
          }
          return clean;
        });

      const changeDataList = [...remappedRows, ...existingNotOverridden];

      const payload = {
        changeDataList,
        id: changedDataId, // ← same envelope id
      };

      if (isStaticDataMode) {
        setPreviewRows(null);
        setPreviewColumns(null);
        setChangedRecords([...changeDataList].sort((a, b) => (b.id ?? 0) - (a.id ?? 0)));
        setOperationStatus({
          isVisible: true,
          status: "success",
          message: `${changeDataList.length} ${t("app.rows")} - ${t("toast.saveSuccess")}`,
          autoClose: true,
        });
        onUpload?.("change_rows", payload);
        return;
      }

      APIcallPost(pocEndPoints?.SAVE_DATA_CHANGES, payload, {}, (responseData, status) => {
        if (status === 200) {
          setPreviewRows(null);
          setPreviewColumns(null);
          setOperationStatus({
            isVisible: true,
            status: "success",
            message: `${changeDataList.length} ${t("app.rows")} - ${t("toast.saveSuccess")}`,
            autoClose: true,
          });
          onUpload?.("change_rows", payload);
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
    [changedRecords, changedDataId, excelToJsonKey, buildCleanRow, onUpload, t, validKeys, duplicateKeyColumns],
  );

  // ── Upload Excel ──────────────────────────────────────────────────────────
  const uploadExcelFile = async (file, callback) => {
    if (isStaticDataMode) {
      try {
        const parsed = await readSpreadsheetRows(file);
        callback(parsed, 200);
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
  };

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
              .filter(c => c.isActive !== false)
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
                    (k) => k.trim().toLowerCase() === col.excelColumnName.trim().toLowerCase()
                  );
                  cleanRow[col.excelColumnName] = matchedKey !== undefined ? row[matchedKey] : undefined;
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

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExport = async () => {
    const rowsToExport =
      selectedIds.size > 0 ? filtered.filter((_, i) => selectedIds.has(i)) : filtered;

    if (!rowsToExport || rowsToExport.length === 0) {
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
      message: `${rowsToExport.length} ${t("toast.exporting")}`,
      autoClose: false,
    });

    try {
      await withMinimumDelay(async () => {
        const sortedCols = [...changeDataColumns]
          .filter((col) => col.isActive !== false && col.jsonKey && col.jsonKey !== "id")
          .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));

        const exportCols = sortedCols.map((col) => col.excelColumnName || col.jsonKey);

        const exportData = rowsToExport.map((row) => {
          const orderedRow = {};
          sortedCols.forEach((col) => {
            const header = col.excelColumnName || col.jsonKey;
            orderedRow[header] = row[col.jsonKey] ?? "";
          });
          return orderedRow;
        });

        const worksheet = XLSX.utils.json_to_sheet(exportData, { header: exportCols });
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Change History");
        XLSX.writeFile(workbook, "change-history.xlsx");

        setOperationStatus({
          isVisible: true,
          status: "success",
          message: `${rowsToExport.length} ${t("toast.exportSuccess")}`,
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

  // ── Fetch filter data ─────────────────────────────────────────────────────
  // changedDataJson always has ONE object: { id, content }
  // We capture that id as changedDataId and parse content into flat rows.
  const getFilterData = useCallback(() => {
    if (isStaticDataMode) {
      try {
        const payload = changeFilterDataAndTableData;
        setFilterPayload(payload);
        setFilterError(null);

        if (Array.isArray(payload?.changedDataJson) && payload.changedDataJson.length > 0) {
          const envelope = payload.changedDataJson[0];
          setChangedDataId(envelope.id ?? 0);

          try {
            const parsed =
              typeof envelope.content === "string" ? JSON.parse(envelope.content) : envelope.content;

            const records = Array.isArray(parsed) ? parsed : [];
            let nextId = 1;
            const sanitized = records.map((r) => {
              const clean = { ...r };
              const numId = Number(clean.id);
              if (isNaN(numId) || numId <= 0) {
                clean.id = nextId++;
              } else {
                if (numId >= nextId) {
                  nextId = numId + 1;
                }
              }
              return clean;
            });
            const sorted = sanitized.sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
            setChangedRecords(sorted);
            setApiRecords(sorted);
          } catch (parseError) {
            console.warn("[ChangeHistory] Failed to parse static changedDataJson:", parseError);
            setChangedRecords([]);
            setApiRecords([]);
          }
        } else {
          setChangedDataId(0);
          setChangedRecords([]);
          setApiRecords([]);
        }
      } catch (error) {
        console.error("[ChangeHistory] Error processing static data:", error);
        setFilterPayload({ process: [], maintenance: [] });
        setChangedRecords([]);
        setApiRecords([]);
        setChangedDataId(0);
        setFilterError(t("toast.filterError"));
      }
      return;
    }

    APIcallGet(`${pocEndPoints?.GET_FILTER_DATA}`, {}, (responseData, status) => {
      try {
        if (status === 200 && responseData) {
          const payload = responseData?.data || responseData;
          setFilterPayload(payload);
          setFilterError(null);

          if (Array.isArray(payload?.changedDataJson) && payload.changedDataJson.length > 0) {
            // changedDataJson always has one item — take index 0
            const envelope = payload.changedDataJson[0];

            // Capture the envelope id for all future save payloads
            setChangedDataId(envelope.id ?? 0);

            // Parse the content array into flat records
            try {
              const parsed =
                typeof envelope.content === "string"
                  ? JSON.parse(envelope.content)
                  : envelope.content;

              if (Array.isArray(parsed)) {
                let nextId = 1;
                const sanitized = parsed.map((r) => {
                  const clean = { ...r };
                  const numId = Number(clean.id);
                  if (isNaN(numId) || numId <= 0) {
                    clean.id = nextId++;
                  } else {
                    if (numId >= nextId) {
                      nextId = numId + 1;
                    }
                  }
                  return clean;
                });
                const sorted = sanitized.sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
                setChangedRecords(sorted);
                setApiRecords(sorted);
              } else {
                setChangedRecords([]);
                setApiRecords([]);
              }
            } catch (parseError) {
              console.warn("[ChangeHistory] Failed to parse changedDataJson content:", parseError);
              setChangedRecords([]);
              setApiRecords([]);
            }
          } else {
            // No changedDataJson yet — keep id as 0 so backend creates a new record
            setChangedDataId(0);
            setChangedRecords([]);
            setApiRecords([]);
          }
        } else {
          console.warn("[ChangeHistory] Filter data API returned invalid status:", status);
          setFilterPayload({ process: [], maintenance: [] });
          setChangedRecords([]);
          setApiRecords([]);
          setChangedDataId(0);
          setFilterError(t("toast.filterLoadError"));
        }
      } catch (error) {
        console.error("[ChangeHistory] Error processing filter data:", error);
        setFilterPayload({ process: [], maintenance: [] });
        setChangedRecords([]);
        setApiRecords([]);
        setChangedDataId(0);
        setFilterError(t("toast.filterError"));
      }
    });
  }, [t]);

  useEffect(() => {
    getFilterDataRef.current = getFilterData;
  }, [getFilterData]);

  useEffect(() => {
    if (isStaticDataMode) {
      setChangeDataColumns(staticChangeDataColumns);
      getFilterData();
      return;
    }

    APIcallGet(`${pocEndPoints?.CHANGE_DATA_COLUMNS}/1`, {}, (responseData, status) => {
      if (status !== 200 || !responseData) return;
      if (Array.isArray(responseData) && responseData.length > 0) {
        setChangeDataColumns(responseData);
        return;
      }
      if (Array.isArray(responseData?.data) && responseData.data.length > 0) {
        setChangeDataColumns(responseData.data);
        return;
      }
      console.warn("[ChangeHistory] Unexpected column API shape:", responseData);
    });
    getFilterData();
  }, [getFilterData]);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
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
            <h1 className="text-3xl font-extrabold text-text-default">{t("page.change.title")}</h1>
            <p className="mt-2 text-sm text-text-subtle">
              {t("page.change.desc")}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <AnimatedActionButton
              className="btn-secondary"
              onClick={() => fileInput.current?.click()}
              busy={importBusy}
              busyLabel="Loading CSV..."
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
              {selectedIds.size > 0 ? `${t("app.exportCsv")} (${selectedIds.size}${t("app.rows")})` : t("app.exportCsv")}
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
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold uppercase text-text-subtle">
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

            <div className="flex items-center gap-2">
              <label className="text-xs font-bold uppercase text-text-subtle">
                {t("field.maintenance")}
              </label>
              {filterLoading ? (
                <SelectSkeleton width="130px" />
              ) : (
                <select
                  className="input-base"
                  value={selectedMaintenanceId ?? ""}
                  onChange={handleMaintenanceChange}
                  disabled={!selectedProcessId}
                  style={{ width: "130px", marginTop: 0 }}
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

            <div className="flex items-center gap-2">
              <label className="text-xs font-bold uppercase text-text-subtle">
                {t("app.search")}
              </label>
              <input
                className="input-base"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder={t("placeholder.changeSearch")}
                style={{ width: "200px", marginTop: 0 }}
              />
            </div>

            <div className="ml-auto flex items-center gap-2">
              <span className="badge badge-primary">
                {filtered.length}
                {t("app.rows")}
              </span>
              <button
                type="button"
                className="btn-base btn-ghost text-xs flex items-center gap-1.5"
                onClick={toggleSelectAll}
                style={{ minHeight: "38px", padding: "8px 16px" }}
              >
                <i className="fas fa-check-double" />
                {t("app.selectAll", "전체선택")}
              </button>
            </div>
          </div>
        </div>

        {/* Data table */}
        <div className="card overflow-hidden">
          {filtered.length === 0 ? (
            <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 p-10 text-center text-text-subtle">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-10 text-brand-60 text-3xl">
                <i className="fas fa-history" />
              </div>
              <h2 className="text-xl font-bold text-text-default">
                {t("empty.noMatch")}
              </h2>
              <p>{t("empty.hint")}</p>
            </div>
          ) : (
            <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 39vh)" }}>
              <table className="min-w-full text-left text-sm">
                <thead className="table-header">
                  <tr>
                    <th className="px-4 py-3 w-12">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === filtered.length && filtered.length > 0}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th
                      className="px-3 py-3 text-text-subtle whitespace-nowrap"
                      style={{ fontSize: "11px", fontWeight: 600, width: "72px" }}
                    >
                      {t("app.edit")}
                    </th>
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
                      onOpenDetail={onOpenDetail}
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

            <h3 className="text-lg font-bold text-slate-800 mb-1">
              Importing Data...
            </h3>
            {importFileName && (
              <p className="text-sm font-semibold text-blue-600 mb-2 truncate max-w-full" title={importFileName}>
                {importFileName}
              </p>
            )}
            <p className="text-sm text-slate-500 text-center animate-pulse">
              Parsing file and loading table records. Please wait.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
