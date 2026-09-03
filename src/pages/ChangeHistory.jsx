import { useMemo, useState, useRef, useCallback, useEffect, forwardRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import AnimatedActionButton from "../components/AnimatedActionButton.jsx";
import { OperationStatus } from "../components/OperationStatus.jsx";
import { withMinimumDelay } from "../utils/actionTiming.js";
import { pocEndPoints } from "../axios/endPoints.js";
import { getUserInfo, getUserDisplayName } from "../utils/cookieUtils.js";
import { APIcallGet, APIcallPost, APIcallPostFile } from "../axios/apiCall.js";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import ExportDropdown from "../components/ExportDropdown.jsx";
import Pagination from "../components/Pagination.jsx";
import SortableTh from "../components/SortableTh.jsx";
import Modal from "../components/Modal.jsx";
import Drawer from "../components/Drawer.jsx";
import { useI18n } from "../i18n.jsx";
import { isStaticDataMode, isLoadTableDataOnload } from "../utils/staticDataMode.js";
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

function getEquipmentTypeLabel(item) {
  return (
    item?.eqTypeName ??
    item?.equipmentTypeName ??
    item?.typeName ??
    item?.maintenanceGroupName ??
    String(item?.id ?? "")
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function excelSerialToDate(serial) {
  if (serial === null || serial === undefined || serial === "") return "";
  if (typeof serial === "string" && serial.includes("-")) return serial;
  const num = Number(serial);
  if (isNaN(num) || num <= 0) return "";
  const ms = Math.round((num - 25569) * 86400 * 1000);
  const date = new Date(ms);
  if (isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
}

function getFormattedDateString(raw) {
  if (!raw) return "";
  const dateStr = excelSerialToDate(raw);
  if (!dateStr) return "";
  return dateStr.slice(0, 10);
}

function buildExcelToJsonKeyMap(columnDefs) {
  const list = Array.isArray(columnDefs)
    ? columnDefs
    : Array.isArray(columnDefs?.data)
      ? columnDefs.data
      : [];
  const map = list.reduce((acc, col) => {
    if (col.excelColumnName && col.jsonKey) {
      acc[col.excelColumnName.trim()] = col.jsonKey;
    }
    return acc;
  }, {});
  // Ensure both eqname and equipment_name aliases map to equipmentName
  if (!map["equipment_name"]) map["equipment_name"] = "equipmentName";
  if (!map["equipmentName"]) map["equipmentName"] = "equipmentName";
  if (!map["eqname"]) map["eqname"] = "equipmentName";
  if (!map["Eqname"]) map["Eqname"] = "equipmentName";
  if (!map["equipment_code"]) map["equipment_code"] = "equipmentCode";
  if (!map["equipmentCode"]) map["equipmentCode"] = "equipmentCode";
  if (!map["eqcode"]) map["eqcode"] = "equipmentCode";
  if (!map["Eqcode"]) map["Eqcode"] = "equipmentCode";
  return map;
}

function remapRowKeys(row, excelToJsonKey, validKeys = null) {
  return Object.entries(row).reduce((acc, [key, value]) => {
    const trimmedKey = key.trim();
    const mappedKey = excelToJsonKey[trimmedKey] ?? trimmedKey;
    const lowerMapped = mappedKey.toLowerCase();
    const lowerTrimmed = trimmedKey.toLowerCase();
    if (
      !validKeys ||
      validKeys.has(lowerTrimmed) ||
      validKeys.has(lowerMapped) ||
      mappedKey === "id" ||
      lowerMapped === "equipmentname" ||
      lowerMapped === "equipment_name" ||
      lowerMapped === "eqname" ||
      lowerTrimmed === "equipmentname" ||
      lowerTrimmed === "equipment_name" ||
      lowerTrimmed === "eqname" ||
      lowerTrimmed === "설비명" ||
      lowerMapped === "equipmentcode" ||
      lowerMapped === "equipment_code" ||
      lowerMapped === "eqcode" ||
      lowerTrimmed === "equipmentcode" ||
      lowerTrimmed === "equipment_code" ||
      lowerTrimmed === "eqcode" ||
      lowerTrimmed === "설비코드" ||
      lowerMapped === "wotype" ||
      lowerMapped === "wotypeid" ||
      lowerTrimmed === "wotype" ||
      lowerTrimmed === "wo type" ||
      lowerTrimmed === "wo_type" ||
      lowerTrimmed === "wotypeid" ||
      lowerTrimmed === "wo유형" ||
      lowerMapped === "sparepart" ||
      lowerMapped === "spare_part" ||
      lowerTrimmed === "sparepart" ||
      lowerTrimmed === "spare part" ||
      lowerTrimmed === "spare_part" ||
      lowerTrimmed === "자재명" ||
      lowerTrimmed === "자재 명"
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

function extractChangedRecords(payload) {
  if (Array.isArray(payload?.changedData)) {
    return payload.changedData;
  }
  if (Array.isArray(payload?.data?.changedData)) {
    return payload.data.changedData;
  }
  if (Array.isArray(payload?.data)) {
    return payload.data;
  }
  if (Array.isArray(payload?.changedDataJson) && payload.changedDataJson.length > 0) {
    const envelope = payload.changedDataJson[0];
    try {
      const parsed =
        typeof envelope.content === "string" ? JSON.parse(envelope.content) : envelope.content;
      if (Array.isArray(parsed)) return parsed;
      if (Array.isArray(parsed?.changedData)) return parsed.changedData;
      if (Array.isArray(parsed?.data?.changedData)) return parsed.data.changedData;
    } catch {
      // ignore parse errors
    }
  }
  return [];
}

function parseTotalCountFromResponse(responseData, payload, rowsLength, currentPage, pageSize) {
  const candidates = [
    payload?.pagination?.totalCount,
    responseData?.data?.pagination?.totalCount,
    responseData?.totalCount,
    responseData?.totalRecords,
    responseData?.totalRows,
    responseData?.recordCount,
    payload?.totalCount,
    payload?.totalRecords,
    payload?.totalRows,
    payload?.recordCount,
    responseData?.data?.totalCount,
    payload?.data?.totalCount,
  ];
  for (const val of candidates) {
    const num = Number(val);
    if (!Number.isNaN(num) && num >= 0) return num;
  }
  const page = currentPage || 1;
  const size = pageSize || 10;
  if (rowsLength === size) {
    return page * size + rowsLength;
  }
  return (page - 1) * size + rowsLength;
}

function parseMatrixDetailResponse(responseData) {
  const payload = responseData?.data ?? responseData;
  if (!payload || typeof payload !== "object") return null;
  if (Array.isArray(payload)) return payload;
  if (payload.matrixData && typeof payload.matrixData === "object") {
    return payload.matrixData;
  }
  if (payload.changeData && typeof payload.changeData === "object") {
    return payload.changeData;
  }
  return payload;
}

// Map MatrixInquiryResponse snake_case fields to frontend camelCase fields
const matrixResponseToRowMap = {
  change_history_id: "id",
  report_content: "report",
  representative_work_name: "representativeWork",
  work_name: "representativeWork",
  purpose: "purpose",
  situation: "situation",
  cause: "cause",
  hw_was: "hwAsWas",
  hw_is: "hwAsIs",
  sw_was: "swAsWas",
  sw_is: "swAsIs",
  category_name: "category",
  priority_name: "priority",
  process_name: "process",
  equipment_type_name: "maintGroup",
  site_name: "site",
  maintenance_group_name: "maintGroup",
  bom: "bom",
  spare_part: "sparePart",
  wo_code: "wOCode",
  work: "work",
  created_by: "createdBy",
  updated_by: "modifiedBy",
  equipment_code: "equipmentCode",
  equipment_name: "equipmentName",
  work_date: "workedOn",
  rep_work_id: "repWorkId",
  category_id: "categoryId",
  priority_id: "priorityId",
  process_id: "processId",
  site_id: "siteId",
  equipment_type_id: "equipmentTypeId",
  equipment_id: "equipmentId",
  work_order_type_id: "woTypeId",
  work_order_type_name: "woType",
  created_at: "createdAt",
  updated_at: "updatedAt",
};

function mapMatrixResponseToRow(detail) {
  if (!detail) return null;
  const mapped = { ...detail };
  const woVal =
    detail.wo_code ??
    detail.woCode ??
    detail.wOCode ??
    detail["w/ocode"] ??
    detail["W/Ocode"] ??
    "";
  if (woVal) {
    mapped.woCode = woVal;
    mapped.wOCode = woVal;
    mapped.wo_code = woVal;
  }
  Object.entries(detail).forEach(([key, value]) => {
    const mappedKey = matrixResponseToRowMap[key] ?? key;
    mapped[mappedKey] = value;
  });
  return mapped;
}

function rowKey(row, index) {
  return `${index}__${row.id ?? ""}__${row.equipmentCode ?? ""}__${
    row.work ?? row.representativeWork ?? ""
  }`;
}

function getMissingMandatoryFields(row, columns, columnDefs) {
  if (!row || typeof row !== "object") return [];

  const list = Array.isArray(columnDefs)
    ? columnDefs
    : Array.isArray(columnDefs?.data)
      ? columnDefs.data
      : [];

  const missing = [];

  const FIELD_ALIAS_GROUPS = {
    site: ["site", "sitename", "site_name", "corporation", "법인"],
    process: ["process", "processname", "process_name", "공정"],
    maintgroup: [
      "maintgroup",
      "maint_group",
      "equipment",
      "equipment type",
      "equipmenttype",
      "equipment_type",
      "eqtype",
      "eq type",
      "보전파트",
      "보전그룹",
      "보전part",
    ],
    equipmentcode: [
      "equipmentcode",
      "equipment_code",
      "equipment code",
      "eqcode",
      "eq_code",
      "설비코드",
    ],
    equipmentname: [
      "equipmentname",
      "equipment_name",
      "equipment name",
      "eqname",
      "eq_name",
      "설비명",
    ],
    representativework: [
      "representativework",
      "representative_work",
      "representative work",
      "rep_work",
      "repwork",
      "rep work",
      "대표 작업명",
      "대표작업명",
    ],
    priority: ["priority", "priorityname", "priority_name", "중요도", "우선순위"],
    category: ["category", "categoryname", "category_name", "effecttype", "효과 유형", "효과유형", "구분"],
  };

  const isValueValid = (val) => {
    if (val === undefined || val === null) return false;
    const strVal = String(val).trim().toLowerCase();
    return (
      strVal !== "" &&
      strVal !== "required" &&
      strVal !== "[required]" &&
      strVal !== "필수"
    );
  };

  const getGroupValidValue = (aliases) => {
    for (const alias of aliases) {
      const targetLower = alias.toLowerCase();
      const matchedKey = Object.keys(row).find(
        (k) => k.trim().toLowerCase() === targetLower,
      );
      if (matchedKey !== undefined) {
        const val = row[matchedKey];
        if (isValueValid(val)) {
          return String(val).trim();
        }
      }
    }
    return null;
  };

  const checkedGroups = new Set();

  if (list.length > 0) {
    list.forEach((col) => {
      const excelName = col.excelColumnName?.trim().toLowerCase();
      const jsonKey = col.jsonKey?.trim().toLowerCase();
      const krName = col.columnNameKr?.trim().toLowerCase();

      const groupEntry = Object.entries(FIELD_ALIAS_GROUPS).find(
        ([gk, aliases]) =>
          gk === jsonKey ||
          gk === excelName ||
          aliases.includes(jsonKey) ||
          aliases.includes(excelName) ||
          aliases.includes(krName),
      );

      const isMandatory =
        col.isMandatory === true ||
        Boolean(groupEntry && (groupEntry[0] === "equipmentname" || groupEntry[0] === "equipmentcode" || groupEntry[0] === "site" || groupEntry[0] === "process" || groupEntry[0] === "maintgroup" || groupEntry[0] === "representativework" || groupEntry[0] === "priority" || groupEntry[0] === "category"));

      if (isMandatory) {
        if (groupEntry) {
          const [groupKey, aliases] = groupEntry;
          if (checkedGroups.has(groupKey)) return;
          checkedGroups.add(groupKey);

          // Check if any alias column was present in columns/detectedColumns or row
          const hasCol = Object.keys(row).some((k) =>
            aliases.includes(k.trim().toLowerCase()),
          );
          if (!hasCol) return;

          const validVal = getGroupValidValue(aliases);
          if (!validVal) {
            missing.push(col.excelColumnName || col.columnNameKr || col.jsonKey || groupKey);
          }
        } else {
          // Custom column
          const matchedKey = Object.keys(row).find((k) => {
            const lk = k.trim().toLowerCase();
            return lk === excelName || lk === jsonKey || lk === krName;
          });
          if (matchedKey !== undefined) {
            if (!isValueValid(row[matchedKey])) {
              missing.push(col.excelColumnName || col.columnNameKr || col.jsonKey);
            }
          }
        }
      }
    });
  } else {
    // Fallback if list is empty
    Object.entries(FIELD_ALIAS_GROUPS).forEach(([groupKey, aliases]) => {
      const hasCol = Object.keys(row).some((k) =>
        aliases.includes(k.trim().toLowerCase()),
      );
      if (hasCol) {
        const validVal = getGroupValidValue(aliases);
        if (!validVal) {
          missing.push(groupKey);
        }
      }
    });
  }

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
function MultiSelect({
  options,
  selectedValues,
  onChange,
  placeholder,
  t,
  disabled,
  minWidth = "120px",
}) {
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
          background: disabled
            ? "var(--surface-strong, #f8f9fb)"
            : "var(--surface-default, #ffffff)",
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
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 12px",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  disabled={disabled}
                  onChange={() => handleToggleOption(opt.value)}
                  className="rounded border-border-base text-brand-60 focus:ring-brand-50"
                  style={{
                    accentColor: "var(--brand-60, #0f62fe)",
                    cursor: disabled ? "not-allowed" : "pointer",
                  }}
                />
                <span className="whitespace-nowrap" style={{ fontSize: "13px" }}>
                  {opt.label}
                </span>
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
      className="select-skeleton"
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
function TableSkeleton({
  rowsCount = 8,
  columns = [],
  t,
  getColumnHeaderLabel,
  COLUMN_LABEL_KEYS = {},
}) {
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
                {getColumnHeaderLabel
                  ? getColumnHeaderLabel(col)
                  : t(COLUMN_LABEL_KEYS[col] ?? `field.${col}`, col)}
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
function EditableCell({
  value,
  isEditing,
  col,
  onChange,
  duplicate = false,
  isEmptyMandatory = false,
}) {
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
              : value == null || value === ""
                ? "var(--color-text-subtle, #9ca3af)"
                : "var(--color-text-default, #111827)",
          fontWeight: duplicate || isEmptyMandatory ? 700 : undefined,
        }}
        title={String(value ?? "")}
      >
        {value == null || value === ""
          ? isEmptyMandatory
            ? t("preview.required", "Required")
            : "-"
          : col === "workedOn" && value
            ? (() => {
                const valStr = String(value).trim();
                if (valStr.includes("T")) return valStr.split("T")[0];
                if (/^\d{4}-\d{2}-\d{2}/.test(valStr)) return valStr.slice(0, 10);
                const d = new Date(value);
                return !isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : valStr;
              })()
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
    [editingCell, index],
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

  const isMandatoryField = useCallback(
    (colKey) => {
      const lk = colKey.trim().toLowerCase();
      // Check ALWAYS_MANDATORY_KEYS first
      const ALWAYS_MANDATORY = [
        "eqtype",
        "equipmenttype",
        "equipment_type",
        "equipment type",
        "site",
        "process",
        "equipmentcode",
        "equipment_code",
        "equipment code",
        "equipmentname",
        "equipment_name",
        "equipment name",
        "equipment",
        "maintgroup",
        "maint_group",
        "representativework",
        "representative_work",
        "representative work",
        "rep_work",
        "rep work",
      ];
      if (ALWAYS_MANDATORY.includes(lk)) return true;
      if (!columnDefs) return false;
      const colDef = columnDefs.find(
        (c) =>
          c.excelColumnName?.trim().toLowerCase() === lk ||
          c.jsonKey?.trim().toLowerCase() === lk ||
          c.columnNameKr?.trim().toLowerCase() === lk,
      );
      return colDef?.isMandatory === true;
    },
    [columnDefs],
  );

  const handleSave = useCallback(
    (e) => {
      e?.stopPropagation();
      const updatedRow = { ...row, ...draft };
      const eqNameVal =
        updatedRow.Eqname ?? updatedRow.eqname ?? updatedRow.equipment_name ?? updatedRow.equipmentName ?? updatedRow["설비명"];
      if (eqNameVal !== undefined) {
        updatedRow.Eqname = eqNameVal;
        updatedRow.eqname = eqNameVal;
        updatedRow.equipment_name = eqNameVal;
        updatedRow.equipmentName = eqNameVal;
      }
      const eqCodeVal =
        updatedRow.Eqcode ?? updatedRow.eqcode ?? updatedRow.equipment_code ?? updatedRow.equipmentCode ?? updatedRow["설비코드"];
      if (eqCodeVal !== undefined) {
        updatedRow.Eqcode = eqCodeVal;
        updatedRow.eqcode = eqCodeVal;
        updatedRow.equipment_code = eqCodeVal;
        updatedRow.equipmentCode = eqCodeVal;
      }
      onSave(index, updatedRow);
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
    return getMissingMandatoryFields(row, columns, columnDefs).length > 0;
  }, [row, columns, columnDefs]);

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
        <span
          style={{
            color: isDuplicate ? "#dc2626" : "inherit",
            fontWeight: isDuplicate ? 700 : undefined,
          }}
        >
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
        const strVal = val != null ? String(val).trim().toLowerCase() : "";
        const isEmptyMandatory =
          isMandatoryField(col) &&
          (val === undefined ||
            val === null ||
            strVal === "" ||
            strVal === "required" ||
            strVal === "[required]" ||
            strVal === "필수");
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
                  boxShadow:
                    "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
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
export function extractDuplicateKeysFromBackend(responseData, rows, getDuplicateKey) {
  const dupes =
    responseData?.duplicateKey ||
    responseData?.duplicateKeys ||
    responseData?.duplicates ||
    responseData?.duplicateData ||
    responseData?.duplicateRecords ||
    responseData?.duplicateList ||
    responseData?.key ||
    (responseData?.hasDuplicates
      ? responseData?.duplicates || responseData?.message || true
      : null);

  if (!dupes) return new Set();

  const keySet = new Set();
  const dupList = Array.isArray(dupes) ? dupes : [dupes];

  dupList.forEach((dupItem) => {
    if (typeof dupItem === "string" || typeof dupItem === "number") {
      const strItem = String(dupItem).trim().toLowerCase();
      rows.forEach((row, idx) => {
        const key = getDuplicateKey ? getDuplicateKey(row) : "";
        const rowString = JSON.stringify(row).toLowerCase();
        if ((key && key.toLowerCase().includes(strItem)) || rowString.includes(strItem)) {
          keySet.add(key || row._originalIndex || idx);
        }
      });
    } else if (typeof dupItem === "object" && dupItem !== null) {
      rows.forEach((row, idx) => {
        const rowKey = getDuplicateKey ? getDuplicateKey(row) : (row._originalIndex ?? idx);
        let isMatch = false;
        if (dupItem.id && row.id === dupItem.id) isMatch = true;
        if (
          dupItem.equipmentCode &&
          (row.equipmentCode === dupItem.equipmentCode ||
            row.equipment_code === dupItem.equipmentCode)
        )
          isMatch = true;
        if (dupItem.woCode && (row.woCode === dupItem.woCode || row.wo_code === dupItem.woCode))
          isMatch = true;
        if (isMatch) {
          keySet.add(rowKey);
        }
      });
    }
  });

  if (keySet.size === 0 && rows.length > 0) {
    rows.forEach((row, idx) => {
      const key = getDuplicateKey ? getDuplicateKey(row) : (row._originalIndex ?? idx);
      keySet.add(key);
    });
  }

  return keySet;
}
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
  const [serverDuplicateKeys, setServerDuplicateKeys] = useState(new Set());
  const [hasServerDuplicates, setHasServerDuplicates] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
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
    setServerDuplicateKeys(new Set());
    setHasServerDuplicates(false);
    setIsSaving(false);
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
        const isEmptyRow = Object.values(parsedKey).every(
          (v) => v === undefined || v === null || String(v).trim() === "",
        );
        if (isEmptyRow) return false;
      } catch (e) {
        // Safe fallback
      }

      if (serverDuplicateKeys.has(key) || serverDuplicateKeys.has(row._originalIndex)) return true;
      if (hasServerDuplicates && duplicateRowKeys.has(key)) return true;
      return false;
    },
    [duplicateRowKeys, getDuplicateKey, serverDuplicateKeys, hasServerDuplicates],
  );

  const duplicateCount = useMemo(
    () => rows.filter((row) => isDuplicateRow(row)).length,
    [rows, isDuplicateRow],
  );

  const getRowMissingMandatoryFields = useCallback(
    (row) => {
      return getMissingMandatoryFields(row, detectedColumns, columnDefs);
    },
    [detectedColumns, columnDefs],
  );

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
    const syncedPayload = { ...payload };
    const eqNameVal =
      payload.Eqname ?? payload.eqname ?? payload.equipment_name ?? payload.equipmentName ?? payload["설비명"];
    if (eqNameVal !== undefined) {
      syncedPayload.Eqname = eqNameVal;
      syncedPayload.eqname = eqNameVal;
      syncedPayload.equipment_name = eqNameVal;
      syncedPayload.equipmentName = eqNameVal;
    }
    const eqCodeVal =
      payload.Eqcode ?? payload.eqcode ?? payload.equipment_code ?? payload.equipmentCode ?? payload["설비코드"];
    if (eqCodeVal !== undefined) {
      syncedPayload.Eqcode = eqCodeVal;
      syncedPayload.eqcode = eqCodeVal;
      syncedPayload.equipment_code = eqCodeVal;
      syncedPayload.equipmentCode = eqCodeVal;
    }

    setRows((prev) => {
      const next = [...prev];
      const realIndex = next.findIndex((r) => r._originalIndex === originalIndex);
      if (realIndex !== -1) {
        next[realIndex] = syncedPayload;
        updatePreviewRow(realIndex, syncedPayload).catch(console.error);
      }
      return next;
    });
    setEditingCell(null);
  }, []);

  const handleCancelEdit = useCallback(() => setEditingCell(null), []);

  const handleDeleteRow = useCallback(
    (filteredIndex) => {
      const rowToDelete = filteredRows[filteredIndex];
      if (!rowToDelete) return;
      const originalIndex = rowToDelete._originalIndex;

      setRows((prev) => {
        const realIndex = prev.findIndex((r) => r._originalIndex === originalIndex);
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
    },
    [filteredRows],
  );

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
    try {
      // Use rows state directly (always up-to-date) instead of IndexedDB
      const currentRows = rows;

      const missingRowsInfo = [];
      for (let i = 0; i < currentRows.length; i++) {
        const missingFields = getMissingMandatoryFields(
          currentRows[i],
          detectedColumns,
          columnDefs,
        );
        if (missingFields.length > 0) {
          const fieldNames = missingFields
            .map((col) => t(COLUMN_LABEL_KEYS[col] ?? `field.${col}`, col))
            .join(", ");
          missingRowsInfo.push({ rowNum: i + 1, fields: fieldNames });
        }
      }

      if (missingRowsInfo.length > 0) {
        setFilterType("missing");
        const details = missingRowsInfo
          .slice(0, 5)
          .map((r) => `Row ${r.rowNum}: [${r.fields}]`)
          .join("\n");
        const overflow =
          missingRowsInfo.length > 5 ? `\n...and ${missingRowsInfo.length - 5} more record(s)` : "";
        alert(
          `${t("preview.missingRecordsNotice", "Mandatory fields missing in uploaded records:")}\n\n${details}${overflow}\n\n${t("preview.pleaseFillMissing", "Please fill in all mandatory fields before saving.")}`,
        );
        return;
      }

      setIsSaving(true);
      if (onConfirm) {
        onConfirm(currentRows, (res) => {
          setIsSaving(false);
          if (res?.success) {
            clearPreviewRows().catch(console.error);
            onClose();
          } else if (res?.hasDuplicates) {
            setHasServerDuplicates(true);
            setServerDuplicateKeys(res.duplicateKeys || new Set());
            setFilterType("duplicate");
            alert(
              t(
                "preview.backendDuplicatesNotice",
                "Backend API detected duplicate records. Duplicates filter is now showing.",
              ),
            );
          } else if (res?.hasValidationError) {
            setFilterType("missing");
            alert(res.message || "Validation error occurred on save.");
          } else if (res?.message) {
            alert(res.message);
          }
        });
      } else {
        await clearPreviewRows();
        onClose();
      }
    } catch (error) {
      console.error("Failed to read confirmed rows from IndexedDB:", error);
      setIsSaving(false);
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
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)" }}
    >
      <div
        className="relative flex flex-col rounded-2xl shadow-2xl overflow-hidden"
        style={{
          background: "var(--color-surface-default, #fff)",
          border: "1px solid var(--color-border-base, #e5e7eb)",
          width: "min(96vw, 1600px)",
          maxWidth: "96vw",
          maxHeight: "88vh",
        }}
      >
        {/* Saving Overlay */}
        {isSaving && (
          <div
            className="absolute inset-0 z-50 flex flex-col items-center justify-center"
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.85)",
              backdropFilter: "blur(2px)",
            }}
          >
            <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white dark:bg-gray-800 shadow-2xl border border-gray-200 dark:border-gray-700">
              <i className="fas fa-spinner fa-spin text-3xl text-blue-600 dark:text-blue-400" />
              <div className="text-center">
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                  {t("toast.saving", "Saving data...")}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {t("toast.savingWait", "Please wait while the changes are being saved.")}
                </p>
              </div>
            </div>
          </div>
        )}
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
                {t("preview.total")}{" "}
                <span className="font-semibold">
                  {rows.length}
                  {t("preview.row")}
                </span>
                {" · "}
                {detectedColumns.length}
                {t("preview.subtitle")}
                {hasServerDuplicates && duplicateCount > 0 && (
                  <span className="ml-2 font-bold text-red-600">{duplicateCount} duplicates</span>
                )}
                {missingMandatoryCount > 0 && (
                  <span className="ml-2 font-bold text-red-600">
                    {missingMandatoryCount}
                    {t("preview.missingRequired")}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Filters Segmented Control */}
            <div className="toggle-group text-xs">
              <button
                type="button"
                onClick={() => setFilterType("all")}
                className={`toggle-btn ${filterType === "all" ? "active" : ""}`}
              >
                {t("preview.filterAll", "전체")} ({rows.length})
              </button>
              {(hasServerDuplicates || serverDuplicateKeys.size > 0) && (
                <button
                  type="button"
                  onClick={() => setFilterType("duplicate")}
                  className={`toggle-btn ${filterType === "duplicate" ? "active" : ""}`}
                  style={filterType === "duplicate" ? { color: "#dc2626" } : undefined}
                >
                  {t("preview.filterDuplicate", "중복")} ({duplicateCount})
                </button>
              )}
              <button
                type="button"
                onClick={() => setFilterType("missing")}
                className={`toggle-btn ${filterType === "missing" ? "active" : ""}`}
                style={filterType === "missing" ? { color: "#ea580c" } : undefined}
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
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-3.5 shrink-0"
          style={{
            borderTop: "1px solid var(--color-border-base, #e5e7eb)",
            background: "var(--color-surface-raised, #f9fafb)",
          }}
        >
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold font-mono bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shadow-2xs">
              <i className="fas fa-layer-group text-xs text-blue-500" />
              <span>
                Loaded: {rows.length} / Total: {initialRows ? initialRows.length : rows.length} rows
              </span>
            </span>
            <p className="text-xs hidden md:block" style={{ color: "var(--color-text-subtle, #6b7280)" }}>
              <i className="fas fa-info-circle mr-1" />
              {hasServerDuplicates && duplicateCount > 0
                ? "Duplicate rows are marked red. Delete them before saving if needed."
                : t("preview.tip")}
            </p>
          </div>
          <div className="flex gap-3">
            {hasServerDuplicates && duplicateCount > 0 && (
              <button
                type="button"
                onClick={handleRemoveDuplicates}
                className="btn-base btn-secondary text-red-700 cursor-pointer"
              >
                <i className="fas fa-trash-alt mr-1.5" />
                Remove duplicates ({duplicateCount})
              </button>
            )}
            <button
              type="button"
              onClick={handleClose}
              disabled={isSaving}
              className="btn-base btn-secondary cursor-pointer"
            >
              <i className="fas fa-times mr-1.5" />
              {t("app.cancel")}
            </button>
            {onConfirm && rows.length > 0 && (
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isSaving}
                className="btn-base btn-primary min-w-[120px] justify-center cursor-pointer"
              >
                {isSaving ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-1.5" />
                    {t("app.saving", "Saving...")}
                  </>
                ) : (
                  <>
                    <i className="fas fa-check mr-1.5" />
                    {t("preview.saveCount").replace("{count}", rows.length)}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function getTableRowValue(row, col) {
  if (!row) return "";
  const keyStr = String(col || "").trim();
  const lowerKey = keyStr.toLowerCase();

  if (
    lowerKey === "sparepart" ||
    lowerKey === "spare_part" ||
    lowerKey === "spare part" ||
    lowerKey === "sparepartname" ||
    keyStr === "자재명" ||
    keyStr === "자재목록" ||
    keyStr === "예비 부품" ||
    keyStr === "예비부품" ||
    lowerKey === "materiallist"
  ) {
    return (
      row.sparePart ??
      row.Sparepart ??
      row.sparepart ??
      row.spare_part ??
      row.sparePartName ??
      row["spare part"] ??
      row["자재목록"] ??
      row["자재명"] ??
      row["자재 명"] ??
      row["예비 부품"] ??
      row["예비부품"] ??
      row.materialList ??
      ""
    );
  }

  if (
    lowerKey === "workedon" ||
    lowerKey === "workeddate" ||
    lowerKey === "workdate" ||
    keyStr === "작업완료일" ||
    keyStr === "작업일자"
  ) {
    return (
      row.workedOn ??
      row.workedDate ??
      row.worked_date ??
      row.workDate ??
      row.work_date ??
      row["작업완료일"] ??
      row["작업일자"] ??
      ""
    );
  }

  if (lowerKey === "wocode" || keyStr === "wOCode" || keyStr === "W/O코드") {
    return row.wOCode ?? row.woCode ?? row.wo_code ?? row["W/O코드"] ?? "";
  }

  if (
    lowerKey === "wotype" ||
    lowerKey === "wotypeid" ||
    keyStr === "W/O타입" ||
    keyStr === "WO유형"
  ) {
    return (
      row.woType ??
      row.Wotype ??
      row.wo_type ??
      row.woTypeName ??
      row["W/O타입"] ??
      row["WO유형"] ??
      ""
    );
  }

  if (
    lowerKey === "maintgroup" ||
    lowerKey === "eqtype" ||
    lowerKey === "equipmenttype" ||
    keyStr === "보전파트"
  ) {
    return (
      row.equipment_type_name ??
      row.equipmentTypeName ??
      row.maintGroup ??
      row.eqType ??
      row["보전파트"] ??
      ""
    );
  }

  if (
    lowerKey === "representativework" ||
    lowerKey === "rep_work" ||
    keyStr === "대표작업명" ||
    keyStr === "대표 작업명"
  ) {
    return (
      row.representative_work_name ??
      row.representativeWorkName ??
      row.representativeWork ??
      row.work_name ??
      row.workName ??
      row["대표작업명"] ??
      row["대표 작업명"] ??
      ""
    );
  }

  if (row[col] !== undefined && row[col] !== null && row[col] !== "") {
    return row[col];
  }

  const foundKey = Object.keys(row).find((k) => k.toLowerCase() === lowerKey);
  if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null) {
    return row[foundKey];
  }

  return "";
}

// ─────────────────────────────────────────────────────────────────────────────
// renderCellBadge — renders badges for priority, woType, and woCode
// ─────────────────────────────────────────────────────────────────────────────
function renderCellBadge(col, rawVal) {
  if (rawVal == null || rawVal === "" || rawVal === "null" || rawVal === "undefined") {
    return "—";
  }
  const strVal = String(rawVal).trim();
  const lowerKey = String(col || "").trim().toLowerCase();

  // 1. Priority Badge (중요도 / 우선순위)
  if (
    lowerKey === "priority" ||
    lowerKey === "priorityname" ||
    lowerKey === "priority_name" ||
    lowerKey === "중요도" ||
    lowerKey === "우선순위" ||
    col === "중요도" ||
    col === "우선순위"
  ) {
    const isImportant =
      strVal === "중요" ||
      strVal.toLowerCase() === "high" ||
      strVal.toLowerCase() === "urgent" ||
      strVal.toLowerCase() === "critical";
    const isNormal =
      strVal === "일반" ||
      strVal.toLowerCase() === "normal" ||
      strVal.toLowerCase() === "medium" ||
      strVal.toLowerCase() === "standard";

    if (isImportant) {
      return (
        <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-600 border border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800 shadow-2xs">
          {strVal}
        </span>
      );
    }
    if (isNormal) {
      return (
        <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 shadow-2xs">
          {strVal}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 shadow-2xs">
        {strVal}
      </span>
    );
  }

  // 2. WO Type Badge (WO 유형 / W/O 타입 / 보전유형)
  if (
    lowerKey === "wotype" ||
    lowerKey === "wotypename" ||
    lowerKey === "wo_type" ||
    lowerKey === "work_order_type_name" ||
    lowerKey === "workordertype" ||
    lowerKey === "workordertypename" ||
    lowerKey === "wo유형" ||
    lowerKey === "w/o타입" ||
    lowerKey === "보전유형" ||
    col === "WO유형" ||
    col === "W/O타입" ||
    col === "보전유형"
  ) {
    const isCM = strVal.includes("CM") || strVal.includes("개량");
    const isBM = strVal.includes("BM") || strVal.includes("고장");
    const isPM = strVal.includes("PM") || strVal.includes("예방");

    if (isCM) {
      return (
        <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800 shadow-2xs">
          {strVal}
        </span>
      );
    }
    if (isBM) {
      return (
        <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 shadow-2xs">
          {strVal}
        </span>
      );
    }
    if (isPM) {
      return (
        <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-600 border border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800 shadow-2xs">
          {strVal}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-600 border border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800 shadow-2xs">
        {strVal}
      </span>
    );
  }

  // 3. Date formatting
  if (
    lowerKey === "workedon" ||
    lowerKey === "workeddate" ||
    lowerKey === "workdate" ||
    col === "작업완료일" ||
    col === "workedOn"
  ) {
    if (strVal.includes("T")) return strVal.split("T")[0];
    if (/^\d{4}-\d{2}-\d{2}/.test(strVal)) return strVal.slice(0, 10);
    const d = new Date(rawVal);
    return !isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : strVal;
  }

  return strVal;
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
              value={draft[col] ?? getTableRowValue(draft, col) ?? ""}
              onChange={(e) => setDraft((prev) => ({ ...prev, [col]: e.target.value }))}
              onClick={(e) => e.stopPropagation()}
            />
          </td>
        ) : (
          <td
            key={col}
            className="px-4 py-3 text-text-subtle whitespace-nowrap"
            style={{ maxWidth: "240px", overflow: "hidden", textOverflow: "ellipsis" }}
            title={String(getTableRowValue(row, col))}
          >
            {renderCellBadge(col, getTableRowValue(row, col))}
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
  woType: "field.woType",
  WO유형: "field.woType",
  "W/O타입": "field.woType",
  "W/O 유형": "field.woType",
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
  법인: "field.site",
  공정: "field.process",
  보전파트: "field.maintenance",
  보전그룹: "field.maintenanceGroup",
  보전유형: "field.maintenanceType",
  설비코드: "field.equipmentCode",
  설비명: "field.equipmentName",
  "W/O코드": "field.woCode",
  Report내용: "field.report",
  BOM: "field.bom",
  자재명: "field.sparePart",
  작업완료일: "field.workedOn",
  "개선 작업": "field.improvement",
  작업목적: "field.work",
  "문제 현상": "field.situation",
  "문제 원인": "field.cause",
  "HW 변경 전": "field.hwBefore",
  "HW 변경 후": "field.hwAfter",
  "SW 변경 전": "field.swBefore",
  "SW 변경 후": "field.swAfter",
  "대표 작업명": "field.repWork",
  중요도: "field.priority",
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
function extractPhotosFromRow(row) {
  if (!row) return [];
  if (Array.isArray(row.photos) && row.photos.length > 0) {
    return row.photos.map((p, i) => {
      const rawData = p.fileContent || p.previewUrl || p.image_data || p.imageData || "";
      const src = rawData
        ? rawData.startsWith("data:")
          ? rawData
          : `data:image/png;base64,${rawData}`
        : p.url || p.imageUrl || "";
      return {
        ...p,
        id: p.id || `photo-${i}`,
        filename: p.filename || p.name || `image_${i + 1}.png`,
        name: p.name || p.filename || `image_${i + 1}.png`,
        previewUrl: src,
        fileContent: src,
        category: p.category || "After Improvements",
        badge: p.badge || "공유",
      };
    });
  }

  const normalizeCat = (rawCat) => {
    if (!rawCat) return "After Improvements";
    const str = String(rawCat).trim().toLowerCase();
    if (str.includes("problem") || str.includes("phenomenon") || str.includes("문제"))
      return "Problem phenomenon";
    if (str.includes("after") || str.includes("improvement") || str.includes("개선"))
      return "After Improvements";
    if (str.includes("equipment") || str.includes("reference") || str.includes("설비"))
      return "Equipment Reference";
    return "After Improvements";
  };

  const toPhoto = (img, i) => {
    const rawData =
      img.image_data ||
      img.imageData ||
      img.fileContent ||
      img.file_content ||
      img.previewUrl ||
      "";
    const src = rawData
      ? rawData.startsWith("data:")
        ? rawData
        : `data:image/png;base64,${rawData}`
      : img.url || img.imageUrl || "";

    const name =
      img.image_name || img.imageName || img.filename || img.name || `attachment_${i + 1}.png`;
    const cat = normalizeCat(img.category_name || img.categoryName || img.category);

    return {
      id: img.id || `existing-img-${i}`,
      filename: name,
      name: name,
      fileContent: src,
      previewUrl: src,
      category: cat,
      caption: name,
      badge: img.badge || "공유",
    };
  };

  if (Array.isArray(row.images) && row.images.length > 0) {
    return row.images.map(toPhoto);
  }
  if (Array.isArray(row.attachments) && row.attachments.length > 0) {
    return row.attachments.map(toPhoto);
  }
  if (row.imageData || row.image_data || row.imageUrl) {
    return [toPhoto(row, 0)];
  }

  return [];
}

function RowEditModal({
  row,
  index,
  columns,
  onSave,
  onClose,
  filterPayload,
  categoryList = [],
  priorityList = [],
  siteList = [],
  repSuggestions = [],
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(() => {
    const initialRow = { ...(row ?? {}) };
    initialRow.photos = extractPhotosFromRow(row);
    return initialRow;
  });
  const [errors, setErrors] = useState({});
  const [showRepSuggestions, setShowRepSuggestions] = useState(false);

  const fileInputRef = useRef(null);
  const [pendingPhoto, setPendingPhoto] = useState(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [uploadError, setUploadError] = useState("");

  useEffect(() => {
    const initialRow = { ...(row ?? {}) };
    initialRow.photos = extractPhotosFromRow(row);
    setDraft(initialRow);
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

    if (file.type && !file.type.startsWith("image/")) {
      setUploadError("Please select a valid image file (JPG, PNG, WEBP, GIF, etc.).");
      return;
    }

    // Max 5MB Validation
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Image size exceeds maximum limit of 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64String = e.target.result || "";
      setPendingPhoto({
        file,
        previewUrl: base64String,
        fileContent: base64String,
        filename: file.name,
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
      filename: pendingPhoto.filename || pendingPhoto.name,
      fileContent: pendingPhoto.fileContent || pendingPhoto.previewUrl || "",
      previewUrl: pendingPhoto.previewUrl,
      name: pendingPhoto.name,
      category: cat,
      caption: pendingPhoto.filename || pendingPhoto.name,
      badge: "추가 대기",
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
      <div className="modal-overlay animate-fade-in" onMouseDown={onClose}>
        <form
          className="modal-panel modal-panel-xl w-full max-h-[92vh] flex flex-col"
          onSubmit={handleSubmit}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="modal-header shrink-0">
            <div className="flex items-start gap-3 min-w-0">
              <span className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold shrink-0">
                <i className="fas fa-plus-circle text-base" />
              </span>
              <div className="min-w-0">
                <h2 className="modal-title">{t("page.mp.modalEditTitle", "항목 편집")}</h2>
                <p className="modal-description">
                  {t(
                    "page.mp.modalEditDesc",
                    "Work Order 항목입니다. 법인과 작업완료일은 수정할 수 없습니다.",
                  )}
                </p>
              </div>
            </div>
            <button
              type="button"
              className="modal-close-btn shrink-0"
              onClick={onClose}
              aria-label={t("app.close")}
            >
              <i className="fas fa-times text-sm" />
            </button>
          </div>

          <div className="modal-body flex-1 overflow-y-auto space-y-4">
            {/* Row 1: Process & Equipment Type (Read-Only) */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="modal-field-label mb-1.5">{t("field.process", "공정")}</label>
                <input
                  type="text"
                  value={draft.process ?? ""}
                  readOnly
                  disabled
                  className="modal-readonly-field"
                />
              </div>
              <div>
                <label className="modal-field-label mb-1.5">
                  {t("field.equipmentType", "보전파트")}
                </label>
                <input
                  type="text"
                  value={draft.maintGroup ?? ""}
                  readOnly
                  disabled
                  className="modal-readonly-field"
                />
              </div>
            </div>

            {/* Row 2: Representative Work Name * with Saved Info Suggestions Popover */}
            <div className="relative">
              <label className="modal-field-label mb-1.5">
                {t("field.repWork", "대표 작업명")} <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={draft.representativeWork ?? ""}
                onFocus={() => setShowRepSuggestions(true)}
                onChange={(e) => {
                  handleFieldChange("representativeWork", e.target.value);
                  setShowRepSuggestions(true);
                }}
                className={`modal-input ${errors.representativeWork ? "is-error" : ""}`}
              />
              {errors.representativeWork && (
                <span className="mt-1 block text-[11px] font-semibold text-rose-500">
                  {errors.representativeWork}
                </span>
              )}

              {/* Saved info Suggestions Popover */}
              {showRepSuggestions && repSuggestions.length > 0 && (
                <div className="absolute left-0 top-[100%] mt-1.5 z-50 w-full max-w-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-3 animate-fade-in">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100 dark:border-gray-700">
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-200 flex items-center gap-1.5">
                      <i className="fas fa-bookmark text-blue-600 text-2xs" />
                      Saved info
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowRepSuggestions(false)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs px-1"
                    >
                      <i className="fas fa-times" />
                    </button>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {repSuggestions.map((suggestionName, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-lg text-xs font-medium text-gray-800 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-[#1745c2] dark:hover:text-blue-400 cursor-pointer transition-all border border-transparent hover:border-blue-100 dark:hover:border-blue-800"
                        onMouseDown={() => {
                          handleFieldChange("representativeWork", suggestionName);
                          const repObj = (filterPayload?.representations || []).find(
                            (r) => (r.representativeWorkName || r.workName) === suggestionName,
                          );
                          if (repObj) {
                            if (repObj.categoryId) {
                              const catObj = categoryList.find((c) => c.id === repObj.categoryId);
                              if (catObj) {
                                handleFieldChange("category", catObj.categoryName);
                                handleFieldChange("categoryId", catObj.id);
                              }
                            }
                            if (repObj.priorityId) {
                              const priObj = priorityList.find((p) => p.id === repObj.priorityId);
                              if (priObj) {
                                handleFieldChange("priority", priObj.priorityName);
                                handleFieldChange("priorityId", priObj.id);
                              }
                            }
                          }
                          setShowRepSuggestions(false);
                        }}
                      >
                        {suggestionName}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Row 3: Purpose of the Work */}
            <div>
              <label className="modal-field-label mb-1.5">{t("field.workPurpose", "작업 목적")}</label>
              <input
                type="text"
                value={draft.purpose ?? draft.work ?? ""}
                onChange={(e) => {
                  handleFieldChange("purpose", e.target.value);
                  handleFieldChange("work", e.target.value);
                }}
                className={`modal-input ${errors.purpose || errors.work ? "is-error" : ""}`}
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
                <label className="modal-field-label mb-1.5">
                  {t("field.situation", "문제 현상")} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={draft.situation ?? ""}
                  onChange={(e) => handleFieldChange("situation", e.target.value)}
                  className={`modal-input ${errors.situation ? "is-error" : ""}`}
                />
                {errors.situation && (
                  <span className="mt-1 block text-[11px] font-semibold text-rose-500">
                    {errors.situation}
                  </span>
                )}
              </div>
              <div>
                <label className="modal-field-label mb-1.5">
                  {t("field.cause", "문제 원인")}
                </label>
                <input
                  type="text"
                  value={draft.cause ?? ""}
                  onChange={(e) => handleFieldChange("cause", e.target.value)}
                  className={`modal-input ${errors.cause ? "is-error" : ""}`}
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
                <label className="modal-field-label mb-1.5">{t("field.bom", "BOM")}</label>
                <input
                  type="text"
                  placeholder="Enter BOM (new line allowed)"
                  value={draft.bom ?? ""}
                  onChange={(e) => handleFieldChange("bom", e.target.value)}
                  className="modal-input"
                />
              </div>
              <div>
                <label className="modal-field-label mb-1.5">
                  {t("field.sparePart", "자재명")}
                </label>
                <input
                  type="text"
                  placeholder="Enter material name (new line allowed)"
                  value={draft.sparePart ?? ""}
                  onChange={(e) => handleFieldChange("sparePart", e.target.value)}
                  className="modal-input"
                />
              </div>
            </div>

            {/* Row 6: HW Before & HW After */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="modal-field-label mb-1.5">
                  {t("field.hwBefore", "HW 변경 전")}
                </label>
                <input
                  type="text"
                  value={draft.hwAsWas ?? ""}
                  onChange={(e) => handleFieldChange("hwAsWas", e.target.value)}
                  className={`modal-input ${errors.hwAsWas ? "is-error" : ""}`}
                />
                {errors.hwAsWas && (
                  <span className="mt-1 block text-[11px] font-semibold text-rose-500">
                    {errors.hwAsWas}
                  </span>
                )}
              </div>
              <div>
                <label className="modal-field-label mb-1.5">
                  {t("field.hwAfter", "HW 변경 후")}
                </label>
                <input
                  type="text"
                  value={draft.hwAsIs ?? ""}
                  onChange={(e) => handleFieldChange("hwAsIs", e.target.value)}
                  className={`modal-input ${errors.hwAsIs ? "is-error" : ""}`}
                />
                {errors.hwAsIs && (
                  <span className="mt-1 block text-[11px] font-semibold text-rose-500">
                    {errors.hwAsIs}
                  </span>
                )}
              </div>
            </div>

            {/* Row 7: SW Before & SW After */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="modal-field-label mb-1.5">
                  {t("field.swBefore", "SW 변경 전")}
                </label>
                <input
                  type="text"
                  value={draft.swAsWas ?? ""}
                  onChange={(e) => handleFieldChange("swAsWas", e.target.value)}
                  className={`modal-input ${errors.swAsWas ? "is-error" : ""}`}
                />
                {errors.swAsWas && (
                  <span className="mt-1 block text-[11px] font-semibold text-rose-500">
                    {errors.swAsWas}
                  </span>
                )}
              </div>
              <div>
                <label className="modal-field-label mb-1.5">
                  {t("field.swAfter", "SW 변경 후")}
                </label>
                <input
                  type="text"
                  value={draft.swAsIs ?? ""}
                  onChange={(e) => handleFieldChange("swAsIs", e.target.value)}
                  className={`modal-input ${errors.swAsIs ? "is-error" : ""}`}
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
                <label className="modal-field-label mb-1.5">
                  {t("field.priority", "중요도")}
                </label>
                <select
                  value={draft.priority ?? (priorityList[0]?.priorityName || "일반")}
                  onChange={(e) => {
                    const val = e.target.value;
                    const pObj = priorityList.find((p) => p.priorityName === val);
                    handleFieldChange("priority", val);
                    if (pObj) handleFieldChange("priorityId", pObj.id);
                  }}
                  className="modal-select"
                >
                  {priorityList.map((p) => (
                    <option key={p.id} value={p.priorityName}>
                      {p.priorityName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="modal-field-label mb-1.5">
                  {t("field.category", "효과 유형")}
                </label>
                <select
                  value={draft.category ?? (categoryList[0]?.categoryName || "기타")}
                  onChange={(e) => {
                    const val = e.target.value;
                    const cObj = categoryList.find((c) => c.categoryName === val);
                    handleFieldChange("category", val);
                    if (cObj) handleFieldChange("categoryId", cObj.id);
                  }}
                  className="modal-select"
                >
                  {categoryList.map((c) => (
                    <option key={c.id} value={c.categoryName}>
                      {c.categoryName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 9: Date of Completion & Requesting Corporation (Read-Only) */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="modal-field-label mb-1.5">
                  {t("field.workedOn", "작업완료일")}
                </label>
                <input
                  type="text"
                  value={
                    getFormattedDateString(draft.workedOn) ||
                    (draft.workedOn
                      ? (function (val) {
                          if (
                            !val ||
                            String(val).startsWith("0000") ||
                            String(val).startsWith("0001")
                          )
                            return "";
                          if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
                          const d = new Date(val);
                          if (isNaN(d.getTime()) || d.getFullYear() < 2000) return "";
                          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                        })(draft.workedOn)
                      : "") ||
                    " — "
                  }
                  readOnly
                  disabled
                  className="modal-readonly-field cursor-not-allowed"
                />
              </div>
              <div>
                <label className="modal-field-label mb-1.5">
                  {t("field.site", "요청 법인")}
                </label>
                <input
                  type="text"
                  value={draft.site || draft.siteName || draft.site_name || " — "}
                  readOnly
                  disabled
                  className="modal-readonly-field cursor-not-allowed"
                />
              </div>
            </div>

            {/* Row 10: Metadata Stats Badges */}
            {(() => {
              const getCat = (a) => {
                const c = String(a.category || a.category_name || a.categoryName || "").trim();
                if (c === "Problem phenomenon" || c === "problem" || c === "문제 현상" || c === "문제현상") {
                  return "문제 현상";
                }
                if (c === "After Improvements" || c === "after" || c === "개선 후" || c === "개선후") {
                  return "개선 후";
                }
                if (c === "Equipment Reference" || c === "equipment" || c === "설비 참고" || c === "설비참고") {
                  return "설비 참고";
                }
                return "기타";
              };

              const pCount = photos.filter((p) => getCat(p) === "문제 현상").length;
              const aCount = photos.filter((p) => getCat(p) === "개선 후").length;
              const eCount = photos.filter((p) => getCat(p) === "설비 참고").length;
              const oCount = photos.filter((p) => getCat(p) === "기타").length;
              const sheetUnit = t("photo.sheetCount", "장");

              return (
                <div className="flex flex-wrap items-center gap-4 text-xs font-semibold py-1 text-gray-500 dark:text-gray-400">
                  <span className={pCount > 0 ? "text-blue-600 dark:text-blue-400 font-bold" : ""}>
                    {t("category.problemPhenomenon", "문제 현상")} {pCount}{sheetUnit}
                  </span>
                  <span className={aCount > 0 ? "text-emerald-600 dark:text-emerald-400 font-bold" : ""}>
                    {t("category.afterImprovements", "개선 후")} {aCount}{sheetUnit}
                  </span>
                  <span className={eCount > 0 ? "text-blue-600 dark:text-blue-400 font-bold" : ""}>
                    {t("category.equipmentReference", "설비 참고")} {eCount}{sheetUnit}
                  </span>
                  <span className={oCount > 0 ? "text-gray-700 dark:text-gray-200 font-bold" : ""}>
                    {t("category.others", "기타")} {oCount}{sheetUnit}
                  </span>
                </div>
              );
            })()}

            {/* Row 11: Upload Dropzone Card */}
            <div
              className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-3.5 text-center bg-gray-50/50 dark:bg-gray-800/40 cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 hover:bg-gray-100/60 transition-colors"
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
              <div className="flex items-center justify-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-300">
                <i className="fas fa-cloud-upload-alt text-base text-gray-400" />
                <span>
                  {t(
                    "photo.dropzoneHint",
                    "사진을 드래그하거나 클릭하여 업로드 (같은 그룹 항목에 자동 공유)",
                  )}
                </span>
              </div>
              {uploadError && (
                <p className="mt-1.5 text-xs font-semibold text-rose-500">{uploadError}</p>
              )}
            </div>

            {/* Uploaded Photo Preview Cards */}
            {photos.length > 0 && (
              <div className="flex flex-wrap gap-3 pt-2">
                {photos.map((photo) => {
                  const imgSrc =
                    photo.url ||
                    photo.previewUrl ||
                    photo.fileContent ||
                    photo.image_data ||
                    photo.imageData ||
                    "";
                  const catName =
                    (function (c) {
                      if (!c) return t("category.others", "기타");
                      const s = String(c).trim();
                      if (s === "Problem phenomenon" || s === "problem" || s === "문제 현상" || s === "문제현상") {
                        return t("category.problemPhenomenon", "문제 현상");
                      }
                      if (s === "After Improvements" || s === "after" || s === "개선 후" || s === "개선후") {
                        return t("category.afterImprovements", "개선 후");
                      }
                      if (s === "Equipment Reference" || s === "equipment" || s === "설비 참고" || s === "설비참고") {
                        return t("category.equipmentReference", "설비 참고");
                      }
                      return t("category.others", "기타");
                    })(photo.category || photo.category_name || photo.categoryName);

                  const isPending =
                    photo.badge === "추가 대기" ||
                    photo.badge === "Additional Standby" ||
                    photo.isNew;

                  return (
                    <div
                      key={photo.id}
                      className="group relative w-28 h-32 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-2 hover:border-dashed hover:border-blue-500 overflow-hidden flex flex-col bg-white dark:bg-gray-800 shadow-2xs transition-all"
                    >
                      {/* Top-Left: Status Badge */}
                      {isPending ? (
                        <span className="absolute top-1.5 left-1.5 bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 z-10 shadow-xs">
                          <i className="fas fa-check text-[8px]" />
                          <span>{t("photo.pendingAddition", "추가 대기")}</span>
                        </span>
                      ) : (
                        <span className="absolute top-1.5 left-1.5 bg-[#4f46e5] text-white text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 z-10 shadow-xs">
                          <i className="fas fa-link text-[8px]" />
                          <span>{t("photo.shared", "공유")}</span>
                        </span>
                      )}

                      {/* Top-Right: Red circular cross delete button - hidden normally, shown on hover */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemovePhoto(photo.id);
                        }}
                        className="absolute top-1.5 right-1.5 w-5 h-5 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center text-[10px] z-10 shadow-xs opacity-0 group-hover:opacity-100 transition-opacity duration-150 hover:scale-110 cursor-pointer"
                        title={t("app.delete", "삭제")}
                      >
                        <i className="fas fa-times text-[9px]" />
                      </button>

                      {/* Thumbnail Image */}
                      <div className="flex-1 bg-gray-100 dark:bg-gray-900 overflow-hidden relative flex items-center justify-center">
                        <img
                          src={imgSrc}
                          alt={photo.name || photo.filename || t("field.photo", "사진")}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      {/* Bottom Category Bar */}
                      <div className="bg-[#374151] dark:bg-gray-900 text-white text-[10px] font-bold py-1 px-1 text-center shrink-0 truncate">
                        {catName}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="modal-cancel-btn" onClick={onClose}>
              {t("app.cancel", "취소")}
            </button>
            <button
              type="submit"
              className="bg-[#1745c2] hover:bg-[#1239a5] text-white font-bold text-sm px-8 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <i className="fas fa-check text-xs" />
              {t("app.save", "저장하기")}
            </button>
          </div>
        </form>
      </div>

      {showCategoryModal && (
        <div
          className="modal-overlay animate-fade-in"
          onMouseDown={() => setShowCategoryModal(false)}
        >
          <div
            className="modal-panel modal-panel-sm w-full"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="flex items-start gap-3 min-w-0">
                <span className="modal-icon-wrap">
                  <i className="fas fa-image" />
                </span>
                <div className="min-w-0">
                  <h2 className="modal-title">{t("category.selectPhotoCategory", "사진 카테고리 선택")}</h2>
                  <p className="modal-description">
                    {t("category.selectPhotoCategoryDesc", "업로드할 사진의 카테고리를 선택하세요")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn shrink-0"
                onClick={() => setShowCategoryModal(false)}
              >
                <i className="fas fa-times text-sm" />
              </button>
            </div>

            <div className="modal-body grid grid-cols-2 gap-3.5">
              {/* Category 1: Problem phenomenon */}
              <button
                type="button"
                onClick={() => handleAssignCategory("Problem phenomenon")}
                className="flex flex-col items-center justify-center p-4 rounded-2xl border border-red-200 bg-red-50/70 hover:bg-red-100/80 text-red-600 font-bold text-xs transition-all shadow-xs gap-1.5 h-24 cursor-pointer"
              >
                <i className="fas fa-exclamation-triangle text-base" />
                <span className="text-center">{t("category.problemPhenomenon", "문제 현상")}</span>
              </button>

              {/* Category 2: After Improvements */}
              <button
                type="button"
                onClick={() => handleAssignCategory("After Improvements")}
                className="flex flex-col items-center justify-center p-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100/80 text-emerald-600 font-bold text-xs transition-all shadow-xs gap-1.5 h-24 cursor-pointer"
              >
                <i className="fas fa-check-circle text-base" />
                <span className="text-center">{t("category.afterImprovements", "개선 후")}</span>
              </button>

              {/* Category 3: Equipment Reference */}
              <button
                type="button"
                onClick={() => handleAssignCategory("Equipment Reference")}
                className="flex flex-col items-center justify-center p-4 rounded-2xl border border-blue-200 bg-blue-50/70 hover:bg-blue-100/80 text-blue-600 font-bold text-xs transition-all shadow-xs gap-1.5 h-24 cursor-pointer"
              >
                <i className="fas fa-cog text-base" />
                <span className="text-center">{t("category.equipmentReference", "설비 참고")}</span>
              </button>

              {/* Category 4: Others */}
              <button
                type="button"
                onClick={() => handleAssignCategory("Others")}
                className="flex flex-col items-center justify-center p-4 rounded-2xl border border-gray-200 bg-gray-50/80 hover:bg-gray-100 text-gray-700 font-bold text-xs transition-all shadow-xs gap-1.5 h-24 cursor-pointer"
              >
                <i className="fas fa-ellipsis-h text-base" />
                <span className="text-center">{t("category.others", "기타")}</span>
              </button>
            </div>

            <div className="modal-footer justify-center">
              <button
                type="button"
                className="modal-cancel-btn"
                onClick={() => setShowCategoryModal(false)}
              >
                {t("app.cancel", "취소")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function ChangeHistory({
  data,
  onUpload,
  onExport,
  onOpenDetail,
  searchText,
  isActive,
}) {
  const { t, language } = useI18n();
  const location = useLocation();
  const [selectedProcessId, setSelectedProcessId] = useState(() => {
    const saved = sessionStorage.getItem("eq_selected_process_id");
    return saved && !isNaN(Number(saved)) && Number(saved) > 0 ? Number(saved) : null;
  });
  const [selectedMaintenanceId, setSelectedMaintenanceId] = useState(() => {
    const saved = sessionStorage.getItem("eq_selected_maint_id");
    return saved && !isNaN(Number(saved)) && Number(saved) > 0 ? Number(saved) : null;
  });
  const [selectedColumnIds, setSelectedColumnIds] = useState([]);
  const [filter, setFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [previewRows, setPreviewRows] = useState(null);
  const [previewColumns, setPreviewColumns] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editModalLoading, setEditModalLoading] = useState(false);
  const [editModalRow, setEditModalRow] = useState(null);
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

  const navigate = useNavigate();
  const [importBusy, setImportBusy] = useState(false);
  const [importFileName, setImportFileName] = useState("");
  const [exportBusy, setExportBusy] = useState(false);
  const [aiImportBusy, setAiImportBusy] = useState(false);
  const [downloadSampleBusy, setDownloadSampleBusy] = useState(false);
  const [operationStatus, setOperationStatus] = useState({
    isVisible: false,
    status: "loading",
    message: "",
    autoClose: true,
  });
  const fileInput = useRef(null);
  const aiFileInput = useRef(null);
  const getFilterDataRef = useRef(null);

  const filterLoading = filterPayload === null && filterError === null;

  const [isFiltering, setIsFiltering] = useState(false);
  const [debouncedSearchText, setDebouncedSearchText] = useState("");
  const [totalCount, setTotalCount] = useState(0);
  const [usingApiTableData, setUsingApiTableData] = useState(!isStaticDataMode);
  const [drawerItem, setDrawerItem] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchText(filter || searchText || "");
    }, 400);
    return () => clearTimeout(timer);
  }, [filter, searchText]);

  // ── Filter option lists ───────────────────────────────────────────────────
  const processList = useMemo(() => {
    return (filterPayload?.process ?? []).filter((p) => p.isChangedData === true);
  }, [filterPayload]);

  const equipmentTypeList = useMemo(() => {
    const eqTypes = filterPayload?.eqTypes;
    if (Array.isArray(eqTypes) && eqTypes.length > 0) {
      let list = eqTypes.filter((item) => item.isChangedData !== false);
      if (selectedProcessId !== null && selectedProcessId !== undefined) {
        list = list.filter((item) => Number(item.processId) === Number(selectedProcessId));
      }
      return list;
    }

    const all = (filterPayload?.maintenance ?? []).filter((m) => m.isChangedData !== false);
    if (selectedProcessId === null || selectedProcessId === undefined) return all;
    return all.filter((m) => Number(m.processId) === Number(selectedProcessId));
  }, [filterPayload, selectedProcessId]);

  const siteList = useMemo(() => {
    const all = (filterPayload?.site ?? []).filter((s) => s.isChangedData !== false);
    if (selectedProcessId === null || selectedProcessId === undefined) return all;
    return all.filter((s) => Number(s.processId) === Number(selectedProcessId));
  }, [filterPayload, selectedProcessId]);

  const priorityList = useMemo(() => {
    return (filterPayload?.priority || []).length > 0
      ? filterPayload.priority
      : [
          { id: 1, priorityName: "일반" },
          { id: 2, priorityName: "중요" },
          { id: 3, priorityName: "정보 없음" },
        ];
  }, [filterPayload]);

  const categoryList = useMemo(() => {
    return (filterPayload?.category || []).length > 0
      ? filterPayload.category
      : [
          { id: 1, categoryName: "보전성" },
          { id: 2, categoryName: "품질" },
          { id: 3, categoryName: "생산성" },
          { id: 4, categoryName: "정보 없음" },
          { id: 5, categoryName: "기타" },
        ];
  }, [filterPayload]);

  const repSuggestions = useMemo(() => {
    const masterReps = filterPayload?.representations || [];
    const filteredMaster = masterReps.filter((r) => {
      if (selectedMaintenanceId && (r.maintenanceGroupId || r.equipmentTypeId)) {
        const idToMatch = r.maintenanceGroupId || r.equipmentTypeId;
        return Number(idToMatch) === Number(selectedMaintenanceId);
      }
      if (selectedProcessId && r.processId) {
        return Number(r.processId) === Number(selectedProcessId);
      }
      return true;
    });

    const uniqueNames = new Set(
      filteredMaster.map((r) => r.representativeWorkName || r.workName).filter(Boolean),
    );

    (changedRecords || []).forEach((r) => {
      const name = r.representativeWork || r.workName;
      if (name && name.trim()) {
        uniqueNames.add(name.trim());
      }
    });

    return Array.from(uniqueNames);
  }, [filterPayload, selectedMaintenanceId, selectedProcessId, changedRecords]);

  const columnFilterOptions = useMemo(() => {
    const isKo = (language || "ko").startsWith("ko");
    return (changeDataColumns ?? [])
      .filter((col) => col.isActive !== false)
      .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
      .map((col) => ({
        label: isKo
          ? (col.excelColumnNameKr || col.columnNameKr || col.jsonKey).trim()
          : (col.excelColumnName || col.jsonKey)
              .replace(/[\r\n]+/g, " ")
              .trim()
              .toUpperCase(),
        value: col.id,
      }));
  }, [changeDataColumns, language]);

  const getColumnHeaderLabel = useCallback(
    (colKey) => {
      const colDef = (changeDataColumns ?? []).find(
        (c) =>
          c.jsonKey === colKey ||
          c.excelColumnName === colKey ||
          c.jsonKey?.toLowerCase() === String(colKey).toLowerCase() ||
          c.excelColumnName?.toLowerCase() === String(colKey).toLowerCase(),
      );

      const isKo = (language || "ko").startsWith("ko");

      if (colDef) {
        if (isKo) {
          const krName = (colDef.excelColumnNameKr || colDef.columnNameKr || "").trim();
          if (krName) return krName;
        } else {
          const enName = (colDef.excelColumnName || colKey).replace(/[\r\n]+/g, " ").trim();
          if (enName) return enName.toUpperCase();
        }
      }

      return t(COLUMN_LABEL_KEYS[colKey] ?? `field.${colKey}`, colKey);
    },
    [changeDataColumns, language, t],
  );

  const handleProcessChange = (e) => {
    const val = e.target.value;
    const valNum = val === "" ? null : Number(val);
    setSelectedProcessId(valNum);
    setSelectedMaintenanceId(null);
    if (valNum) {
      sessionStorage.setItem("eq_selected_process_id", String(valNum));
    } else {
      sessionStorage.removeItem("eq_selected_process_id");
    }
    sessionStorage.removeItem("eq_selected_maint_id");
    sessionStorage.removeItem("eq_selected_maint_name");
  };

  const handleMaintenanceChange = (e) => {
    const val = e.target.value;
    const valNum = val === "" ? null : Number(val);
    setSelectedMaintenanceId(valNum);
    if (valNum) {
      sessionStorage.setItem("eq_selected_maint_id", String(valNum));
    } else {
      sessionStorage.removeItem("eq_selected_maint_id");
      sessionStorage.removeItem("eq_selected_maint_name");
    }
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
      "equipment_code",
      "eqcode",
      "eq_code",
      "equipmentname",
      "equipment_name",
      "eqname",
      "eq_name",
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
      "eqtype",
      "eq type",
      "equipmenttype",
      "equipment type",
      "equipment_type",
      "wotype",
      "wotypeid",
      "wo type",
      "wo_type",
      "wo유형",
      "w/o유형",
      "w/o 유형",
      // Excel names
      "site",
      "process",
      "equipment",
      "equipment_code",
      "eqcode",
      "eq_code",
      "equipment_name",
      "eqname",
      "eq_name",
      "eqtype",
      "eq type",
      "equipmenttype",
      "equipment type",
      "equipment_type",
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
      "category",
      "wotype",
      "wotypeid",
      "wo_type",
      "wo type",
      "wo유형",
    ]);

    if (!changeDataColumns || changeDataColumns.length === 0) return null;
    const keys = new Set([
      "wotype",
      "wotypeid",
      "wo type",
      "wo_type",
      "wo유형",
      "sparepart",
      "spare_part",
      "spare part",
      "sparePart",
      "Sparepart",
      "자재명",
      "자재 명",
      "자재목록",
      "예비 부품",
      "예비부품",
    ]);
    changeDataColumns.forEach((c) => {
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
      [
        "sparePart",
        "Sparepart",
        "sparepart",
        "spare_part",
        "자재명",
        "자재목록",
        "예비 부품",
        "예비부품",
      ],
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
      ["category", "효과 유형"],
    ];
    const idx = groups.findIndex((g) => g.includes(key));
    return idx !== -1 ? idx : 999;
  }, []);

  // ── Remap all rows to English jsonKeys to keep keys consistent ────────────────
  // Build a case-insensitive lookup: lowercase jsonKey → actual jsonKey
  // so that API keys like "woCode" match DB jsonKey "wOCode"
  const jsonKeyCaseMap = useMemo(() => {
    const map = {};
    if (Array.isArray(changeDataColumns)) {
      changeDataColumns.forEach((col) => {
        if (col.jsonKey) {
          map[col.jsonKey.trim().toLowerCase()] = col.jsonKey.trim();
        }
      });
    }
    return map;
  }, [changeDataColumns]);

  const combinedData = useMemo(() => {
    const remapRow = (row) => {
      if (!row) return row;
      return Object.entries(row).reduce((acc, [key, value]) => {
        const trimmedKey = key.trim();
        // 1. Try exact excelColumnName → jsonKey mapping
        let mappedKey = excelToJsonKey[trimmedKey] ?? trimmedKey;
        // 2. If the key doesn't match any known jsonKey, try case-insensitive match
        //    e.g. API returns "woCode" but DB jsonKey is "wOCode"
        if (mappedKey === trimmedKey && jsonKeyCaseMap[trimmedKey.toLowerCase()]) {
          mappedKey = jsonKeyCaseMap[trimmedKey.toLowerCase()];
        }
        acc[mappedKey] = value;
        return acc;
      }, {});
    };

    return changedRecords.map(remapRow);
  }, [changedRecords, excelToJsonKey, jsonKeyCaseMap]);

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

  // ── Filtered rows ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (usingApiTableData) {
      return combinedData;
    }

    if (!selectedProcessId) {
      return [];
    }

    const selectedProcess = selectedProcessId
      ? processList.find((p) => p.id === selectedProcessId)
      : null;
    const selectedEquipmentType = equipmentTypeList.find(
      (item) =>
        selectedMaintenanceId !== null &&
        selectedMaintenanceId !== undefined &&
        (String(item.id) === String(selectedMaintenanceId) ||
          getEquipmentTypeLabel(item) === String(selectedMaintenanceId)),
    );
    const selectedEquipmentTypeName = selectedEquipmentType
      ? getEquipmentTypeLabel(selectedEquipmentType)
      : "";

    return combinedData.filter((item) => {
      const itemProcess = item.process ?? item["ê³µì •"] ?? "";
      const itemMaint = item.maintGroup ?? item["ë³´ì „íŒŒíŠ¸"] ?? item["ë³´ì „ê·¸ë£¹"] ?? "";

      if (!selectedProcess || !selectedEquipmentType) {
        const text = Object.values(item)
          .map((v) => String(v ?? ""))
          .join(" ")
          .toLowerCase();
        const matchesProcSelection =
          !selectedProcess || itemProcess === selectedProcess.processName;
        const matchesMaintSelection =
          !selectedEquipmentType || itemMaint === selectedEquipmentTypeName;
        const matchesSearch = searchText ? text.includes(searchText.toLowerCase()) : true;
        const matchesFilter = filter ? text.includes(filter.toLowerCase()) : true;

        return matchesProcSelection && matchesMaintSelection && matchesSearch && matchesFilter;
      }

      const matchesProc = (item.process ?? item.공정) === (selectedProcess?.processName ?? "");

      const matchesMaint =
        (item.maintGroup ?? item.보전파트 ?? item.보전그룹) === selectedEquipmentTypeName;

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
    equipmentTypeList,
    usingApiTableData,
    selectedProcessId,
    selectedMaintenanceId,
    filter,
    searchText,
  ]);

  // ── Sorting & Pagination ──────────────────────────────────────────────────
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const handleSort = (colKey) => {
    setSortConfig((prev) => {
      if (prev.key !== colKey) return { key: colKey, direction: "asc" };
      if (prev.direction === "asc") return { key: colKey, direction: "desc" };
      return { key: null, direction: null };
    });
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [
    selectedProcessId,
    selectedMaintenanceId,
    selectedColumnIds,
    filter,
    searchText,
    debouncedSearchText,
    sortConfig,
  ]);

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
    if (usingApiTableData) {
      return sortedFilteredData;
    }
    const start = (currentPage - 1) * pageSize;
    return sortedFilteredData.slice(start, start + pageSize);
  }, [sortedFilteredData, currentPage, pageSize, usingApiTableData]);

  const paginationTotalItems = usingApiTableData ? totalCount : sortedFilteredData.length;

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
      const remapped = remapRowKeys(row, excelToJsonKey);
      const clean = {
        id: 0,
        site: String(remapped.site ?? row.site ?? "").trim(),
        process: String(remapped.process ?? row.process ?? "").trim(),
        maintGroup: String(
          remapped.maintGroup ?? remapped.equipment ?? row.maintGroup ?? row.equipment ?? "",
        ).trim(),
        equipmentCode: String(
          remapped.equipmentCode ??
            remapped.equipment_code ??
            remapped.eqcode ??
            remapped.eqCode ??
            remapped.Eqcode ??
            row.equipmentCode ??
            row.equipment_code ??
            row.eqcode ??
            row.Eqcode ??
            row["설비코드"] ??
            "",
        ).trim(),
        equipmentName: String(
          remapped.equipmentName ??
            remapped.equipment_name ??
            remapped.eqname ??
            remapped.eqName ??
            remapped.Eqname ??
            row.equipmentName ??
            row.equipment_name ??
            row.eqname ??
            row.Eqname ??
            row["설비명"] ??
            "",
        ).trim(),
        woCode: String(
          remapped.woCode ??
            remapped.wOCode ??
            remapped.wo_code ??
            remapped["w/ocode"] ??
            remapped["W/Ocode"] ??
            row.woCode ??
            row.wOCode ??
            row.wo_code ??
            row["W/Ocode"] ??
            "",
        ).trim(),
        wOCode: String(
          remapped.wOCode ??
            remapped.woCode ??
            remapped.wo_code ??
            remapped["w/ocode"] ??
            remapped["W/Ocode"] ??
            row.wOCode ??
            row.woCode ??
            row.wo_code ??
            row["W/Ocode"] ??
            "",
        ).trim(),
        wo_code: String(
          remapped.wo_code ??
            remapped.woCode ??
            remapped.wOCode ??
            remapped["w/ocode"] ??
            remapped["W/Ocode"] ??
            row.wo_code ??
            row.woCode ??
            row.wOCode ??
            row["W/Ocode"] ??
            "",
        ).trim(),
        report: String(
          remapped.report ??
            remapped.report_content ??
            remapped["report content"] ??
            row.report ??
            row["report content"] ??
            "",
        ).trim(),
        bom: String(remapped.bom ?? row.bom ?? row.BOM ?? "").trim(),
        sparePart: String(
          remapped.sparePart ??
            remapped["spare part"] ??
            remapped.sparepart ??
            remapped.spare_part ??
            remapped.sparePartName ??
            remapped["자재명"] ??
            remapped["자재 명"] ??
            row.sparePart ??
            row.Sparepart ??
            row.sparepart ??
            row.spare_part ??
            row.sparePartName ??
            row["spare part"] ??
            row["자재명"] ??
            row["자재 명"] ??
            "",
        ).trim(),
        workedOn: String(
          remapped.workedOn ??
            remapped.workedDate ??
            remapped.worked_date ??
            remapped.work_date ??
            remapped.workDate ??
            remapped["worked date"] ??
            row.workedOn ??
            row.workedDate ??
            row.worked_date ??
            row.work_date ??
            row.workDate ??
            row["worked date"] ??
            row["작업완료일"] ??
            "",
        ).trim(),
        work: String(
          remapped.work ??
            remapped["work description"] ??
            row.work ??
            row["work description"] ??
            "",
        ).trim(),
        purpose: String(remapped.purpose ?? row.purpose ?? "").trim(),
        situation: String(remapped.situation ?? row.situation ?? "").trim(),
        cause: String(remapped.cause ?? row.cause ?? "").trim(),
        hwAsWas: String(
          remapped.hwAsWas ??
            remapped.hw_was ??
            remapped["hw as was"] ??
            row.hwAsWas ??
            row["HW as was"] ??
            "",
        ).trim(),
        hwAsIs: String(
          remapped.hwAsIs ??
            remapped.hw_is ??
            remapped["hw as is"] ??
            row.hwAsIs ??
            row["HW as is"] ??
            "",
        ).trim(),
        swAsWas: String(
          remapped.swAsWas ??
            remapped.sw_was ??
            remapped["sw as was"] ??
            row.swAsWas ??
            row["SW as was"] ??
            "",
        ).trim(),
        swAsIs: String(
          remapped.swAsIs ??
            remapped.sw_is ??
            remapped["sw as is"] ??
            row.swAsIs ??
            row["SW as is"] ??
            "",
        ).trim(),
        representativeWork: String(
          remapped.representativeWork ??
            remapped.rep_work ??
            row.representativeWork ??
            row.rep_work ??
            "",
        ).trim(),
        priority: String(remapped.priority ?? row.priority ?? "").trim(),
        category: String(remapped.category ?? row.category ?? "").trim(),
        woType: String(
          remapped.woType ??
            remapped.wotype ??
            remapped.Wotype ??
            remapped["wo type"] ??
            remapped["wo_type"] ??
            remapped["WO유형"] ??
            remapped["WO 유형"] ??
            remapped["w/o유형"] ??
            row.woType ??
            row.Wotype ??
            row.wotype ??
            row["wo type"] ??
            row["wo_type"] ??
            row["WO유형"] ??
            row["WO 유형"] ??
            row["w/o유형"] ??
            "",
        ).trim(),
        woTypeId:
          Number(
            remapped.woTypeId ??
              remapped.wotypeId ??
              remapped.wotypeid ??
              row.woTypeId ??
              row.wotypeId ??
              row.wotypeid ??
              0,
          ) || 0,
        eqType: String(
          remapped.eqType ??
            remapped["equipment type"] ??
            remapped.equipmentType ??
            row.eqType ??
            row["equipment type"] ??
            "",
        ).trim(),
        eqTypeId: Number(remapped.eqTypeId ?? row.eqTypeId ?? 0) || 0,
        representativeColor: String(
          remapped.representativeColor ?? row.representativeColor ?? "",
        ).trim(),
        processId: Number(remapped.processId ?? row.processId ?? 0) || 0,
        categoryId: Number(remapped.categoryId ?? row.categoryId ?? 0) || 0,
        priorityId: Number(remapped.priorityId ?? row.priorityId ?? 0) || 0,
        siteId: Number(remapped.siteId ?? row.siteId ?? 0) || 0,
        maintenanceId: Number(remapped.maintenanceId ?? row.maintenanceId ?? 0) || 0,
        equipmentId: Number(remapped.equipmentId ?? row.equipmentId ?? 0) || 0,
        createdBy: getUserInfo()?.name || "Chirati Harish",
        is_voc: false,
        isVoc: false,
      };

      if (!clean.eqType && clean.maintGroup) {
        clean.eqType = clean.maintGroup;
      }
      if (!clean.maintGroup && clean.eqType) {
        clean.maintGroup = clean.eqType;
      }
      if (clean.woType) {
        clean.Wotype = clean.woType;
        clean.wo_type = clean.woType;
        clean.woTypeName = clean.woType;
      }

      return clean;
    },
    [excelToJsonKey],
  );

  // ── EDIT CLICK: Fetch row detail from GetMatrixData API ───────────────────
  const handleEditClick = useCallback(
    (index) => {
      const row = filtered[index];
      if (!row) return;

      const rowId = Number(row.id);
      if (!rowId || rowId <= 0 || isStaticDataMode) {
        setEditingIndex(index);
        return;
      }

      setEditModalLoading(true);

      APIcallGet(`${pocEndPoints.GET_MATRIX_DATA}?Id=${rowId}`, {}, (responseData, status) => {
        setEditModalLoading(false);
        if (status === 200 && responseData) {
          const detail = parseMatrixDetailResponse(responseData);
          if (detail) {
            const mapped = mapMatrixResponseToRow(detail);
            const merged = { ...row, ...mapped };
            setEditModalRow(merged);
          } else {
            setEditModalRow(row);
          }
          setEditingIndex(index);
        } else {
          console.warn("[ChangeHistory] GetMatrixData for edit failed:", status, responseData);
          setEditModalRow(row);
          setEditingIndex(index);
          setOperationStatus({
            isVisible: true,
            status: "error",
            message: t("toast.detailLoadError", "Failed to load row details."),
            autoClose: true,
          });
        }
      });
    },
    [filtered, t],
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

      // Safe date formatter to avoid invalid dates like "0000-12-31" or "0001-01-01"
      const formatValidDateIso = (rawDate) => {
        if (!rawDate || String(rawDate).startsWith("0000") || String(rawDate).startsWith("0001")) {
          return new Date().toISOString();
        }
        const p = new Date(rawDate);
        if (isNaN(p.getTime()) || p.getFullYear() < 2000) {
          return new Date().toISOString();
        }
        return p.toISOString();
      };

      const catName = mergedRow.category || mergedRow.categoryName || "기타";
      const catObj = (categoryList || []).find(
        (c) => c.categoryName === catName || c.name === catName,
      );
      const categoryIdVal = mergedRow.categoryId ? Number(mergedRow.categoryId) : catObj?.id || 1;

      const priName = mergedRow.priority || mergedRow.priorityName || "일반";
      const priObj = (priorityList || []).find(
        (p) => p.priorityName === priName || p.name === priName,
      );
      const priorityIdVal = mergedRow.priorityId
        ? Number(mergedRow.priorityId)
        : priObj?.id || (priName === "중요" || priName === "Important" ? 2 : 1);

      const siteNameVal = mergedRow.site || mergedRow.siteName || "";
      const siteObj = (siteList || []).find(
        (s) => s.siteName === siteNameVal || s.name === siteNameVal,
      );
      const siteIdVal = mergedRow.siteId ? Number(mergedRow.siteId) : siteObj?.id || 1;

      const procNameVal = mergedRow.process || mergedRow.processName || "";
      const procObj = (filterPayload?.process || []).find(
        (p) => p.processName === procNameVal || p.name === procNameVal,
      );
      const processIdVal = mergedRow.processId
        ? Number(mergedRow.processId)
        : procObj?.id || (selectedProcessId ? Number(selectedProcessId) : 1);

      const eqTypeNameVal =
        mergedRow.eqType ||
        mergedRow.equipmentTypeName ||
        mergedRow.maintGroup ||
        mergedRow.maintenanceGroupName ||
        "";
      const eqTypeObj = (filterPayload?.eqTypes || filterPayload?.maintenance || []).find(
        (e) => e.equipmentTypeName === eqTypeNameVal || e.maintenanceGroupName === eqTypeNameVal,
      );
      const equipmentTypeIdVal =
        mergedRow.eqTypeId || mergedRow.equipmentTypeId
          ? Number(mergedRow.eqTypeId || mergedRow.equipmentTypeId)
          : eqTypeObj?.id
            ? Number(eqTypeObj.id)
            : selectedMaintenanceId
              ? Number(selectedMaintenanceId)
              : 78;

      const woCodeVal = mergedRow.woCode || mergedRow.wOCode || mergedRow.wo_code || "";

      const vocItem = {
        id: Number(mergedRow.id) || 0,
        repWorkId: Number(mergedRow.repWorkId ?? mergedRow.rep_work_id ?? 0) || 0,
        repMappingId:
          Number(mergedRow.repWorkId ?? mergedRow.rep_work_id ?? mergedRow.repMappingId ?? 0) || 0,
        workOrderId:
          Number(
            mergedRow.woTypeId ?? mergedRow.work_order_type_id ?? mergedRow.workOrderId ?? 0,
          ) || 0,
        equipmentId: Number(mergedRow.equipmentId ?? mergedRow.equipment_id ?? 0) || 0,
        reportContent: mergedRow.reportContent || mergedRow.report || "",
        workName: mergedRow.representativeWork || mergedRow.workName || mergedRow.work_name || "",
        purpose: mergedRow.purpose || mergedRow.workPurpose || mergedRow.work || "",
        situation: mergedRow.situation || mergedRow.problemSymptom || "",
        cause: mergedRow.cause || mergedRow.problemCause || "",
        hwWas: mergedRow.hwAsWas || mergedRow.hw_was || mergedRow.hwBefore || "",
        hwIs: mergedRow.hwAsIs || mergedRow.hw_is || mergedRow.hwAfter || "",
        swWas: mergedRow.swAsWas || mergedRow.sw_was || mergedRow.swBefore || "",
        swIs: mergedRow.swAsIs || mergedRow.sw_is || mergedRow.swAfter || "",
        bom: mergedRow.bom || "",
        sparePart: mergedRow.sparePart || mergedRow.spare_part || mergedRow.materialList || "",
        equipmentCode:
          mergedRow.equipmentCode ||
          mergedRow.equipment_code ||
          mergedRow.Eqcode ||
          mergedRow.eqcode ||
          "-",
        equipmentName:
          mergedRow.equipmentName ||
          mergedRow.equipment_name ||
          mergedRow.Eqname ||
          mergedRow.eqname ||
          " Common",
        woCode: woCodeVal,
        wOCode: woCodeVal,
        wo_code: woCodeVal,
        workDate: formatValidDateIso(
          mergedRow.workedOn || mergedRow.workDate || mergedRow.work_date,
        ),
        categoryName: catName,
        priorityName: priName,
        priorityId: priorityIdVal,
        categoryId: categoryIdVal,
        processName: procNameVal,
        siteName: siteNameVal,
        maintenanceGroupName: eqTypeNameVal,
        equipmentTypeName: eqTypeNameVal,
        processId: processIdVal,
        siteId: siteIdVal,
        equipmentTypeId: equipmentTypeIdVal,
        createdBy: mergedRow.createdBy || getUserInfo()?.name || "Chirati Harish",
      };

      const payload = {
        vocData: [vocItem],
        isVoc: false,
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

      APIcallPost(pocEndPoints.SAVE_VOC, payload, {}, (responseData, status) => {
        const isDuplicate =
          status === 409 ||
          responseData?.statusCode === 409 ||
          responseData?.data?.[0]?.is_duplicate === true ||
          (typeof responseData?.message === "string" &&
            responseData.message.toLowerCase().includes("duplicate"));

        if (isDuplicate) {
          const dupMsg =
            responseData?.message ||
            t("mp.duplicateFound", "1 duplicate record(s) found. Please review.");

          setOperationStatus({
            isVisible: true,
            status: "error",
            message: dupMsg,
            autoClose: true,
          });
          return;
        }

        if (status >= 200 && status < 300 && responseData?.statusCode !== 409) {
          const photosList = mergedRow.photos || draft?.photos || [];
          if (pocEndPoints?.SAVE_IMAGE && photosList.length > 0) {
            const historyIdVal = Number(
              responseData?.data?.[0]?.id || responseData?.id || mergedRow.id || 0,
            );
            const saveImagePayload = {
              historyId: historyIdVal,
              images: photosList.map((photo, idx) => ({
                filename: photo.filename || photo.name || `image_${idx + 1}.png`,
                fileContent: photo.fileContent || photo.previewUrl || "",
                category: photo.category || "Others",
                caption: photo.caption || photo.filename || photo.name || "",
                sortOrder: idx,
              })),
            };

            APIcallPost(pocEndPoints.SAVE_IMAGE, saveImagePayload, {}, (imgRes, imgStatus) => {
              if (imgStatus >= 200 && imgStatus < 300) {
                console.log("[ChangeHistory] SaveImage API success:", imgRes);
              } else {
                console.error("[ChangeHistory] SaveImage API failed:", imgStatus, imgRes);
              }
            });
          }

          setEditingIndex(null);
          setOperationStatus({
            isVisible: true,
            status: "success",
            message: `${changeDataList.length} ${t("app.rows")} - ${t("toast.saveSuccess")}`,
            autoClose: true,
          });
          onUpload?.("change_rows", payload);
          getFilterDataRef.current?.();
          window.dispatchEvent(new Event("refreshMatrixData"));
          window.dispatchEvent(new Event("refreshMPListData"));
          window.dispatchEvent(new Event("refreshFilterData"));
          window.dispatchEvent(new Event("refreshChangeHistoryData"));
        } else {
          console.error("행 저장 실패:", responseData);
          setOperationStatus({
            isVisible: true,
            status: "error",
            message: responseData?.message || t("toast.rowSaveError"),
            autoClose: true,
          });
        }
      });
    },
    [filtered, changedRecords, changedDataId, buildCleanRow, onUpload, selectedProcessId, t],
  );

  const handleCancelEdit = useCallback(() => setEditingIndex(null), []);

  const handleOpenDetail = useCallback(
    (row) => {
      const rowId = Number(row?.id);
      if (isStaticDataMode || !rowId || rowId <= 0) {
        setDrawerItem(row);
        return;
      }

      APIcallGet(`${pocEndPoints.GET_MATRIX_DATA}?Id=${rowId}`, {}, (responseData, status) => {
        if (status === 200 && responseData) {
          const detail = parseMatrixDetailResponse(responseData);
          const mappedDetail = detail ? mapMatrixResponseToRow(detail) : null;
          const merged = mappedDetail ? { ...row, ...mappedDetail } : row;
          setDrawerItem(merged);
        } else {
          console.warn("[ChangeHistory] GetMatrixData failed:", status, responseData);
          setOperationStatus({
            isVisible: true,
            status: "error",
            message: t("toast.detailLoadError", "Failed to load row details."),
            autoClose: true,
          });
          setDrawerItem(row);
        }
      });
    },
    [excelToJsonKey, t],
  );

  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleConfirmDelete = useCallback(() => {
    if (selectedIds.size === 0) return;

    const rowsToDelete = filtered.filter((_, i) => selectedIds.has(i));
    const ids = rowsToDelete.map((r) => Number(r.id)).filter((id) => !Number.isNaN(id) && id > 0);

    if (ids.length === 0) {
      setOperationStatus({
        isVisible: true,
        status: "error",
        message: t("toast.deleteError", "삭제에 실패했습니다."),
        autoClose: true,
      });
      return;
    }

    setOperationStatus({
      isVisible: true,
      status: "loading",
      message: `${rowsToDelete.length} ${t("app.rows", "건")} ${t("toast.deleting", "삭제 중입니다...")}`,
      autoClose: false,
    });

    if (isStaticDataMode) {
      const idsToDelete = new Set(ids);
      const updatedRecords = changedRecords.filter((r) => !idsToDelete.has(Number(r.id)));
      setChangedRecords([...updatedRecords].sort((a, b) => (b.id ?? 0) - (a.id ?? 0)));
      setSelectedIds(new Set());
      setShowDeleteModal(false);
      setOperationStatus({
        isVisible: true,
        status: "success",
        message: `${rowsToDelete.length}${t("app.rows", "건")} - ${t("app.deleteSuccess", "항목이 성공적으로 삭제되었습니다.")}`,
        autoClose: true,
      });
      return;
    }

    APIcallPost(pocEndPoints.DELETE_CHANGE_DATA, { ids }, {}, (responseData, status) => {
      if (status === 200) {
        setSelectedIds(new Set());
        setShowDeleteModal(false);
        setOperationStatus({
          isVisible: true,
          status: "success",
          message: `${rowsToDelete.length}${t("app.rows", "건")} - ${t("app.deleteSuccess", "항목이 성공적으로 삭제되었습니다.")}`,
          autoClose: true,
        });
        getFilterDataRef.current?.();
        window.dispatchEvent(new Event("refreshMatrixData"));
        window.dispatchEvent(new Event("refreshMPListData"));
        window.dispatchEvent(new Event("refreshFilterData"));
        window.dispatchEvent(new Event("refreshChangeHistoryData"));
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
  }, [selectedIds, filtered, changedRecords, t]);

  // ── MODAL CONFIRM (bulk upload) ───────────────────────────────────────────
  // Send uploaded excel rows directly without comparing or merging with existing records
  const handleModalConfirm = useCallback(
    (updatedRows, onResult) => {
      const maxId = changedRecords.reduce((max, r) => Math.max(max, Number(r.id) || 0), 0);
      let nextId = maxId + 1;

      // Remap excel column names → json keys and set id to 0
      const remappedRows = updatedRows.map((row) => {
        const remapped = remapRowKeys(row, excelToJsonKey, validKeys);
        const clean = buildCleanRow({ ...row, ...remapped });
        clean.id = 0;
        return clean;
      });

      // Insert all uploaded Excel rows — do NOT merge with existing DB records
      const changeDataList = remappedRows;

      const payload = {
        changeDataList,
        id: changedDataId, // ← same envelope id
      };

      if (isStaticDataMode) {
        setPreviewRows(null);
        setPreviewColumns(null);
        setChangedRecords((prev) =>
          [...changeDataList, ...prev].sort((a, b) => (b.id ?? 0) - (a.id ?? 0)),
        );
        setOperationStatus({
          isVisible: true,
          status: "success",
          message: `${changeDataList.length} ${t("app.rows")} - ${t("toast.saveSuccess")}`,
          autoClose: true,
        });
        onUpload?.("change_rows", payload);
        onResult?.({ success: true });
        return;
      }

      setOperationStatus({
        isVisible: true,
        status: "loading",
        message: `${changeDataList.length} ${t("app.rows", "건")} - ${t("toast.saving", "Saving data...")}`,
        autoClose: false,
      });

      APIcallPost(pocEndPoints?.SAVE_DATA_CHANGES, payload, {}, (responseData, status) => {
        const isDuplicateResponse =
          status === 409 ||
          responseData?.statusCode === 409 ||
          (Array.isArray(responseData?.data) && responseData.data.some((item) => item?.is_duplicate === true)) ||
          (typeof responseData?.message === "string" &&
            responseData.message.toLowerCase().includes("duplicate"));

        if (isDuplicateResponse) {
          // Parse is_duplicate flags from response data and highlight rows in modal
          const dupData = Array.isArray(responseData?.data)
            ? responseData.data
            : Array.isArray(responseData)
              ? responseData
              : [];
          const dupKeySet = new Set();

          dupData.forEach((item, idx) => {
            if (item?.is_duplicate) {
              const row = updatedRows[idx];
              if (row) {
                const rowKey = getPreviewDuplicateKey(row);
                dupKeySet.add(rowKey);
              }
            }
          });

          // Also check extractDuplicateKeysFromBackend
          const extractedKeys = extractDuplicateKeysFromBackend(
            responseData,
            updatedRows,
            getPreviewDuplicateKey,
          );
          extractedKeys.forEach((k) => dupKeySet.add(k));

          // If no specific row was flagged but backend reported duplicate, flag all updated rows
          if (dupKeySet.size === 0 && updatedRows.length > 0) {
            updatedRows.forEach((row, idx) => {
              const rowKey = getPreviewDuplicateKey ? getPreviewDuplicateKey(row) : (row._originalIndex ?? idx);
              dupKeySet.add(rowKey);
            });
          }

          onResult?.({
            success: false,
            hasDuplicates: true,
            duplicateKeys: dupKeySet,
            message:
              responseData?.message ||
              t("toast.duplicateFoundApi", "Duplicate records detected by backend validation."),
          });
          setOperationStatus({
            isVisible: true,
            status: "error",
            message:
              responseData?.message ||
              t("toast.duplicateFoundApi", "Duplicate records detected by backend validation."),
            autoClose: false,
          });
          return;
        }

        if (status >= 200 && status < 300) {
          const extractedKeys = extractDuplicateKeysFromBackend(
            responseData,
            updatedRows,
            getPreviewDuplicateKey,
          );

          if (extractedKeys && extractedKeys.size > 0) {
            console.warn("Backend API returned duplicate validation keys:", extractedKeys);
            onResult?.({
              success: false,
              hasDuplicates: true,
              duplicateKeys: extractedKeys,
              message: t(
                "toast.duplicateFoundApi",
                "Duplicate records detected by backend validation.",
              ),
            });
            setOperationStatus({
              isVisible: true,
              status: "error",
              message: t(
                "toast.duplicateFoundApi",
                "Duplicate records detected by backend validation.",
              ),
              autoClose: false,
            });
          } else {
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
            window.dispatchEvent(new Event("refreshMatrixData"));
            window.dispatchEvent(new Event("refreshMPListData"));
            window.dispatchEvent(new Event("refreshFilterData"));
            window.dispatchEvent(new Event("refreshChangeHistoryData"));
            onResult?.({ success: true });
          }
        } else {
          console.error("일괄 저장 실패:", responseData);
          let errorMsg = responseData?.message || responseData?.error || responseData?.title;

          if (responseData?.errors && typeof responseData.errors === "object") {
            const validationList = [];
            Object.entries(responseData.errors).forEach(([field, msgs]) => {
              const fieldName = field.replace(/^(ChangeDataList|SpecDataList)\./i, "");
              const msgText = Array.isArray(msgs) ? msgs.join(", ") : String(msgs);
              validationList.push(`${fieldName}: ${msgText}`);
            });
            if (validationList.length > 0) {
              errorMsg = `Backend Validation Error:\n\n${validationList.join("\n")}`;
            }
          }

          if (!errorMsg) {
            errorMsg = t("toast.saveError");
          }

          onResult?.({ success: false, hasValidationError: true, message: errorMsg });
          setOperationStatus({
            isVisible: true,
            status: "error",
            message: errorMsg,
            autoClose: false,
          });
        }
      });
    },
    [
      changedRecords,
      changedDataId,
      excelToJsonKey,
      buildCleanRow,
      onUpload,
      t,
      validKeys,
      getPreviewDuplicateKey,
    ],
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

    const filterColsList = [];
    changeDataColumns
      .filter((item) => item.isActive !== false)
      .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
      .forEach((item) => {
        const colName = (item.excelColumnName || "").replace(/\r?\n/g, "").trim();
        if (colName) {
          filterColsList.push(colName);
          const lower = colName.toLowerCase();
          if (lower === "equipment_name" || lower === "eqname" || lower === "equipmentname") {
            if (!filterColsList.includes("equipment_name")) filterColsList.push("equipment_name");
            if (!filterColsList.includes("Eqname")) filterColsList.push("Eqname");
            if (!filterColsList.includes("eqname")) filterColsList.push("eqname");
            if (!filterColsList.includes("equipmentName")) filterColsList.push("equipmentName");
          }
          if (lower === "equipment_code" || lower === "eqcode" || lower === "equipmentcode") {
            if (!filterColsList.includes("equipment_code")) filterColsList.push("equipment_code");
            if (!filterColsList.includes("Eqcode")) filterColsList.push("Eqcode");
            if (!filterColsList.includes("eqcode")) filterColsList.push("eqcode");
            if (!filterColsList.includes("equipmentCode")) filterColsList.push("equipmentCode");
          }
        }
      });
    const filterColumns = filterColsList.join(",");

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
              .filter((c) => c.isActive !== false)
              .sort((a, b) => a.sequence - b.sequence)
              .map((c) => c.excelColumnName)
              .filter(Boolean);

            const KEY_ALIASES = {
              equipmentcode: ["eqcode", "equipmentcode", "equipment code", "eq_code", "equipment_code", "설비코드"],
              equipment_code: ["eqcode", "equipmentcode", "equipment code", "eq_code", "equipment_code", "설비코드"],
              eqcode: ["eqcode", "equipmentcode", "equipment code", "eq_code", "equipment_code", "설비코드"],
              eq_code: ["eqcode", "equipmentcode", "equipment code", "eq_code", "equipment_code", "설비코드"],
              equipmentname: ["eqname", "equipmentname", "equipment name", "eq_name", "equipment_name", "설비명"],
              equipment_name: ["eqname", "equipmentname", "equipment name", "eq_name", "equipment_name", "설비명"],
              eqname: ["eqname", "equipmentname", "equipment name", "eq_name", "equipment_name", "설비명"],
              eq_name: ["eqname", "equipmentname", "equipment name", "eq_name", "equipment_name", "설비명"],
              wocode: ["w/ocode", "wocode", "wo code", "wo_code", "w_o_code", "작업지시서 코드", "w/o코드"],
              wo_code: ["w/ocode", "wocode", "wo code", "wo_code", "w_o_code", "작업지시서 코드", "w/o코드"],
              wotype: ["wotype", "wo type", "wo_type", "wo유형", "w/o유형"],
              wo_type: ["wotype", "wo type", "wo_type", "wo유형", "w/o유형"],
              representativework: [
                "rep_work",
                "repwork",
                "representative work",
                "representative_work",
                "대표 작업명",
                "대표작업명",
              ],
              workedon: [
                "worked date",
                "workeddate",
                "worked_date",
                "workedon",
                "worked on",
                "workdate",
                "work_date",
                "작업완료일",
              ],
              eqtype: ["equipment type", "equipmenttype", "equipment_type", "eqtype", "eq type", "보전파트", "보전그룹"],
              report: ["report content", "reportcontent", "report_content", "report", "보고서"],
              work: ["work description", "workdescription", "work_description", "work", "개선 작업", "작업"],
              hwasis: ["hw as is", "hwasis", "hw_as_is", "hw after", "hw_after", "hw변경후", "HW 변경 후"],
              swasis: ["sw as is", "swasis", "sw_as_is", "sw after", "sw_after", "sw변경후", "SW 변경 후"],
              hwaswas: ["hw as was", "hwaswas", "hw_as_was", "hw before", "hw_before", "hw변경전", "HW 변경 전"],
              swaswas: ["sw as was", "swaswas", "sw_as_was", "sw before", "sw_before", "sw변경전", "SW 변경 전"],
              sparepart: [
                "sparepart",
                "spare part",
                "spare_part",
                "sparepartname",
                "sparepart_name",
                "자재명",
                "자재 명",
                "자재목록",
                "예비 부품",
                "예비부품",
              ],
              sparepartname: [
                "sparepart",
                "spare part",
                "spare_part",
                "sparepartname",
                "sparepart_name",
                "자재명",
                "자재 명",
                "자재목록",
                "예비 부품",
                "예비부품",
              ],
            };

            // Normalize row keys to match excelColumnName exactly (case-insensitive & alias fallback)
            const rawRows = Array.isArray(res?.rows) ? res.rows : [];
            const normalizedRows = rawRows.map((row) => {
              const cleanRow = { ...row };
              changeDataColumns.forEach((col) => {
                if (col.excelColumnName) {
                  const excelName = col.excelColumnName?.trim().toLowerCase();
                  const jsonKey = col.jsonKey?.trim().toLowerCase();
                  const krName = col.columnNameKr?.trim().toLowerCase();

                  let matchedKey = Object.keys(row).find((k) => {
                    const lk = k.trim().toLowerCase();
                    return lk === excelName || lk === jsonKey || lk === krName;
                  });

                  if (matchedKey === undefined) {
                    const aliases = KEY_ALIASES[jsonKey] || KEY_ALIASES[excelName] || [];
                    matchedKey = Object.keys(row).find((k) => {
                      const lk = k.trim().toLowerCase();
                      return aliases.includes(lk);
                    });
                  }

                  const val = matchedKey !== undefined ? row[matchedKey] : undefined;
                  cleanRow[col.excelColumnName] = val;
                  if (jsonKey) cleanRow[jsonKey] = val;
                }
              });

              // Explicit fallbacks for equipmentName, equipmentCode, sparePart, equipment type, Wotype, workedOn
              const eqNameVal =
                row["equipment_name"] ||
                row["equipmentName"] ||
                row["equipment name"] ||
                row["equipmentname"] ||
                row["eqname"] ||
                row["Eqname"] ||
                row["eq_name"] ||
                row["설비명"] ||
                cleanRow.equipmentName ||
                cleanRow.equipment_name ||
                cleanRow.Eqname ||
                cleanRow.eqname;

              if (eqNameVal !== undefined && eqNameVal !== null && String(eqNameVal).trim() !== "") {
                const nVal = String(eqNameVal).trim();
                cleanRow.equipmentName = nVal;
                cleanRow.equipment_name = nVal;
                cleanRow.Eqname = nVal;
                cleanRow.eqname = nVal;
                cleanRow["equipment_name"] = nVal;
              }

              const eqCodeVal =
                row["equipment_code"] ||
                row["equipmentCode"] ||
                row["equipment code"] ||
                row["equipmentcode"] ||
                row["eqcode"] ||
                row["Eqcode"] ||
                row["eq_code"] ||
                row["설비코드"] ||
                cleanRow.equipmentCode ||
                cleanRow.equipment_code ||
                cleanRow.Eqcode ||
                cleanRow.eqcode;

              if (eqCodeVal !== undefined && eqCodeVal !== null && String(eqCodeVal).trim() !== "") {
                const cVal = String(eqCodeVal).trim();
                cleanRow.equipmentCode = cVal;
                cleanRow.equipment_code = cVal;
                cleanRow.Eqcode = cVal;
                cleanRow.eqcode = cVal;
                cleanRow["equipment_code"] = cVal;
              }

              const sparePartVal =
                row["sparePart"] ||
                row["spare_part"] ||
                row["spare part"] ||
                row["sparepart"] ||
                row["Sparepart"] ||
                row["sparePartName"] ||
                row["자재명"] ||
                row["자재 명"] ||
                cleanRow.sparePart ||
                cleanRow.sparepart ||
                cleanRow["spare part"] ||
                cleanRow["자재명"];

              if (
                sparePartVal !== undefined &&
                sparePartVal !== null &&
                String(sparePartVal).trim() !== ""
              ) {
                const sVal = String(sparePartVal).trim();
                cleanRow.sparePart = sVal;
                cleanRow.sparepart = sVal;
                cleanRow["spare part"] = sVal;
                cleanRow["자재명"] = sVal;
              }

              const eqTypeVal =
                row["equipment type"] ||
                row["equipmentType"] ||
                row["eqType"] ||
                row["eqtype"] ||
                cleanRow.equipment ||
                cleanRow.eqType;

              if (eqTypeVal) {
                cleanRow.equipment = cleanRow.equipment || eqTypeVal;
                cleanRow.eqType = cleanRow.eqType || eqTypeVal;
                cleanRow["equipment type"] = cleanRow["equipment type"] || eqTypeVal;
              }

              const woTypeVal =
                row["Wotype"] ||
                row["woType"] ||
                row["wotype"] ||
                row["wo type"] ||
                cleanRow.woType;

              if (woTypeVal) {
                cleanRow.woType = cleanRow.woType || woTypeVal;
                cleanRow.Wotype = cleanRow.Wotype || woTypeVal;
              }

              const workedOnVal =
                row["workedDate"] ||
                row["worked_date"] ||
                row["workDate"] ||
                row["work_date"] ||
                row["workedOn"] ||
                row["worked date"] ||
                row["작업완료일"] ||
                cleanRow.workedOn;

              if (workedOnVal) {
                cleanRow.workedOn = cleanRow.workedOn || workedOnVal;
                cleanRow.workedDate = cleanRow.workedDate || workedOnVal;
                cleanRow["worked date"] = cleanRow["worked date"] || workedOnVal;
              }

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

  const handleAiPipelineUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";
    setAiImportBusy(true);

    setOperationStatus({
      isVisible: true,
      status: "loading",
      message: t("toast.aiPipelineUploading", "AI Pipeline 업로드 중..."),
      autoClose: false,
    });

    try {
      const formData = new FormData();
      formData.append("file", file);

      const userInfo = getUserInfo();
      const createdBy = userInfo?.name || getUserDisplayName(userInfo) || "admin";
      const baseUrl = pocEndPoints.AI_PIPELINE_UPLOAD;
      const separator = baseUrl.includes("?") ? "&" : "?";
      const apiUrl = `${baseUrl}${separator}created_by=${encodeURIComponent(createdBy)}`;

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          accept: "application/json",
        },
        body: formData,
      });

      if (response.ok) {
        setOperationStatus({
          isVisible: true,
          status: "success",
          message: t("toast.aiPipelineSuccess", "AI Pipeline 업로드가 성공적으로 완료되었습니다."),
          autoClose: true,
        });
        fetchMasterData();
        if (
          selectedProcessId !== null &&
          selectedMaintenanceId !== null &&
          Number(selectedProcessId) > 0 &&
          Number(selectedMaintenanceId) > 0
        ) {
          fetchChangedData();
        }
        navigate("/ai-pipeline/jobs");
      } else {
        const errText = await response.text().catch(() => "");
        console.error("AI Pipeline upload error:", response.status, errText);
        setOperationStatus({
          isVisible: true,
          status: "error",
          message: t("toast.aiPipelineError", "AI Pipeline 업로드 실패했습니다."),
          autoClose: true,
        });
      }
    } catch (err) {
      console.error("AI Pipeline upload network error:", err);
      setOperationStatus({
        isVisible: true,
        status: "error",
        message: t("toast.aiPipelineError", "AI Pipeline 업로드 실패했습니다."),
        autoClose: true,
      });
    } finally {
      setAiImportBusy(false);
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

  const generateAndDownloadSampleExcel = (columns) => {
    try {
      const activeCols = [...(columns || [])]
        .filter((c) => c.isActive !== false)
        .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));

      const headers = activeCols
        .map((col) =>
          (col.excelColumnName || col.columnNameKr || col.jsonKey || "")
            .replace(/\r?\n/g, "")
            .trim(),
        )
        .filter(Boolean);

      if (headers.length === 0) {
        setOperationStatus({
          isVisible: true,
          status: "error",
          message: t("toast.noColumnsFound", "No column definitions found."),
          autoClose: true,
        });
        return;
      }

      const worksheet = XLSX.utils.aoa_to_sheet([headers]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
      XLSX.writeFile(workbook, "change_history_sample_form.xlsx");

      setOperationStatus({
        isVisible: true,
        status: "success",
        message: t("toast.sampleDownloadSuccess", "Sample form downloaded successfully."),
        autoClose: true,
      });
    } catch (err) {
      console.error("[ChangeHistory] Failed to generate sample excel:", err);
      setOperationStatus({
        isVisible: true,
        status: "error",
        message: t("toast.sampleDownloadError", "Failed to download sample form."),
        autoClose: true,
      });
    }
  };

  const handleDownloadSampleForm = async () => {
    setDownloadSampleBusy(true);

    if (isStaticDataMode) {
      setTimeout(() => {
        setDownloadSampleBusy(false);
        generateAndDownloadSampleExcel(staticChangeDataColumns);
      }, 200);
      return;
    }

    APIcallGet(`${pocEndPoints?.CHANGE_DATA_COLUMNS}/1`, {}, (responseData, status) => {
      setDownloadSampleBusy(false);
      try {
        if (status === 200 && responseData) {
          const cols = Array.isArray(responseData?.data)
            ? responseData.data
            : Array.isArray(responseData)
              ? responseData
              : changeDataColumns || [];

          generateAndDownloadSampleExcel(cols);
        } else {
          const fallbackCols =
            Array.isArray(changeDataColumns) && changeDataColumns.length > 0
              ? changeDataColumns
              : staticChangeDataColumns;
          generateAndDownloadSampleExcel(fallbackCols);
        }
      } catch (e) {
        console.error("[ChangeHistory] Error processing sample form columns:", e);
        const fallbackCols =
          Array.isArray(changeDataColumns) && changeDataColumns.length > 0
            ? changeDataColumns
            : staticChangeDataColumns;
        generateAndDownloadSampleExcel(fallbackCols);
      }
    });
  };

  const handleExportZip = async () => {
    setExportBusy(true);
    setOperationStatus({
      isVisible: true,
      status: "loading",
      message: t("toast.exporting"),
      autoClose: false,
    });

    try {
      const endpointBase = import.meta.env.VITE_API_BASE_URL || "http://107.108.32.41:9090";
      const path = pocEndPoints.EXPORT_ZIP_BY_IDS || "api/ChangeData/ExportZipByIds";
      const fullUrl = endpointBase
        ? `${endpointBase.endsWith("/") ? endpointBase : endpointBase + "/"}${path}`
        : `http://107.108.32.41:9090/${path}`;

      // Extract IDs from selected rows (or all filtered rows if none selected)
      let idsToExport = [];
      if (selectedIds.size > 0) {
        idsToExport = filtered
          .filter((_, i) => selectedIds.has(i))
          .map((r) => Number(r.id))
          .filter((id) => !Number.isNaN(id) && id > 0);
      }

      const response = await fetch(fullUrl, {
        method: "POST",
        headers: {
          Accept: "*/*",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ids: idsToExport,
        }),
      });

      if (response.ok) {
        const zipBlob = await response.blob();
        if (zipBlob && zipBlob.size > 0) {
          const disposition = response.headers.get("content-disposition") || "";
          let fileName = "change-history.zip";
          if (disposition && disposition.includes("filename=")) {
            const match = disposition.match(/filename\*?=(?:UTF-8''|")?([^";\n]+)"?/i);
            if (match && match[1]) {
              fileName = decodeURIComponent(match[1].trim());
            }
          }

          const url = URL.createObjectURL(zipBlob);
          const link = document.createElement("a");
          link.href = url;
          link.setAttribute("download", fileName);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);

          setOperationStatus({
            isVisible: true,
            status: "success",
            message: t("toast.exportSuccess"),
            autoClose: true,
          });
          setExportBusy(false);
          return;
        }
      }

      throw new Error(`ExportZipByIds returned status: ${response.status}`);
    } catch (error) {
      console.error("ExportZipByIds failed:", error);
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

  const applyChangedDataResponse = useCallback((payload) => {
    let records = extractChangedRecords(payload);

    if (Array.isArray(payload?.changedDataJson) && payload.changedDataJson.length > 0) {
      setChangedDataId(payload.changedDataJson[0].id ?? 0);
    }

    let nextId = 1;
    const sanitized = records.map((r) => {
      const clean = { ...r };
      const numId = Number(clean.id);
      if (isNaN(numId) || numId <= 0) {
        clean.id = nextId++;
      } else if (numId >= nextId) {
        nextId = numId + 1;
      }
      const woVal =
        clean.woCode ??
        clean.wOCode ??
        clean.wo_code ??
        clean["w/ocode"] ??
        clean["W/Ocode"] ??
        clean["W/O코드"] ??
        "";
      if (woVal) {
        clean.woCode = woVal;
        clean.wOCode = woVal;
        clean.wo_code = woVal;
      }
      const wDate =
        clean.workedDate ??
        clean.worked_date ??
        clean.workDate ??
        clean.work_date ??
        clean.workedOn ??
        clean["worked date"] ??
        clean["작업완료일"];
      if (wDate) {
        clean.workedOn = wDate;
      }
      return clean;
    });
    const sorted = sanitized.sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
    setChangedRecords(sorted);
    setApiRecords(sorted);
    return sorted;
  }, []);

  const applyStaticChangedDataFallback = useCallback(() => {
    try {
      const payload = changeFilterDataAndTableData;
      if (Array.isArray(payload?.changedDataJson) && payload.changedDataJson.length > 0) {
        const sorted = applyChangedDataResponse(payload);
        setUsingApiTableData(false);
        setTotalCount(sorted.length);
      } else {
        setChangedDataId(0);
        setChangedRecords([]);
        setApiRecords([]);
        setUsingApiTableData(false);
        setTotalCount(0);
      }
    } catch (error) {
      console.error("[ChangeHistory] Error processing static changed data:", error);
      setChangedRecords([]);
      setApiRecords([]);
      setChangedDataId(0);
      setUsingApiTableData(false);
      setTotalCount(0);
      setFilterError(t("toast.filterError"));
    }
  }, [applyChangedDataResponse, t]);

  const fetchChangedData = useCallback(() => {
    if (
      selectedProcessId === null ||
      selectedMaintenanceId === null ||
      Number(selectedProcessId) <= 0 ||
      Number(selectedMaintenanceId) <= 0
    ) {
      setChangedRecords([]);
      setApiRecords([]);
      setTotalCount(0);
      setIsFiltering(false);
      return;
    }

    setIsFiltering(true);

    const reqBody = {
      processId: Number(selectedProcessId) || 0,
      equipmentTypeId: selectedMaintenanceId ? Number(selectedMaintenanceId) : 0,
      columnIds:
        Array.isArray(selectedColumnIds) && selectedColumnIds.length > 0
          ? selectedColumnIds.map(Number)
          : [0],
      searchText: debouncedSearchText || "",
      rowCount: pageSize || 50,
      currentPage: Math.max(0, (currentPage || 1) - 1),
      isPagination: true,
      isChangeHistoryData: true,
    };

    APIcallPost(pocEndPoints.GET_CHANGED_DATA, reqBody, {}, (responseData, status) => {
      try {
        if (status === 200 && responseData) {
          const payload = responseData?.data ?? responseData;
          setFilterError(null);
          const sorted = applyChangedDataResponse(payload);
          const rowsLength = sorted.length;
          setUsingApiTableData(true);
          setTotalCount(
            parseTotalCountFromResponse(responseData, payload, rowsLength, currentPage, pageSize),
          );
        } else {
          console.warn("[ChangeHistory] GetChangedData returned invalid status:", status);
          if (isStaticDataMode) {
            applyStaticChangedDataFallback();
          } else {
            setChangedRecords([]);
            setApiRecords([]);
            setUsingApiTableData(true);
            setTotalCount(0);
            setFilterError(t("toast.filterLoadError"));
          }
        }
      } catch (error) {
        console.error("[ChangeHistory] Error processing changed data:", error);
        if (isStaticDataMode) {
          applyStaticChangedDataFallback();
        } else {
          setChangedRecords([]);
          setApiRecords([]);
          setUsingApiTableData(true);
          setTotalCount(0);
          setFilterError(t("toast.filterError"));
        }
      } finally {
        setIsFiltering(false);
      }
    });
  }, [
    t,
    selectedProcessId,
    selectedMaintenanceId,
    selectedColumnIds,
    debouncedSearchText,
    currentPage,
    pageSize,
    applyChangedDataResponse,
    applyStaticChangedDataFallback,
  ]);

  const fetchMasterData = useCallback(() => {
    if (isStaticDataMode) {
      setFilterPayload(changeFilterDataAndTableData);
      setFilterError(null);
      return;
    }

    APIcallGet(pocEndPoints.GET_MASTER_DATA, {}, (responseData, status) => {
      try {
        if (status === 200 && responseData) {
          const payload = responseData?.data ?? responseData;
          setFilterPayload(payload);
          setFilterError(null);
        } else {
          console.warn("[ChangeHistory] Master data API invalid status:", status);
          setFilterPayload({ process: [], maintenance: [], eqTypes: [] });
          setFilterError(t("toast.filterLoadError"));
        }
      } catch (error) {
        console.error("[ChangeHistory] Error parsing master data:", error);
        setFilterPayload({ process: [], maintenance: [], eqTypes: [] });
        setFilterError(t("toast.filterError"));
      }
    });
  }, [t]);

  const refreshChangeHistoryData = useCallback(() => {
    fetchMasterData();
    fetchChangedData();
  }, [fetchMasterData, fetchChangedData]);

  useEffect(() => {
    getFilterDataRef.current = refreshChangeHistoryData;
  }, [refreshChangeHistoryData]);

  useEffect(() => {
    fetchMasterData();
  }, [fetchMasterData]);

  useEffect(() => {
    if (location.pathname === "/data-management/change-history-data") {
      fetchMasterData();
      if (
        selectedProcessId !== null &&
        selectedMaintenanceId !== null &&
        Number(selectedProcessId) > 0 &&
        Number(selectedMaintenanceId) > 0
      ) {
        fetchChangedData();
      }
    }
  }, [
    location.pathname,
    fetchMasterData,
    fetchChangedData,
    selectedProcessId,
    selectedMaintenanceId,
  ]);

  useEffect(() => {
    const handleRefresh = () => {
      fetchMasterData();
      if (
        selectedProcessId !== null &&
        selectedMaintenanceId !== null &&
        Number(selectedProcessId) > 0 &&
        Number(selectedMaintenanceId) > 0
      ) {
        fetchChangedData();
      }
    };
    window.addEventListener("refreshChangeHistoryData", handleRefresh);
    return () => window.removeEventListener("refreshChangeHistoryData", handleRefresh);
  }, [fetchMasterData, fetchChangedData, selectedProcessId, selectedMaintenanceId]);

  useEffect(() => {
    if (
      selectedProcessId !== null &&
      selectedMaintenanceId !== null &&
      Number(selectedProcessId) > 0 &&
      Number(selectedMaintenanceId) > 0
    ) {
      fetchChangedData();
    } else {
      setChangedRecords([]);
      setApiRecords([]);
      setTotalCount(0);
    }
  }, [selectedProcessId, selectedMaintenanceId, fetchChangedData]);

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
            <h1 className="page-title flex items-center gap-2.5">
              <i className="fas fa-history text-[#1745c2] text-xl md:text-[22px]" />
              <span>{t("page.change.title")}</span>
            </h1>
            <p className="page-subtitle">{t("page.change.desc")}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <AnimatedActionButton
              className="btn-secondary"
              onClick={handleDownloadSampleForm}
              busy={downloadSampleBusy}
              busyLabel={t("app.downloading", "Downloading...")}
              icon="fas fa-download"
            >
              {t("app.downloadSampleForm", "Download Sample Form")}
            </AnimatedActionButton>
            <AnimatedActionButton
              className="btn-secondary"
              onClick={() => aiFileInput.current?.click()}
              busy={aiImportBusy}
              busyLabel="AI Pipeline..."
              icon="fas fa-robot"
            >
              {t("app.aiPipelineImportCsv", "AI Pipeline Import CSV")}
            </AnimatedActionButton>
            <input
              ref={aiFileInput}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={handleAiPipelineUpload}
            />
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
              className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 text-sm text-red-700 dark:text-red-300 flex items-start gap-2"
              role="alert"
            >
              <i className="fas fa-exclamation-circle mt-0.5 flex-shrink-0" />
              <div>{filterError}</div>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-text-subtle">{t("field.process")}</label>
              {filterLoading ? (
                <SelectSkeleton width="120px" />
              ) : (
                <select
                  className="input-base"
                  value={selectedProcessId ?? ""}
                  onChange={handleProcessChange}
                  style={{ width: "120px", marginTop: 0 }}
                >
                  <option value="">{t("app.choose", "Choose")}</option>
                  {processList.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.processName}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-text-subtle">
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
                  <option value="">{t("app.choose", "Choose")}</option>
                  {equipmentTypeList.map((item) => (
                    <option key={item.id} value={item.id}>
                      {getEquipmentTypeLabel(item)}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-text-subtle">
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
              <label className="text-sm font-medium text-text-subtle">{t("app.search")}</label>
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
                {usingApiTableData ? totalCount : filtered.length}
                {t("app.rows")}
              </span>
              <button
                type="button"
                className="btn-base btn-ghost text-xs flex items-center gap-1.5"
                onClick={toggleSelectAll}
                style={{ minHeight: "38px", padding: "8px 16px" }}
              >
                <i
                  className={`fas ${
                    selectedIds.size === filtered.length && filtered.length > 0
                      ? "fa-square-minus text-blue-600 dark:text-blue-400"
                      : "fa-check-double"
                  }`}
                />
                {selectedIds.size === filtered.length && filtered.length > 0
                  ? t("app.unselectAll", "Unselect All")
                  : t("app.selectAll", "Select All")}
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
          {selectedProcessId === null ||
          selectedMaintenanceId === null ||
          Number(selectedProcessId) <= 0 ||
          Number(selectedMaintenanceId) <= 0 ? (
            <div className="flex-grow flex flex-col items-center justify-center gap-4 p-10 text-center">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-brand-10 text-brand-60 text-4xl">
                <i className="fas fa-history" />
              </div>
              <h2 className="text-xl font-bold text-text-default">
                {t("landing.selectProcessAndMaint")}
              </h2>
              <p className="text-sm text-text-subtlest max-w-md">
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
              <h2 className="text-xl font-bold text-text-default">{t("empty.noMatch")}</h2>
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
                        label={getColumnHeaderLabel(col)}
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
                        onStartEdit={handleEditClick}
                        onSave={handleSaveRow}
                        onCancel={handleCancelEdit}
                        onOpenDetail={handleOpenDetail}
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
          {paginationTotalItems > 0 && (
            <Pagination
              currentPage={currentPage}
              pageSize={pageSize}
              totalItems={paginationTotalItems}
              onPageChange={setCurrentPage}
            />
          )}
        </div>
      </section>

      {/* Upload preview modal */}
      <UploadPreviewModal
        rows={previewRows}
        columns={previewColumns}
        duplicateRowKeys={new Set()}
        getDuplicateKey={getPreviewDuplicateKey}
        onClose={() => {
          setPreviewRows(null);
          setPreviewColumns(null);
        }}
        onConfirm={handleModalConfirm}
        columnDefs={changeDataColumns}
      />

      <RowEditModal
        row={editingIndex !== null ? editModalRow || filtered[editingIndex] : null}
        index={editingIndex}
        columns={dynamicColumns}
        onSave={handleSaveRow}
        onClose={handleCancelEdit}
        filterPayload={filterPayload}
        categoryList={categoryList}
        priorityList={priorityList}
        siteList={siteList}
        repSuggestions={repSuggestions}
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
          <p>
            {t(
              "app.deleteWarning",
              "선택한 데이터가 삭제되며 시스템에 즉시 반영됩니다. 계속하시겠습니까?",
            )}
          </p>
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
          className="fixed inset-0 z-[10000] flex flex-col items-center justify-center p-4 backdrop-blur-md"
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
            <p className="text-sm text-slate-500 text-center animate-pulse">
              Parsing file and loading table records. Please wait.
            </p>
          </div>
        </div>
      )}

      {/* Detailed Information Drawer */}
      <Drawer
        item={drawerItem}
        onClose={() => setDrawerItem(null)}
        variant="changeHistory"
        showEdit={false}
        showAttachments={false}
        showFooter={false}
      />
    </>
  );
}
