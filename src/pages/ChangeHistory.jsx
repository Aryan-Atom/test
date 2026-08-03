import { useMemo, useState, useRef, useCallback, useEffect, forwardRef } from "react";
import AnimatedActionButton from "../components/AnimatedActionButton.jsx";
import { OperationStatus } from "../components/OperationStatus.jsx";
import { withMinimumDelay } from "../utils/actionTiming.js";
import { pocEndPoints } from "../axios/endPoints.js";
import { getUserInfo } from "../utils/cookieUtils.js";
import { APIcallGet, APIcallPost, APIcallPostFile } from "../axios/apiCall.js";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import ExportDropdown from "../components/ExportDropdown.jsx";
import Pagination from "../components/Pagination.jsx";
import SortableTh from "../components/SortableTh.jsx";
import Modal from "../components/Modal.jsx";
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
// MultiSelect — checkbox dropdown for column filter
// ─────────────────────────────────────────────────────────────────────────────
function MultiSelect({ options, selectedValues, onChange, placeholder, t, disabled, minWidth = "120px" }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggleOption = (value) => {
    if (disabled) return;
    const next = selectedValues.includes(value)
      ? selectedValues.filter((v) => v !== value)
      : [...selectedValues, value];
    onChange(next);
  };

  const isAllSelected = selectedValues.length === options.length || selectedValues.length === 0;

  let displayText = placeholder || t("app.all", "전체");
  if (!isAllSelected) {
    if (selectedValues.length === 1) {
      const opt = options.find((o) => o.value === selectedValues[0]);
      displayText = opt?.label ?? String(selectedValues[0]);
    } else {
      displayText = `${selectedValues.length}${t("app.selectedCount", "개 선택")}`;
    }
  }

  return (
    <div ref={containerRef} className="relative flex-none" style={{ minWidth }}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        disabled={disabled}
        className="input-base flex w-full items-center justify-between text-left font-semibold text-text-default"
        style={{
          height: "38px",
          cursor: disabled ? "not-allowed" : "pointer",
          background: disabled ? "var(--surface-strong, #f8f9fb)" : "var(--surface-default, #ffffff)",
          opacity: disabled ? 0.6 : 1,
          border: "1px solid var(--border-base, #e6e9ef)",
          borderRadius: "10px",
          padding: "8px 14px",
          width: "100%",
          textAlign: "left",
          marginTop: "0px",
        }}
      >
        <span className="truncate">{displayText}</span>
        <i
          className={`fas fa-chevron-down text-[10px] text-text-subtle transition-transform duration-200 ${
            isOpen && !disabled ? "rotate-180" : ""
          }`}
          style={{ marginLeft: "8px" }}
        />
      </button>

      {isOpen && !disabled && (
        <div
          className="absolute left-0 right-0 z-[1000] mt-1 max-h-[220px] overflow-y-auto rounded-lg border border-border-base bg-surface-default py-1 shadow-lg"
          style={{
            borderColor: "var(--border-base, #e6e9ef)",
            backgroundColor: "var(--surface-default, #ffffff)",
            minWidth: "100%",
          }}
        >
          {options.map((opt) => {
            const isChecked = selectedValues.includes(opt.value);
            return (
              <label
                key={opt.value}
                className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-text-default hover:bg-surface-strong cursor-pointer"
                style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", cursor: "pointer" }}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  disabled={disabled}
                  onChange={() => handleToggleOption(opt.value)}
                  className="rounded border-border-base text-brand-60 focus:ring-brand-50"
                  style={{ accentColor: "var(--brand-60, #0f62fe)", cursor: disabled ? "not-allowed" : "pointer" }}
                />
                <span className="whitespace-nowrap" style={{ fontSize: "13px" }}>{opt.label}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
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
// TableSkeleton
// ─────────────────────────────────────────────────────────────────────────────
function TableSkeleton({ rowsCount = 8, columns = [], t, COLUMN_LABEL_KEYS = {} }) {
  return (
    <div className="overflow-auto flex-1 min-h-0">
      <table className="min-w-full text-left text-sm">
        <thead className="table-header">
          <tr>
            <th className="px-4 py-3 w-12">
              <input type="checkbox" disabled />
            </th>
            <th
              className="px-3 py-3 text-text-subtle whitespace-nowrap"
              style={{ fontSize: "11px", fontWeight: 600, width: "72px" }}
            >
              {t("app.edit")}
            </th>
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
              <td className="px-4 py-3"></td>
              <td className="px-4 py-3"></td>
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

  const fileInputRef = useRef(null);
  const [pendingPhoto, setPendingPhoto] = useState(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [uploadError, setUploadError] = useState("");

  useEffect(() => {
    setDraft({ ...(row ?? {}) });
    setErrors({});
    setPendingPhoto(null);
    setShowCategoryModal(false);
    setUploadError("");
  }, [row]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!row) return null;

  const photos = draft.photos || [];

  const problemCount = photos.filter((p) => p.category === "Problem phenomenon").length;
  const afterCount = photos.filter((p) => p.category === "After Improvements").length;
  const equipCount = photos.filter((p) => p.category === "Equipment Reference").length;
  const othersCount = photos.filter((p) => p.category === "Others").length;

  const handleFileSelect = (file) => {
    if (!file) return;
    setUploadError("");

    // Max 5MB Validation
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Image size exceeds maximum limit of 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setPendingPhoto({
        file,
        previewUrl: e.target.result,
        name: file.name,
      });
      setShowCategoryModal(true);
    };
    reader.readAsDataURL(file);
  };

  const handleAssignCategory = (cat) => {
    if (!pendingPhoto) return;
    const newPhoto = {
      id: Date.now() + Math.random(),
      previewUrl: pendingPhoto.previewUrl,
      name: pendingPhoto.name,
      category: cat,
      badge: "Additional Standby",
    };
    setDraft((prev) => ({
      ...prev,
      photos: [...(prev.photos || []), newPhoto],
    }));
    setPendingPhoto(null);
    setShowCategoryModal(false);
  };

  const handleRemovePhoto = (photoId) => {
    setDraft((prev) => ({
      ...prev,
      photos: (prev.photos || []).filter((p) => p.id !== photoId),
    }));
  };

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

  const requiredKeys = [
    "representativeWork",
    "purpose",
    "situation",
    "cause",
    "hwAsWas",
    "hwAsIs",
    "swAsWas",
    "swAsIs",
    "priority",
    "category",
    "workedOn",
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    const nextErrors = {};
    requiredKeys.forEach((key) => {
      const val = draft[key];
      if (key === "purpose") {
        const workVal = draft.purpose || draft.work;
        if (!workVal || String(workVal).trim() === "") {
          nextErrors[key] = t("page.mp.requiredFieldError", "This field is required.");
        }
      } else if (val === undefined || val === null || String(val).trim() === "") {
        nextErrors[key] = t("page.mp.requiredFieldError", "This field is required.");
      }
    });

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }
    onSave(index, draft);
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-xs animate-fade-in"
        onMouseDown={onClose}
      >
        <form
          className="flex w-full max-w-2xl flex-col overflow-hidden rounded-[24px] bg-white dark:bg-gray-800 shadow-2xl border border-gray-100 dark:border-gray-700 max-h-[92vh]"
          onSubmit={handleSubmit}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="flex items-start justify-between gap-4 px-6 py-5 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-start gap-3">
              <span className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 shadow-sm">
                <i className="fas fa-plus" />
              </span>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Item Edit
                </h2>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  This is the Work Order item. The corporation and the completion date cannot be changed.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="w-8 h-8 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer shrink-0"
              onClick={onClose}
              aria-label={t("app.close")}
            >
              <i className="fas fa-times text-sm" />
            </button>
          </div>

          {/* Body Form */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-white dark:bg-gray-800">
            {/* Row 1: Process & Equipment Type (Read-Only) */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Process
                </label>
                <input
                  type="text"
                  value={draft.process ?? ""}
                  readOnly
                  disabled
                  className="w-full bg-[#f1f5f9] dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 rounded-xl px-3.5 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Equipment Type
                </label>
                <input
                  type="text"
                  value={draft.maintGroup ?? ""}
                  readOnly
                  disabled
                  className="w-full bg-[#f1f5f9] dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 rounded-xl px-3.5 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 cursor-not-allowed"
                />
              </div>
            </div>

            {/* Row 2: Representative Work Name * */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Representative Work Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={draft.representativeWork ?? ""}
                onChange={(e) => handleFieldChange("representativeWork", e.target.value)}
                className={`w-full bg-white dark:bg-gray-800 border rounded-xl px-3.5 py-2 text-sm text-gray-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all ${
                  errors.representativeWork ? "border-rose-500" : "border-gray-200 dark:border-gray-700"
                }`}
              />
              {errors.representativeWork && (
                <span className="mt-1 block text-[11px] font-semibold text-rose-500">
                  {errors.representativeWork}
                </span>
              )}
            </div>

            {/* Row 3: Purpose of the Work */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Purpose of the Work
              </label>
              <input
                type="text"
                value={draft.purpose ?? draft.work ?? ""}
                onChange={(e) => {
                  handleFieldChange("purpose", e.target.value);
                  handleFieldChange("work", e.target.value);
                }}
                className={`w-full bg-white dark:bg-gray-800 border rounded-xl px-3.5 py-2 text-sm text-gray-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all ${
                  errors.purpose || errors.work ? "border-rose-500" : "border-gray-200 dark:border-gray-700"
                }`}
              />
              {(errors.purpose || errors.work) && (
                <span className="mt-1 block text-[11px] font-semibold text-rose-500">
                  {errors.purpose || errors.work}
                </span>
              )}
            </div>

            {/* Row 4: Problem phenomenon * & Cause of the problem */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Problem phenomenon <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={draft.situation ?? ""}
                  onChange={(e) => handleFieldChange("situation", e.target.value)}
                  className={`w-full bg-white dark:bg-gray-800 border rounded-xl px-3.5 py-2 text-sm text-gray-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all ${
                    errors.situation ? "border-rose-500" : "border-gray-200 dark:border-gray-700"
                  }`}
                />
                {errors.situation && (
                  <span className="mt-1 block text-[11px] font-semibold text-rose-500">
                    {errors.situation}
                  </span>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Cause of the problem
                </label>
                <input
                  type="text"
                  value={draft.cause ?? ""}
                  onChange={(e) => handleFieldChange("cause", e.target.value)}
                  className={`w-full bg-white dark:bg-gray-800 border rounded-xl px-3.5 py-2 text-sm text-gray-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all ${
                    errors.cause ? "border-rose-500" : "border-gray-200 dark:border-gray-700"
                  }`}
                />
                {errors.cause && (
                  <span className="mt-1 block text-[11px] font-semibold text-rose-500">
                    {errors.cause}
                  </span>
                )}
              </div>
            </div>

            {/* Row 5: BOM & Material Name */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  BOM
                </label>
                <input
                  type="text"
                  placeholder="BOM Entry"
                  value={draft.bom ?? ""}
                  onChange={(e) => handleFieldChange("bom", e.target.value)}
                  className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3.5 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Material Name
                </label>
                <input
                  type="text"
                  placeholder="Enter material name"
                  value={draft.sparePart ?? ""}
                  onChange={(e) => handleFieldChange("sparePart", e.target.value)}
                  className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3.5 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Row 6: Before changing the hardware & After changing the hardware */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Before changing the hardware
                </label>
                <input
                  type="text"
                  value={draft.hwAsWas ?? ""}
                  onChange={(e) => handleFieldChange("hwAsWas", e.target.value)}
                  className={`w-full bg-white dark:bg-gray-800 border rounded-xl px-3.5 py-2 text-sm text-gray-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all ${
                    errors.hwAsWas ? "border-rose-500" : "border-gray-200 dark:border-gray-700"
                  }`}
                />
                {errors.hwAsWas && (
                  <span className="mt-1 block text-[11px] font-semibold text-rose-500">
                    {errors.hwAsWas}
                  </span>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  After changing the hardware
                </label>
                <input
                  type="text"
                  value={draft.hwAsIs ?? ""}
                  onChange={(e) => handleFieldChange("hwAsIs", e.target.value)}
                  className={`w-full bg-white dark:bg-gray-800 border rounded-xl px-3.5 py-2 text-sm text-gray-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all ${
                    errors.hwAsIs ? "border-rose-500" : "border-gray-200 dark:border-gray-700"
                  }`}
                />
                {errors.hwAsIs && (
                  <span className="mt-1 block text-[11px] font-semibold text-rose-500">
                    {errors.hwAsIs}
                  </span>
                )}
              </div>
            </div>

            {/* Row 7: Before Software Change & After the software change */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Before Software Change
                </label>
                <input
                  type="text"
                  value={draft.swAsWas ?? ""}
                  onChange={(e) => handleFieldChange("swAsWas", e.target.value)}
                  className={`w-full bg-white dark:bg-gray-800 border rounded-xl px-3.5 py-2 text-sm text-gray-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all ${
                    errors.swAsWas ? "border-rose-500" : "border-gray-200 dark:border-gray-700"
                  }`}
                />
                {errors.swAsWas && (
                  <span className="mt-1 block text-[11px] font-semibold text-rose-500">
                    {errors.swAsWas}
                  </span>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  After the software change
                </label>
                <input
                  type="text"
                  value={draft.swAsIs ?? ""}
                  onChange={(e) => handleFieldChange("swAsIs", e.target.value)}
                  className={`w-full bg-white dark:bg-gray-800 border rounded-xl px-3.5 py-2 text-sm text-gray-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all ${
                    errors.swAsIs ? "border-rose-500" : "border-gray-200 dark:border-gray-700"
                  }`}
                />
                {errors.swAsIs && (
                  <span className="mt-1 block text-[11px] font-semibold text-rose-500">
                    {errors.swAsIs}
                  </span>
                )}
              </div>
            </div>

            {/* Row 8: Importance & Types of effects */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Importance
                </label>
                <select
                  value={draft.priority ?? "Important"}
                  onChange={(e) => handleFieldChange("priority", e.target.value)}
                  className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3.5 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                >
                  <option value="Important">Important</option>
                  <option value="Normal">Normal</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Types of effects
                </label>
                <select
                  value={draft.category ?? "integrity"}
                  onChange={(e) => handleFieldChange("category", e.target.value)}
                  className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3.5 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                >
                  <option value="integrity">integrity</option>
                  <option value="Quality">Quality</option>
                  <option value="Productivity">Productivity</option>
                  <option value="Etc">Etc</option>
                </select>
              </div>
            </div>

            {/* Row 9: Date of Completion & Requesting Corporation */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Date of Completion
                </label>
                <input
                  type="text"
                  value={draft.workedOn ?? ""}
                  onChange={(e) => handleFieldChange("workedOn", e.target.value)}
                  className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3.5 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Requesting Corporation
                </label>
                <select
                  value={draft.site ?? "A3. Busan"}
                  onChange={(e) => handleFieldChange("site", e.target.value)}
                  className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3.5 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                >
                  <option value="A3. Busan">A3. Busan</option>
                  <option value="A1. Seoul">A1. Seoul</option>
                  <option value="A2. Gumi">A2. Gumi</option>
                </select>
              </div>
            </div>

            {/* Row 10: Metadata Stats Badges */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold py-1">
              <span className={`px-2.5 py-1 rounded-full transition-all ${problemCount > 0 ? "bg-blue-100 text-blue-700 font-bold" : "text-gray-600 dark:text-gray-400"}`}>
                Problem Phenomenon Chapter {problemCount}
              </span>
              <span className={`px-2.5 py-1 rounded-full transition-all ${afterCount > 0 ? "bg-emerald-100 text-emerald-700 font-bold" : "text-gray-600 dark:text-gray-400"}`}>
                {afterCount} Chapters After Improvement
              </span>
              <span className={`px-2.5 py-1 rounded-full transition-all ${equipCount > 0 ? "bg-blue-100 text-blue-700 font-bold" : "text-gray-600 dark:text-gray-400"}`}>
                Equipment Reference {equipCount} sheets
              </span>
              <span className={`px-2.5 py-1 rounded-full transition-all ${othersCount > 0 ? "bg-gray-200 text-gray-800 font-bold" : "text-gray-600 dark:text-gray-400"}`}>
                Others {othersCount} Cards
              </span>
            </div>

            {/* Row 11: Upload Dropzone Card */}
            <div
              className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl p-4 text-center bg-gray-50/50 dark:bg-gray-800/40 cursor-pointer hover:bg-gray-100/60 dark:hover:bg-gray-700/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleFileSelect(e.dataTransfer.files[0]);
                }
              }}
            >
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileSelect(e.target.files[0]);
                  }
                  e.target.value = "";
                }}
              />
              <div className="flex items-center justify-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                <i className="fas fa-cloud-upload-alt text-base text-gray-400" />
                <span>Drag or click to upload photos (automatically share to the same group items)</span>
              </div>
              {uploadError && (
                <p className="mt-1.5 text-xs font-semibold text-rose-500">{uploadError}</p>
              )}
            </div>

            {/* Uploaded Photo Preview Cards */}
            {photos.length > 0 && (
              <div className="flex flex-wrap gap-3 pt-2">
                {photos.map((photo) => (
                  <div
                    key={photo.id}
                    className="w-28 h-32 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 relative overflow-hidden flex flex-col shadow-xs group"
                  >
                    {/* Top Status Bar */}
                    <div className="bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 flex items-center justify-between shrink-0">
                      <span className="truncate">✓ Additional Standby</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemovePhoto(photo.id);
                        }}
                        className="hover:text-rose-200 transition-colors ml-1 cursor-pointer"
                        title="Remove photo"
                      >
                        <i className="fas fa-times text-[10px]" />
                      </button>
                    </div>

                    {/* Thumbnail Image */}
                    <div className="flex-1 bg-gray-900/5 dark:bg-gray-900/30 overflow-hidden relative flex items-center justify-center">
                      <img
                        src={photo.previewUrl}
                        alt={photo.name}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Bottom Category Overlay */}
                    <div className="bg-slate-800/90 text-white text-[10px] font-bold py-1 px-1 text-center shrink-0 truncate">
                      {photo.category}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 flex justify-between items-center">
            <button
              type="button"
              className="text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors cursor-pointer"
              onClick={onClose}
            >
              cancellation
            </button>
            <button
              type="submit"
              className="bg-[#1d4ed8] hover:bg-blue-700 text-white font-bold text-sm px-8 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <i className="fas fa-check text-xs" />
              Save
            </button>
          </div>
        </form>
      </div>

      {/* Select Photo Category Modal Pop-up */}
      {showCategoryModal && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in"
          onMouseDown={() => setShowCategoryModal(false)}
        >
          <div
            className="flex w-full max-w-md flex-col overflow-hidden rounded-[24px] bg-white dark:bg-gray-800 shadow-2xl border border-gray-100 dark:border-gray-700"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 px-6 py-5 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-start gap-3">
                <span className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center text-lg shrink-0">
                  <i className="fas fa-image" />
                </span>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    Select photo category
                  </h2>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    Select the category of the photo you want to upload
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="w-8 h-8 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer shrink-0"
                onClick={() => setShowCategoryModal(false)}
              >
                <i className="fas fa-times text-sm" />
              </button>
            </div>

            {/* Categories 2x2 Grid */}
            <div className="p-6 grid grid-cols-2 gap-3.5 bg-white dark:bg-gray-800">
              {/* Category 1: Problem phenomenon */}
              <button
                type="button"
                onClick={() => handleAssignCategory("Problem phenomenon")}
                className="flex flex-col items-center justify-center p-4 rounded-2xl border border-red-200 bg-red-50/70 hover:bg-red-100/80 text-red-600 font-bold text-xs transition-all shadow-xs gap-1.5 h-24 cursor-pointer"
              >
                <i className="fas fa-exclamation-triangle text-base" />
                <span className="text-center">Problem phenomenon</span>
              </button>

              {/* Category 2: After Improvements */}
              <button
                type="button"
                onClick={() => handleAssignCategory("After Improvements")}
                className="flex flex-col items-center justify-center p-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100/80 text-emerald-600 font-bold text-xs transition-all shadow-xs gap-1.5 h-24 cursor-pointer"
              >
                <i className="fas fa-check-circle text-base" />
                <span className="text-center">After Improvements</span>
              </button>

              {/* Category 3: Equipment Reference */}
              <button
                type="button"
                onClick={() => handleAssignCategory("Equipment Reference")}
                className="flex flex-col items-center justify-center p-4 rounded-2xl border border-blue-200 bg-blue-50/70 hover:bg-blue-100/80 text-blue-600 font-bold text-xs transition-all shadow-xs gap-1.5 h-24 cursor-pointer"
              >
                <i className="fas fa-cog text-base" />
                <span className="text-center">Equipment Reference</span>
              </button>

              {/* Category 4: Others */}
              <button
                type="button"
                onClick={() => handleAssignCategory("Others")}
                className="flex flex-col items-center justify-center p-4 rounded-2xl border border-gray-200 bg-gray-50/80 hover:bg-gray-100 text-gray-700 font-bold text-xs transition-all shadow-xs gap-1.5 h-24 cursor-pointer"
              >
                <i className="fas fa-ellipsis-h text-base" />
                <span className="text-center">Others</span>
              </button>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 flex justify-center">
              <button
                type="button"
                className="text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 transition-colors cursor-pointer"
                onClick={() => setShowCategoryModal(false)}
              >
                cancellation
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function ChangeHistory({ data, onUpload, onExport, onOpenDetail, searchText }) {
  const { t } = useI18n();
  const [selectedProcessId, setSelectedProcessId] = useState(null);
  const [selectedMaintenanceId, setSelectedMaintenanceId] = useState(null);
  const [selectedColumnIds, setSelectedColumnIds] = useState([]);
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

  const [isFiltering, setIsFiltering] = useState(false);
  const [debouncedSearchText, setDebouncedSearchText] = useState("");
  const [prevFilters, setPrevFilters] = useState({
    processId: null,
    maintenanceId: null,
    columnIds: [],
    filter: "",
    searchText: "",
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchText(filter || searchText || "");
    }, 400);
    return () => clearTimeout(timer);
  }, [filter, searchText]);

  const columnIdsKey = useMemo(
    () => [...selectedColumnIds].sort((a, b) => a - b).join(","),
    [selectedColumnIds],
  );
  const prevColumnIdsKey = useMemo(
    () => [...prevFilters.columnIds].sort((a, b) => a - b).join(","),
    [prevFilters.columnIds],
  );

  if (
    selectedProcessId !== prevFilters.processId ||
    selectedMaintenanceId !== prevFilters.maintenanceId ||
    columnIdsKey !== prevColumnIdsKey ||
    filter !== prevFilters.filter ||
    searchText !== prevFilters.searchText
  ) {
    setPrevFilters({
      processId: selectedProcessId,
      maintenanceId: selectedMaintenanceId,
      columnIds: selectedColumnIds,
      filter,
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

  // ── Filter option lists ───────────────────────────────────────────────────
  const processList = useMemo(() => {
    return (filterPayload?.process ?? []).filter((p) => p.isChangedData === true);
  }, [filterPayload]);

  const maintenanceList = useMemo(() => {
    const all = (filterPayload?.maintenance ?? []).filter((m) => m.isChangedData === true);
    if (!selectedProcessId) return all;
    return all.filter((m) => m.processId === selectedProcessId);
  }, [filterPayload, selectedProcessId]);

  const columnFilterOptions = useMemo(() => {
    return (changeDataColumns ?? [])
      .filter((col) => col.isActive !== false)
      .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
      .map((col) => ({
        label: col.columnNameKr || col.excelColumnNameKr || col.jsonKey,
        value: col.id,
      }));
  }, [changeDataColumns]);

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

  // ── Sorting & Pagination ──────────────────────────────────────────────────
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const handleSort = (colKey) => {
    setSortConfig((prev) => {
      if (prev.key !== colKey) return { key: colKey, direction: "asc" };
      if (prev.direction === "asc") return { key: colKey, direction: "desc" };
      return { key: null, direction: null };
    });
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedProcessId, selectedMaintenanceId, selectedColumnIds, filter, searchText, sortConfig]);

  const sortedFilteredData = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) return filtered;
    return [...filtered].sort((a, b) => {
      const valA = a[sortConfig.key] ?? "";
      const valB = b[sortConfig.key] ?? "";
      if (typeof valA === "number" && typeof valB === "number") {
        return sortConfig.direction === "asc" ? valA - valB : valB - valA;
      }
      const strA = String(valA);
      const strB = String(valB);
      return sortConfig.direction === "asc"
        ? strA.localeCompare(strB, undefined, { numeric: true, sensitivity: "base" })
        : strB.localeCompare(strA, undefined, { numeric: true, sensitivity: "base" });
    });
  }, [filtered, sortConfig]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedFilteredData.slice(start, start + pageSize);
  }, [sortedFilteredData, currentPage, pageSize]);

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
  }, [selectedProcessId, selectedMaintenanceId, selectedColumnIds, filter, searchText]);

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

  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleConfirmDelete = useCallback(() => {
    if (selectedIds.size === 0) return;

    const rowsToDelete = filtered.filter((_, i) => selectedIds.has(i));
    const idsToDelete = new Set(rowsToDelete.map((r) => r.id).filter((id) => id != null));

    const updatedRecords = changedRecords.filter((r) => !idsToDelete.has(r.id));
    const changeDataList = updatedRecords.map((r) => buildCleanRow(r));
    const payload = {
      changeDataList,
      id: changedDataId,
    };

    setOperationStatus({
      isVisible: true,
      status: "loading",
      message: `${rowsToDelete.length} ${t("app.rows", "건")} ${t("toast.deleting", "삭제 중입니다...")}`,
      autoClose: false,
    });

    if (isStaticDataMode) {
      setChangedRecords([...updatedRecords].sort((a, b) => (b.id ?? 0) - (a.id ?? 0)));
      setSelectedIds(new Set());
      setShowDeleteModal(false);
      setOperationStatus({
        isVisible: true,
        status: "success",
        message: `${rowsToDelete.length}${t("app.rows", "건")} - ${t("app.deleteSuccess", "항목이 성공적으로 삭제되었습니다.")}`,
        autoClose: true,
      });
      onUpload?.("change_rows", payload);
      return;
    }

    APIcallPost(pocEndPoints?.SAVE_DATA_CHANGES, payload, {}, (responseData, status) => {
      if (status === 200) {
        setChangedRecords([...updatedRecords].sort((a, b) => (b.id ?? 0) - (a.id ?? 0)));
        setSelectedIds(new Set());
        setShowDeleteModal(false);
        setOperationStatus({
          isVisible: true,
          status: "success",
          message: `${rowsToDelete.length}${t("app.rows", "건")} - ${t("app.deleteSuccess", "항목이 성공적으로 삭제되었습니다.")}`,
          autoClose: true,
        });
        onUpload?.("change_rows", payload);
        getFilterDataRef.current?.();
      } else {
        console.error("Delete failed:", responseData);
        setOperationStatus({
          isVisible: true,
          status: "error",
          message: t("toast.deleteError", "삭제에 실패했습니다."),
          autoClose: true,
        });
      }
    });
  }, [selectedIds, filtered, changedRecords, changedDataId, buildCleanRow, onUpload, t]);

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
  const prepareExportData = () => {
    const rowsToExport =
      selectedIds.size > 0 ? filtered.filter((_, i) => selectedIds.has(i)) : filtered;

    if (!rowsToExport || rowsToExport.length === 0) {
      return null;
    }

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

    return { rowsToExport, exportCols, exportData };
  };

  const handleExportCsv = async () => {
    const prepared = prepareExportData();
    if (!prepared) {
      setOperationStatus({
        isVisible: true,
        status: "error",
        message: t("toast.noRecordsExport"),
        autoClose: true,
      });
      return;
    }
    const { rowsToExport, exportCols, exportData } = prepared;
    setExportBusy(true);
    setOperationStatus({
      isVisible: true,
      status: "loading",
      message: `${rowsToExport.length} ${t("toast.exporting")}`,
      autoClose: false,
    });
    try {
      await withMinimumDelay(async () => {
        const worksheet = XLSX.utils.json_to_sheet(exportData, { header: exportCols });
        const csvContent = "\uFEFF" + XLSX.utils.sheet_to_csv(worksheet);
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", "change-history.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        setOperationStatus({
          isVisible: true,
          status: "success",
          message: `${rowsToExport.length} ${t("toast.exportSuccess")}`,
          autoClose: true,
        });
      });
    } catch (error) {
      console.error("CSV export failed:", error);
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

  const handleExportExcel = async () => {
    const prepared = prepareExportData();
    if (!prepared) {
      setOperationStatus({
        isVisible: true,
        status: "error",
        message: t("toast.noRecordsExport"),
        autoClose: true,
      });
      return;
    }
    const { rowsToExport, exportCols, exportData } = prepared;
    setExportBusy(true);
    setOperationStatus({
      isVisible: true,
      status: "loading",
      message: `${rowsToExport.length} ${t("toast.exporting")}`,
      autoClose: false,
    });
    try {
      await withMinimumDelay(async () => {
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

  const handleExportZip = async () => {
    const prepared = prepareExportData();
    if (!prepared) {
      setOperationStatus({
        isVisible: true,
        status: "error",
        message: t("toast.noRecordsExport"),
        autoClose: true,
      });
      return;
    }
    const { rowsToExport, exportCols, exportData } = prepared;
    setExportBusy(true);
    setOperationStatus({
      isVisible: true,
      status: "loading",
      message: `${rowsToExport.length} ${t("toast.exporting")}`,
      autoClose: false,
    });
    try {
      await withMinimumDelay(async () => {
        const worksheet = XLSX.utils.json_to_sheet(exportData, { header: exportCols });
        const csvContent = "\uFEFF" + XLSX.utils.sheet_to_csv(worksheet);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Change History");
        const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });

        const zip = new JSZip();
        zip.file("change-history.csv", csvContent);
        zip.file("change-history.xlsx", excelBuffer);
        const zipBlob = await zip.generateAsync({ type: "blob" });

        const url = URL.createObjectURL(zipBlob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", "change-history.zip");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        setOperationStatus({
          isVisible: true,
          status: "success",
          message: `${rowsToExport.length} ${t("toast.exportSuccess")}`,
          autoClose: true,
        });
      });
    } catch (error) {
      console.error("ZIP export failed:", error);
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

    // 1. Fetch Master Data for Filters
    APIcallGet(
      pocEndPoints?.GET_MASTER_DATA || "api/ChangeData/GetMasterData",
      {},
      (responseData, status) => {
        try {
          if (status === 200 && responseData) {
            const payload = responseData?.data || responseData;
            setFilterPayload(payload);
            setFilterError(null);
          } else {
            console.warn("[ChangeHistory] Master data API invalid status:", status);
          }
        } catch (error) {
          console.error("[ChangeHistory] Error parsing master data:", error);
        }
      }
    );

    // 2. Fetch Listing Data via POST GetChangedData
    const reqBody = {
      processId: selectedProcessId ? Number(selectedProcessId) : 0,
      equipmentTypeId: selectedMaintenanceId ? Number(selectedMaintenanceId) : 0,
      columnIds: Array.isArray(selectedColumnIds) && selectedColumnIds.length > 0 ? selectedColumnIds : [0],
      searchText: debouncedSearchText || "",
      rowCount: itemsPerPage || 10,
      currentPage: currentPage || 0,
    };

    APIcallPost(
      pocEndPoints?.GET_CHANGED_DATA || "api/ChangeData/GetChangedData",
      reqBody,
      {},
      (responseData, status) => {
        try {
          if (status === 200 && responseData) {
            const payload = responseData?.data || responseData;
            setFilterError(null);

            let records = [];
            if (Array.isArray(payload?.changedData)) {
              records = payload.changedData;
            } else if (Array.isArray(payload?.changedDataJson) && payload.changedDataJson.length > 0) {
              const envelope = payload.changedDataJson[0];
              setChangedDataId(envelope.id ?? 0);
              try {
                const parsed =
                  typeof envelope.content === "string"
                    ? JSON.parse(envelope.content)
                    : envelope.content;
                if (Array.isArray(parsed)) {
                  records = parsed;
                }
              } catch (e) {
                console.warn("[ChangeHistory] Failed to parse content string:", e);
              }
            }

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

            if (payload?.pagination?.totalCount !== undefined) {
              setTotalRecordsCount?.(payload.pagination.totalCount);
            }
          } else {
            console.warn("[ChangeHistory] GetChangedData returned invalid status:", status);
            setChangedRecords([]);
            setApiRecords([]);
            setFilterError(t("toast.filterLoadError"));
          }
        } catch (error) {
          console.error("[ChangeHistory] Error processing changed data:", error);
          setChangedRecords([]);
          setApiRecords([]);
          setFilterError(t("toast.filterError"));
        }
      }
    );
  }, [t, selectedProcessId, selectedMaintenanceId, selectedColumnIds, debouncedSearchText, currentPage, itemsPerPage]);

  useEffect(() => {
    getFilterDataRef.current = getFilterData;
  }, [getFilterData]);

  useEffect(() => {
    if (isStaticDataMode) {
      setChangeDataColumns(staticChangeDataColumns);
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
  }, []);

  useEffect(() => {
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

      <section className="flex-1 flex flex-col min-h-0 space-y-6">
        {/* Page header */}
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between relative z-50">
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
            <ExportDropdown
              onExportCsv={handleExportCsv}
              onExportExcel={handleExportExcel}
              onExportZip={handleExportZip}
              busy={exportBusy}
              selectedCount={selectedIds.size}
            />
          </div>
        </header>

        {/* Filters */}
        <div className="card relative z-20 p-4 mb-4">
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

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-600">
                {t("field.equipmentType", "Equipment Type")}
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
              <label className="text-sm font-medium text-gray-600">
                {t("field.columnFilter", "컬럼 필터")}
              </label>
              {filterLoading ? (
                <SelectSkeleton width="160px" />
              ) : (
                <div style={{ width: "160px" }}>
                  <MultiSelect
                    options={columnFilterOptions}
                    selectedValues={selectedColumnIds}
                    onChange={setSelectedColumnIds}
                    placeholder={t("app.all", "전체")}
                    t={t}
                    disabled={!selectedProcessId}
                    minWidth="160px"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-600">
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
              {selectedIds.size > 0 && (
                <button
                  type="button"
                  className="btn-base text-xs flex items-center gap-1.5 text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 font-medium px-3 py-1.5 rounded-lg transition-colors"
                  onClick={() => setShowDeleteModal(true)}
                  style={{ minHeight: "38px", padding: "8px 16px" }}
                >
                  <i className="fas fa-trash-alt text-red-500" />
                  {t("app.deleteSelected", "선택 삭제")} ({selectedIds.size})
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Data table */}
        <div className="card flex-1 min-h-0 flex flex-col overflow-hidden">
          {selectedProcessId === null ? (
            <div className="flex-grow flex flex-col items-center justify-center gap-4 p-10 text-center">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#ecf2ff] text-[#4f46e5] text-4xl">
                <i className="fas fa-history" />
              </div>
              <h2 className="text-xl font-bold text-gray-800">
                {t("landing.selectProcessAndMaint")}
              </h2>
              <p className="text-sm text-gray-400 max-w-md">
                {t("landing.selectProcessAndMaintDesc")}
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
            <div className="flex-grow flex flex-col items-center justify-center gap-3 p-10 text-center text-text-subtle">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-10 text-brand-60 text-3xl">
                <i className="fas fa-history" />
              </div>
              <h2 className="text-xl font-bold text-text-default">
                {t("empty.noMatch")}
              </h2>
              <p>{t("empty.hint")}</p>
            </div>
          ) : (
            <div className="overflow-auto flex-1 min-h-0">
              <table className="min-w-full text-left text-sm">
                <thead className="table-header sticky top-0 z-[1]">
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
                      <SortableTh
                        key={col}
                        columnKey={col}
                        label={t(COLUMN_LABEL_KEYS[col] ?? `field.${col}`, col)}
                        sortConfig={sortConfig}
                        onSort={handleSort}
                      />
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((row, index) => {
                    const originalIndex = filtered.indexOf(row);
                    const idxToUse = originalIndex !== -1 ? originalIndex : index;
                    return (
                      <EditableRow
                        key={rowKey(row, idxToUse)}
                        row={row}
                        index={idxToUse}
                        columns={dynamicColumns}
                        isEditing={false}
                        onStartEdit={setEditingIndex}
                        onSave={handleSaveRow}
                        onCancel={handleCancelEdit}
                        onOpenDetail={onOpenDetail}
                        isSelected={selectedIds.has(idxToUse)}
                        onToggleSelect={toggleSelect}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination bar */}
          {selectedProcessId !== null && filtered.length > 0 && (
            <Pagination
              currentPage={currentPage}
              pageSize={pageSize}
              totalItems={sortedFilteredData.length}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
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

      {/* Delete Confirmation Modal */}
      <Modal
        open={showDeleteModal}
        title={t("app.deleteConfirmTitle", "선택 항목 삭제")}
        description={`${selectedIds.size}${t("app.rows", "건")} ${t("app.deleteConfirmDesc", "선택한 항목을 삭제하시겠습니까?")}`}
        titleIcon={<i className="fas fa-exclamation-triangle text-red-500 text-xl" />}
        onClose={() => setShowDeleteModal(false)}
        footer={
          <button
            type="button"
            className="btn-base"
            style={{ background: "#dc2626", color: "#ffffff", border: "none", padding: "8px 18px" }}
            onClick={handleConfirmDelete}
          >
            <i className="fas fa-trash-alt mr-1.5" />
            {t("app.delete", "삭제")}
          </button>
        }
      >
        <div className="py-2 text-sm text-gray-600 dark:text-gray-300">
          <p>{t("app.deleteWarning", "선택한 데이터가 삭제되며 시스템에 즉시 반영됩니다. 계속하시겠습니까?")}</p>
        </div>
      </Modal>

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
