import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { APIcallGet, APIcallPost } from "../axios/apiCall";
import { pocEndPoints } from "../axios/endPoints";
import { useI18n } from "../i18n.jsx";
import { isStaticDataMode, isLoadTableDataOnload } from "../utils/staticDataMode.js";
import {
  X_AXIS_MODE,
  getCellStyle,
  getDateModeItemStyle,
  normalizePriority,
  getPriorityRank,
} from "../utils/matrixCellStyle.js";
import { getPriorityLabel, getCategoryLabel } from "../utils/filterTranslationHelpers.js";
import { changeFilterDataAndTableData } from "./static-data/ChangeHistoryData.js";
import { useToast } from "../components/ToastContext.jsx";
import Drawer from "../components/Drawer.jsx";

// ─────────────────────────────────────────────────────────────────────────────
// TableSkeleton
// ─────────────────────────────────────────────────────────────────────────────
function TableSkeleton({ columns = [], equipmentRows = [], mode = "date", t }) {
  const rowsCount = equipmentRows.length > 0 ? equipmentRows.length : 8;
  const displayCols =
    columns.length > 0 ? columns : Array.from({ length: 6 }).map((_, i) => `Col ${i + 1}`);

  return (
    <div className="overflow-auto flex-1 min-h-0">
      <table
        className="w-full min-w-max text-sm"
        style={{ borderCollapse: "separate", borderSpacing: 0 }}
      >
        <thead>
          <tr className="border-b border-border-base bg-surface-strong">
            <th
              className="sticky left-0 top-0 z-30 bg-surface-strong px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-text-subtle"
              style={{ width: "100px", position: "sticky", left: 0, top: 0 }}
            >
              {t("field.site", "SITE")}
            </th>
            <th
              className="sticky top-0 z-30 bg-surface-strong px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-text-subtle"
              style={{ width: "120px", position: "sticky", left: "100px", top: 0 }}
            >
              {t("field.equipmentCode", "EQUIPMENT CODE")}
            </th>
            <th
              className="sticky top-0 z-30 bg-surface-strong px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-text-subtle"
              style={{ width: "180px", position: "sticky", left: "220px", top: 0 }}
            >
              {t("field.equipmentName", "EQUIPMENT NAME")}
            </th>
            {displayCols.map((col, cIdx) => (
              <th
                key={col.repWorkId || col || cIdx}
                className="sticky top-0 z-25 bg-surface-strong px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-text-subtle relative group"
                style={{ width: "160px", position: "sticky", top: 0 }}
              >
                {col.repWorkName || col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rowsCount }).map((_, rIdx) => {
            const eq = equipmentRows[rIdx] || { site: "", equipmentCode: "", equipmentName: "" };
            return (
              <tr
                key={rIdx}
                className="group border-b border-border-base last:border-0 hover:bg-fill-active transition-colors"
              >
                <td
                  className="sticky left-0 z-20 bg-surface-default px-4 py-3 font-semibold text-text-default transition-colors"
                  style={{ position: "sticky", left: 0 }}
                >
                  <div className="h-4 bg-gray-100 rounded animate-pulse w-4/5" />
                </td>
                <td
                  className="sticky z-20 bg-surface-default px-4 py-3 font-semibold text-text-default transition-colors"
                  style={{ position: "sticky", left: "100px" }}
                >
                  <div className="h-4 bg-gray-100 rounded animate-pulse w-4/5" />
                </td>
                <td
                  className="sticky z-20 bg-surface-default px-4 py-3 font-semibold text-text-default transition-colors"
                  style={{ position: "sticky", left: "220px" }}
                >
                  <div className="h-4 bg-gray-100 rounded animate-pulse w-4/5" />
                </td>
                {displayCols.map((col, cIdx) => (
                  <td key={col.repWorkId || col || cIdx} className="px-4 py-3">
                    <div className="h-4 bg-gray-100 rounded animate-pulse w-16 mx-auto" />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Reusable SearchableSelect Dropdown Component (Single-Select with Search Input)
// ─────────────────────────────────────────────────────────────────────────────
function SearchableSelect({
  options = [],
  selectedValue,
  onChange,
  placeholder,
  t,
  disabled,
  minWidth = "180px",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
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

  const filteredOptions = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => opt.toLowerCase().includes(q));
  }, [options, searchTerm]);

  const displayLabel =
    selectedValue === "전체" || !selectedValue ? t("app.all", "전체") : selectedValue;

  return (
    <div ref={containerRef} className="relative flex-none" style={{ minWidth }}>
      <button
        type="button"
        onClick={() => {
          if (!disabled) {
            setIsOpen((prev) => !prev);
            setSearchTerm("");
          }
        }}
        disabled={disabled}
        className="input-base flex w-full items-center justify-between text-left font-semibold text-text-default"
        style={{
          height: "38px",
          opacity: disabled ? 0.6 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
          background: disabled
            ? "var(--surface-strong, #f8f9fb)"
            : "var(--surface-default, #ffffff)",
          border: "1px solid var(--border-base, #e6e9ef)",
          borderRadius: "10px",
        }}
      >
        <span className="truncate text-xs font-semibold pr-2">{displayLabel}</span>
        <i
          className={`fas fa-chevron-down text-[10px] text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div
          className="absolute left-0 top-full mt-1.5 z-50 w-64 rounded-2xl theme-dropdown p-2 animate-fade-in"
          style={{ minWidth: "220px" }}
        >
          {/* Search Input */}
          <div className="relative mb-2">
            <input
              type="text"
              autoFocus
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t("matrix.searchRepWork", "작업명 검색...")}
              className="w-full rounded-xl input-base pl-3 pr-8 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
            {searchTerm ? (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
              >
                <i className="fas fa-times" />
              </button>
            ) : (
              <i className="fas fa-search absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none" />
            )}
          </div>

          {/* Options List */}
          <div className="max-h-52 overflow-y-auto space-y-0.5 custom-scrollbar">
            <button
              type="button"
              onClick={() => {
                onChange("전체");
                setIsOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-left transition-colors cursor-pointer ${
                selectedValue === "전체" || !selectedValue
                  ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                  : "text-text-subtle hover:bg-gray-50 dark:hover:bg-gray-700/50"
              }`}
            >
              <span>{t("app.all", "전체")}</span>
              {(selectedValue === "전체" || !selectedValue) && (
                <i className="fas fa-check text-blue-600 dark:text-blue-400 text-xs" />
              )}
            </button>

            {filteredOptions.length === 0 ? (
              <div className="px-3 py-3 text-center text-xs text-gray-400">
                {t("matrix.noMatchingTask", "검색 결과 없음")}
              </div>
            ) : (
              filteredOptions.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    onChange(opt);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-left transition-colors cursor-pointer ${
                    selectedValue === opt
                      ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold"
                      : "text-text-subtle hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  }`}
                >
                  <span className="truncate pr-2">{opt}</span>
                  {selectedValue === opt && (
                    <i className="fas fa-check text-blue-600 dark:text-blue-400 text-xs shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Reusable MultiSelect Dropdown Component with Checkboxes
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
    let next;
    if (selectedValues.includes(value)) {
      next = selectedValues.filter((v) => v !== value);
    } else {
      next = [...selectedValues, value];
    }
    onChange(next);
  };

  const isAllSelected = selectedValues.length === options.length || selectedValues.length === 0;

  let displayText = placeholder || t("app.all", "전체");
  if (!isAllSelected) {
    if (selectedValues.length === 1) {
      const matchOpt = options.find((o) => o.value === selectedValues[0]);
      displayText = matchOpt ? matchOpt.label : selectedValues[0];
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
          className="absolute left-0 right-0 z-[100] mt-1 max-h-[220px] overflow-y-auto rounded-lg border border-border-base bg-surface-default py-1 shadow-lg"
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

function normalizeName(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function firstValue(obj, keys) {
  if (!obj || typeof obj !== "object") return "";
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") {
      return obj[k];
    }
  }
  return "";
}

function isWoTypeMatching(itemWoType, selectedWoType) {
  if (!selectedWoType || selectedWoType === "전체" || selectedWoType === "All") return true;
  if (!itemWoType) return true;
  const normItem = String(itemWoType).trim().toUpperCase();
  const normSel = String(selectedWoType).trim().toUpperCase();
  if (normItem === normSel) return true;
  if (normItem.startsWith("CM") && normSel.startsWith("CM")) return true;
  if (normItem.startsWith("BM") && normSel.startsWith("BM")) return true;
  if (normItem.startsWith("PM") && normSel.startsWith("PM")) return true;
  if (normItem.startsWith("ETC") && normSel.startsWith("ETC")) return true;
  return false;
}

function getColValue(row, col) {
  if (!row) return "";
  if (col === "representativeWork") {
    return (
      row.representative_work_name ??
      row.representativeWorkName ??
      row.representativeWork ??
      row.representative_work ??
      row.rep_work_name ??
      row.rep_work ??
      row.repWorkName ??
      row.repWork ??
      row.work_name ??
      row.workName ??
      row["대표작업명"] ??
      row["대표 작업명"] ??
      ""
    );
  }
  if (col === "report") {
    return row.report_content ?? row.report ?? row["보고서"] ?? "";
  }
  if (col === "change_history_id") {
    return row.change_history_id ?? row.change_history_id ?? row["change_history_id"] ?? "";
  }
  if (col === "work") {
    return row.work ?? row.work_name ?? row.purpose ?? row["작업 목적"] ?? row["작업목적"] ?? "";
  }
  if (col === "situation") {
    return row.situation ?? row["문제 현상"] ?? "";
  }
  if (col === "cause") {
    return row.cause ?? row["문제 원인"] ?? "";
  }
  if (col === "bom") {
    return row.bom ?? row["BOM"] ?? "";
  }
  if (col === "sparePart") {
    return row.spare_part ?? row.sparePart ?? row["자재명"] ?? "";
  }
  if (col === "hwAsWas") {
    return row.hw_was ?? row.hwAsWas ?? row.hwBefore ?? row["HW 변경 전"] ?? "";
  }
  if (col === "hwAsIs") {
    return row.hw_is ?? row.hwAsIs ?? row.hwAfter ?? row["HW 변경 후"] ?? "";
  }
  if (col === "swAsWas") {
    return row.sw_was ?? row.swAsWas ?? row.swBefore ?? row["SW 변경 전"] ?? "";
  }
  if (col === "swAsIs") {
    return row.sw_is ?? row.swAsIs ?? row.swAfter ?? row["SW 변경 후"] ?? "";
  }
  if (col === "priority") {
    return row.priority_name ?? row.priorityName ?? row.priority ?? row["중요도"] ?? "";
  }
  if (col === "category") {
    return (
      row.category_name ??
      row.categoryName ??
      row.category ??
      row["효과 유형"] ??
      row["효과유형"] ??
      ""
    );
  }
  if (col === "woType") {
    return (
      row.woType ??
      row.wo_type ??
      row.wotype ??
      row.Wotype ??
      row.work_order_type_name ??
      row.workOrderTypeName ??
      row.woTypeName ??
      row["wo type"] ??
      row["WO유형"] ??
      row["WO 유형"] ??
      row["w/o유형"] ??
      ""
    );
  }
  if (col === "wOCode") {
    return row.wo_code ?? row.wOCode ?? row.woCode ?? row["W/O코드"] ?? "";
  }
  if (col === "workedOn") {
    return (
      row.workedDate ??
      row.worked_date ??
      row.work_date ??
      row.workDate ??
      row.workedOn ??
      row["작업완료일"] ??
      ""
    );
  }
  if (col === "process") {
    return row.process_name ?? row.processName ?? row.process ?? row["공정"] ?? "";
  }
  if (col === "maintGroup") {
    return (
      row.equipment_type_name ??
      row.equipmentTypeName ??
      row.maintGroup ??
      row["보전파트"] ??
      row.equipment ??
      ""
    );
  }
  if (col === "site") {
    return row.site_name ?? row.siteName ?? row.site ?? row["법인"] ?? "";
  }
  if (col === "equipmentCode") {
    return (
      row.equipment_code ??
      row.equipmentCode ??
      row.eqcode ??
      row.Eqcode ??
      row.eq_code ??
      row["설비코드"] ??
      ""
    );
  }
  if (col === "equipmentName") {
    return (
      row.equipment_name ??
      row.equipmentName ??
      row.eqname ??
      row.Eqname ??
      row.eq_name ??
      row["설비명"] ??
      ""
    );
  }
  if (col === "versionId") {
    return row.version_id ?? row.versionId ?? row.version_tag ?? 0;
  }
  if (col === "createdBy") {
    return row.created_by ?? row.createdBy ?? row["작성자"] ?? "";
  }
  if (col === "updatedBy") {
    return row.updated_by ?? row.updatedBy ?? row["수정자"] ?? "";
  }
  return row[col] ?? "";
}

// ── Matrix detail API helpers ──────────────────────────────────────────
// ── Matrix detail API helpers ──────────────────────────────────────────
const matrixDetailMap = {
  change_history_id: "id",
  report_content: "report",
  work_order_type_name: "woType",
  equipment_code: "equipmentCode",
  equipment_name: "equipmentName",
  rep_work_id: "repWorkId",
  representative_work_name: "representativeWork",
  work_name: "workName",
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
  work_date: "workedOn",
  equipment_type_name: "maintGroup",
  site_name: "site",
  maintenance_group_name: "maintGroup",
  bom: "bom",
  spare_part: "sparePart",
  wo_code: "wOCode",
  work: "work",
  status: "status",
  version_id: "versionId",
  is_voc: "isVoc",
  created_by: "createdBy",
  updated_by: "modifiedBy",
  created_at: "createdAt",
  updated_at: "modifiedAt",
  work_order_type_id: "woTypeId",
  equipment_id: "equipmentId",
  category_id: "categoryId",
  priority_id: "priorityId",
  process_id: "processId",
  site_id: "siteId",
  equipment_type_id: "equipmentTypeId",
};

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

function mapMatrixDetailToRow(detail) {
  if (!detail || typeof detail !== "object") return {};
  const mapped = { ...detail };
  for (const [key, value] of Object.entries(detail)) {
    const mappedKey = matrixDetailMap[key];
    if (mappedKey && value !== null && value !== undefined) {
      mapped[mappedKey] = value;
    }
  }
  return mapped;
}

export default function Matrix({ data, onOpenDetail, onUpload, searchText, isActive }) {
  const { t } = useI18n();
  const toastCtx = useToast();
  const pushToast = toastCtx?.pushToast || ((msg) => console.log(msg));
  const [drawerItem, setDrawerItem] = useState(null);
  const [mode, setMode] = useState("date");
  const [filterData, setFilterData] = useState(null);
  const [loading, setLoading] = useState(true);

  // ── Edit Modal State (for Drawer edit button) ──────────────────────────
  const [showEditModal, setShowEditModal] = useState(false);
  const [editRowData, setEditRowData] = useState({});
  const [editRowId, setEditRowId] = useState(null);
  const [editErrors, setEditErrors] = useState({});
  const [editLoading, setEditLoading] = useState(false);

  // ── Drawer: fetch full detail from GetMatrixData API ──────────────────
  const handleOpenDrawer = useCallback((item) => {
    setDrawerItem(item);

    const firstObj = Array.isArray(item) ? item[0] : item;
    if (!firstObj) return;

    const repWorkNameFromCell =
      firstObj.representative_work_name ||
      firstObj.representativeWork ||
      firstObj.representativeWorkName ||
      firstObj.repWorkName ||
      firstObj.rep_work_name ||
      "";
    const repWorkIdFromCell =
      firstObj.rep_work_id ||
      firstObj.repWorkId ||
      firstObj.repo_work_id ||
      firstObj.repoWorkId ||
      0;
    const statusFromCell =
      firstObj.status ??
      firstObj.apply_status ??
      firstObj.effectiveStatus;

    const rowId = Number(
      firstValue(firstObj, [
        "change_history_id",
        "changeHistoryId",
        "id",
        "rep_work_id",
        "repWorkId",
      ]) || 0,
    );

    if (!rowId || rowId <= 0 || isStaticDataMode) {
      return;
    }

    APIcallGet(`${pocEndPoints.GET_MATRIX_DATA}?Id=${rowId}`, {}, (responseData, status) => {
      if (status === 200 && responseData) {
        const detail = parseMatrixDetailResponse(responseData);
        if (detail) {
          if (Array.isArray(detail)) {
            const mappedList = detail.map((d) => {
              const m = mapMatrixDetailToRow(d);
              return {
                ...m,
                ...firstObj,
                representative_work_name:
                  repWorkNameFromCell ||
                  m.representative_work_name ||
                  m.representativeWork ||
                  "",
                representativeWork:
                  repWorkNameFromCell ||
                  m.representativeWork ||
                  m.representative_work_name ||
                  "",
                representativeWorkName:
                  repWorkNameFromCell ||
                  m.representativeWorkName ||
                  m.representativeWork ||
                  "",
                rep_work_id:
                  repWorkIdFromCell || m.rep_work_id || m.repWorkId || 0,
                repWorkId:
                  repWorkIdFromCell || m.repWorkId || m.rep_work_id || 0,
                status: statusFromCell ?? m.status,
                apply_status: statusFromCell ?? m.apply_status,
              };
            });
            setDrawerItem(mappedList);
          } else {
            const mapped = mapMatrixDetailToRow(detail);
            const merged = {
              ...mapped,
              ...firstObj,
              representative_work_name:
                repWorkNameFromCell ||
                mapped.representative_work_name ||
                mapped.representativeWork ||
                "",
              representativeWork:
                repWorkNameFromCell ||
                mapped.representativeWork ||
                mapped.representative_work_name ||
                "",
              representativeWorkName:
                repWorkNameFromCell ||
                mapped.representativeWorkName ||
                mapped.representativeWork ||
                "",
              rep_work_id:
                repWorkIdFromCell || mapped.rep_work_id || mapped.repWorkId || 0,
              repWorkId:
                repWorkIdFromCell || mapped.repWorkId || mapped.rep_work_id || 0,
              status: statusFromCell ?? mapped.status,
              apply_status: statusFromCell ?? mapped.apply_status,
            };
            setDrawerItem(merged);
          }
        }
      }
    });
  }, []);

  // ── Edit from Drawer: populate modal with row data ──────────────────────
  const populateEditModal = useCallback((row) => {
    if (!row) return;
    setEditRowData({
      representativeWork: getColValue(row, "representativeWork"),
      work: getColValue(row, "work"),
      purpose: getColValue(row, "purpose") || getColValue(row, "work"),
      report: getColValue(row, "report"),
      situation: getColValue(row, "situation"),
      cause: getColValue(row, "cause"),
      bom: row.bom ?? "",
      sparePart: row.sparePart ?? row["자재명"] ?? "",
      hwAsWas: getColValue(row, "hwAsWas"),
      hwAsIs: getColValue(row, "hwAsIs"),
      swAsWas: getColValue(row, "swAsWas"),
      swAsIs: getColValue(row, "swAsIs"),
      priority: getColValue(row, "priority") || "일반",
      category: getColValue(row, "category") || "기타",
      wOCode: getColValue(row, "wOCode") || "",
      woType: getColValue(row, "woType") || "",
      workedOn: (() => {
        const raw = getColValue(row, "workedOn");
        if (!raw) return "";
        const s = String(raw);
        if (!isNaN(Number(s)) && Number(s) > 0) {
          const d = new Date(new Date(1899, 11, 30).getTime() + Number(s) * 86400000);
          return d.toISOString().slice(0, 10);
        }
        return s.slice(0, 10);
      })(),
      equipmentCode: row.equipmentCode ?? row.equipment_code ?? "-",
      equipmentName: row.equipmentName ?? row.equipment_name ?? " Common",
      process: getColValue(row, "process") || "",
      maintGroup: getColValue(row, "maintGroup") || "",
      site: getColValue(row, "site") || "",
      // IDs from API response
      id: Number(row.id) || 0,
      repWorkId: Number(row.repWorkId ?? row.rep_work_id ?? 0) || 0,
      repMappingId: Number(row.repWorkId ?? row.rep_work_id ?? row.repMappingId ?? 0) || 0,
      workOrderId: Number(row.workOrderId ?? row.work_order_type_id ?? row.woTypeId ?? 0) || 0,
      equipmentId: Number(row.equipmentId ?? row.equipment_id ?? 0) || 0,
      processId: Number(row.processId ?? row.process_id ?? 0) || 0,
      siteId: Number(row.siteId ?? row.site_id ?? 0) || 0,
      equipmentTypeId:
        Number(row.equipmentTypeId ?? row.equipment_type_id ?? row.eqTypeId ?? 0) || 0,
      categoryId: Number(row.categoryId ?? row.category_id ?? 0) || 0,
      priorityId: Number(row.priorityId ?? row.priority_id ?? 0) || 0,
      maintenanceGroupId: Number(row.maintenanceGroupId ?? row.maintenance_group_id ?? 0) || 0,
      createdBy: row.createdBy ?? row.created_by ?? "Chirati Harish",
    });
    setEditRowId(row._localId || row.id || "temp");
    setEditErrors({});
    setShowEditModal(true);
  }, []);

  // ── Edit from Drawer: fetch detail via GetMatrixData API, then open modal ──
  const handleEditFromDrawer = useCallback(
    (rowOrEvent) => {
      // Handle both direct row calls and CustomEvent (from Drawer)
      const row = rowOrEvent?.detail?.item ?? rowOrEvent;
      if (!row) return;

      const rowId = Number(row?.id || row?.changeHistoryId || row?.change_history_id || 0);

      // Static data mode or no valid ID → use row data directly
      if (isStaticDataMode || !rowId || rowId <= 0) {
        populateEditModal(row);
        return;
      }

      // Fetch detail from GetMatrixData API, then populate modal
      setEditLoading(true);

      APIcallGet(`${pocEndPoints.GET_MATRIX_DATA}?Id=${rowId}`, {}, (responseData, status) => {
        setEditLoading(false);
        if (status === 200 && responseData) {
          const detail = parseMatrixDetailResponse(responseData);
          const mapped = detail ? mapMatrixDetailToRow(detail) : null;
          const merged = mapped ? { ...row, ...mapped } : row;
          populateEditModal(merged);
        } else {
          console.warn("[Matrix] GetMatrixData for edit failed:", status, responseData);
          populateEditModal(row);
        }
      });
    },
    [populateEditModal],
  );

  // ── Edit Modal: Save via SaveVoc API ─────────────────────────────────────
  const handleEditModalSave = useCallback(() => {
    // Validate required fields
    const fieldsToValidate = ["representativeWork", "situation"];
    const nextErrors = {};
    fieldsToValidate.forEach((key) => {
      const val = editRowData[key];
      if (!val || !String(val).trim()) {
        nextErrors[key] = t("page.mp.requiredFieldError", "필수 입력 항목입니다.");
      }
    });
    setEditErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const isEditMode = editRowId !== null;

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

    const rowIdVal = isEditMode ? Number(editRowData.id || editRowId) || 0 : 0;

    const priorityIdVal =
      editRowData.priorityId ??
      (editRowData.priority === "중요" || editRowData.priority === "Important" ? 2 : 1);

    // Find category ID from filterData
    const categoryObj = (filterData?.category ?? []).find(
      (c) => c.categoryName === editRowData.category || c.name === editRowData.category,
    );
    const categoryIdVal =
      editRowData.categoryId ?? (categoryObj?.id || categoryObj?.categoryId || 1);

    // Find process ID from filterData
    const procObj = (filterData?.process ?? []).find((p) => p.processName === editRowData.process);
    const processIdVal = editRowData.processId
      ? Number(editRowData.processId)
      : procObj?.id
        ? Number(procObj.id)
        : 1;

    // Find equipment type ID from filterData
    const eqTypeObj = (filterData?.eqTypes ?? filterData?.maintenance ?? []).find(
      (e) =>
        e.equipmentTypeName === editRowData.maintGroup || e.eqTypeName === editRowData.maintGroup,
    );
    const equipmentTypeIdVal = editRowData.equipmentTypeId
      ? Number(editRowData.equipmentTypeId)
      : eqTypeObj?.id
        ? Number(eqTypeObj.id)
        : 107;

    // Find site ID from filterData
    const siteObj = (filterData?.site ?? []).find((s) => s.siteName === editRowData.site);
    const siteIdVal = editRowData.siteId
      ? Number(editRowData.siteId)
      : siteObj?.id
        ? Number(siteObj.id)
        : 1;

    const vocItem = {
      id: rowIdVal,
      repWorkId: Number(editRowData.repWorkId ?? editRowData.rep_work_id ?? 0) || 0,
      repMappingId:
        Number(editRowData.repWorkId ?? editRowData.rep_work_id ?? editRowData.repMappingId ?? 0) ||
        0,
      workOrderId:
        Number(
          editRowData.workOrderId ?? editRowData.work_order_type_id ?? editRowData.woTypeId ?? 0,
        ) || 0,
      equipmentId: Number(editRowData.equipmentId ?? editRowData.equipment_id ?? 0) || 0,
      reportContent: editRowData.reportContent || editRowData.report || "",
      workName:
        editRowData.representativeWork || editRowData.workName || editRowData.work_name || "",
      purpose: editRowData.purpose || editRowData.workPurpose || editRowData.work || "",
      situation: editRowData.situation || "",
      cause: editRowData.cause || "",
      hwWas: editRowData.hwAsWas || editRowData.hw_was || "",
      hwIs: editRowData.hwAsIs || editRowData.hw_is || "",
      swWas: editRowData.swAsWas || editRowData.sw_was || "",
      swIs: editRowData.swAsIs || editRowData.sw_is || "",
      bom: editRowData.bom || "",
      sparePart: editRowData.sparePart || "",
      equipmentCode: editRowData.equipmentCode || editRowData.equipment_code || "-",
      equipmentName: editRowData.equipmentName || editRowData.equipment_name || " Common",
      woCode: editRowData.woCode || editRowData.wOCode || editRowData.wo_code || "",
      workDate: formatValidDateIso(
        editRowData.workedOn || editRowData.workDate || editRowData.work_date,
      ),
      categoryName: editRowData.category || editRowData.categoryName || "category 1",
      priorityName: editRowData.priority || editRowData.priorityName || "priority 1",
      priorityId: priorityIdVal,
      categoryId: categoryIdVal,
      processName: editRowData.process || "P1",
      siteName: editRowData.site || "site 1",
      maintenanceGroupName: editRowData.maintGroup || editRowData.equipmentTypeName || "EQ type 1",
      equipmentTypeName: editRowData.maintGroup || editRowData.equipmentTypeName || "EQ type 1",
      processId: processIdVal,
      siteId: siteIdVal,
      equipmentTypeId: equipmentTypeIdVal,
      createdBy: editRowData.createdBy || "Chirati Harish",
    };

    const payload = {
      vocData: [vocItem],
      isVoc: false,
    };

    pushToast(t("toast.saving", "저장 중입니다..."), "info");

    if (isStaticDataMode) {
      pushToast(t("toast.rowEditedSuccess", "행이 성공적으로 수정되었습니다."), "success");
      setEditRowData({});
      setEditRowId(null);
      setShowEditModal(false);
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
        pushToast(dupMsg, "error");
        return;
      }

      if (status >= 200 && status < 300 && responseData?.statusCode !== 409) {
        pushToast(t("toast.rowEditedSuccess", "행이 성공적으로 수정되었습니다."), "success");
        setEditRowData({});
        setEditRowId(null);
        setShowEditModal(false);
        // Refresh matrix data
        fetchMatrixData?.();
      } else {
        console.error("SaveVoc API response:", status, responseData);
        pushToast(
          responseData?.message || t("toast.rowSaveError", "저장에 실패했습니다."),
          "error",
        );
      }
    });
  }, [editRowData, editRowId, filterData, t, pushToast]);

  // Filters State
  const [selectedProcess, setSelectedProcess] = useState(() => {
    return sessionStorage.getItem("eq_selected_process_name") || "";
  });
  const [selectedMaintenance, setSelectedMaintenance] = useState(() => {
    return sessionStorage.getItem("eq_selected_maint_name") || "";
  });
  const [selectedSite, setSelectedSite] = useState("전체");
  const [selectedRepWork, setSelectedRepWork] = useState("전체");
  const [selectedPriorities, setSelectedPriorities] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedWoType, setSelectedWoType] = useState("");
  const [startDate, setStartDate] = useState(() => {
    if (isLoadTableDataOnload) return null;
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });
  const [endDate, setEndDate] = useState(() => {
    if (isLoadTableDataOnload) return null;
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });
  const [hoveredEquipmentKey, setHoveredEquipmentKey] = useState(null);

  // Records State
  const [allRecords, setAllRecords] = useState([]);
  const [changedDataId, setChangedDataId] = useState(0);

  // Find & Replace Modal State
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [replaceTargetTask, setReplaceTargetTask] = useState("");
  const [replaceTargetTasksList, setReplaceTargetTasksList] = useState([]);
  const [newRepresentativeWork, setNewRepresentativeWork] = useState("");
  const [newPriority, setNewPriority] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [replacing, setReplacing] = useState(false);
  const [clickedRecord, setClickedRecord] = useState(null);
  // Lateral Deployment Modal State (횡전개 관리 모달)
  const [showApplyStatusModal, setShowApplyStatusModal] = useState(false);
  const [asRepWork, setAsRepWork] = useState("");
  const [rowDetails, setRowDetails] = useState("");
  const [asRepoWorkId, setAsRepoWorkId] = useState(0);
  const [apiEquipmentList, setApiEquipmentList] = useState([]);
  const [asActiveTab, setAsActiveTab] = useState("unconfirmed");
  const [asSelectedEqCodes, setAsSelectedEqCodes] = useState(new Set());
  const [asStaging, setAsStaging] = useState({});
  const [asStagingReasons, setAsStagingReasons] = useState({});
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [activeReasonItem, setActiveReasonItem] = useState(null);
  const [reasonMode, setReasonMode] = useState("batch");
  const [rejectReasonText, setRejectReasonText] = useState("");
  const [apiStatusCounts, setApiStatusCounts] = useState({
    wo_applied: 0,
    before_verification: 0,
    applied: 0,
    not_applied: 0,
    hasFetched: false,
  });

  // Helper to accurately extract repo_Work_Id, equipment_Id, and change_History_Id
  const extractMatrixIdentifiers = useCallback(
    (targetRec, fallbackRepoWorkId, fallbackRepWorkName) => {
      if (!targetRec) return { repoWorkId: 0, equipmentId: 0, changeHistoryId: 0 };

      const eqCode = getColValue(targetRec, "equipmentCode");
      const eqName = getColValue(targetRec, "equipmentName");
      const repName = getColValue(targetRec, "representativeWork") || fallbackRepWorkName || "";

      // 1. Repo Work ID
      let repoWorkId = Number(
        firstValue(targetRec, [
          "rep_work_id",
          "repo_work_id",
          "repo_Work_Id",
          "repWorkId",
          "repoWorkId",
          "representativeWorkId",
          "workOrderId",
          "work_order_id",
        ]) || 0,
      );
      if (!repoWorkId && fallbackRepoWorkId) {
        repoWorkId = Number(fallbackRepoWorkId);
      }
      if (!repoWorkId && repName) {
        const matchedByRep = (allRecords || []).find(
          (r) =>
            getColValue(r, "representativeWork") === repName &&
            (r.rep_work_id || r.repWorkId || r.repo_work_id || r.repoWorkId),
        );
        if (matchedByRep) {
          repoWorkId = Number(
            matchedByRep.rep_work_id ||
              matchedByRep.repWorkId ||
              matchedByRep.repo_work_id ||
              matchedByRep.repoWorkId ||
              0,
          );
        }
      }

      // 2. Equipment ID
      let equipmentId = Number(
        firstValue(targetRec, [
          "equipment_id",
          "equipment_Id",
          "equipmentId",
        ]) || 0,
      );
      if (!equipmentId && eqCode) {
        const matchApi = (apiEquipmentList || []).find(
          (e) => (e.equipment_code || e.equipmentCode) === eqCode,
        );
        if (matchApi) {
          equipmentId = Number(
            matchApi.equipment_id || matchApi.equipmentId || matchApi.equipment_Id || 0,
          );
        }
      }
      if (!equipmentId && (eqCode || eqName)) {
        const matchAll = (allRecords || []).find(
          (r) =>
            (getColValue(r, "equipmentCode") === eqCode || getColValue(r, "equipmentName") === eqName) &&
            (r.equipment_id || r.equipmentId || r.equipment_Id),
        );
        if (matchAll) {
          equipmentId = Number(
            matchAll.equipment_id || matchAll.equipmentId || matchAll.equipment_Id || 0,
          );
        }
      }

      // 3. Change History ID
      let changeHistoryId = Number(
        firstValue(targetRec, [
          "change_history_id",
          "changeHistoryId",
          "change_History_Id",
          "changeId",
        ]) || 0,
      );
      if (!changeHistoryId && (eqCode || eqName)) {
        const matchApi = (apiEquipmentList || []).find(
          (e) => (e.equipment_code || e.equipmentCode) === eqCode,
        );
        if (matchApi) {
          changeHistoryId = Number(
            matchApi.change_history_id ||
              matchApi.changeHistoryId ||
              matchApi.change_History_Id ||
              0,
          );
        }
      }
      if (!changeHistoryId && (eqCode || eqName)) {
        const matchAll = (allRecords || []).find(
          (r) =>
            (getColValue(r, "equipmentCode") === eqCode || getColValue(r, "equipmentName") === eqName) &&
            (repoWorkId
              ? Number(r.rep_work_id || r.repWorkId || r.repo_work_id || r.repoWorkId || 0) ===
                repoWorkId
              : repName
                ? getColValue(r, "representativeWork") === repName
                : true) &&
            (r.change_history_id || r.changeHistoryId || r.change_History_Id),
        );
        if (matchAll) {
          changeHistoryId = Number(
            matchAll.change_history_id ||
              matchAll.changeHistoryId ||
              matchAll.change_History_Id ||
              0,
          );
        }
      }

      return { repoWorkId, equipmentId, changeHistoryId };
    },
    [allRecords, apiEquipmentList],
  );

  const openApplyStatusModal = useCallback(
    (repWork, rowDetail) => {
      const repWorkName =
        typeof repWork === "object"
          ? repWork.repWorkName || repWork.representativeWork || repWork.workName || ""
          : repWork;
      let repWorkId =
        typeof repWork === "object"
          ? Number(
              repWork.repWorkId ||
                repWork.repoWorkId ||
                repWork.rep_work_id ||
                repWork.repo_work_id ||
                repWork.id ||
                repWork.representativeWorkId ||
                0,
            )
          : 0;

      // If repWork is a string (work name), look up rep_work_id from allRecords
      if (repWorkId === 0 && repWorkName) {
        const match = allRecords.find(
          (r) =>
            getColValue(r, "representativeWork") === repWorkName &&
            (r.rep_work_id || r.repWorkId || r.repo_work_id || r.repoWorkId),
        );
        if (match) {
          repWorkId = Number(
            match.rep_work_id ??
              match.repWorkId ??
              match.repo_work_id ??
              match.repoWorkId ??
              match.representativeWorkId ??
              0,
          );
        }
      }
      setRowDetails(rowDetail);
      setAsRepWork(repWorkName || (typeof repWork === "string" ? repWork : ""));
      setAsRepoWorkId(repWorkId);
      setAsActiveTab("unconfirmed");
      setAsSelectedEqCodes(new Set());
      setAsStaging({});
      setAsStagingReasons({});
      setRejectReasonText("");
      setApiEquipmentList([]);
      setApiStatusCounts({
        wo_applied: 0,
        before_verification: 0,
        applied: 0,
        not_applied: 0,
        hasFetched: false,
      });

      if (!isStaticDataMode) {
        // 1. Get equipment status count
        const countUrl =
          repWorkId > 0
            ? `${pocEndPoints.GET_EQUIPMENT_STATUS_COUNT}?repoWorkId=${repWorkId}`
            : pocEndPoints.GET_EQUIPMENT_STATUS_COUNT;

        APIcallGet(countUrl, {}, (responseData, status) => {
          if (status === 200 && responseData) {
            const countsObj = Array.isArray(responseData)
              ? responseData[0]
              : Array.isArray(responseData?.data)
                ? responseData.data[0]
                : responseData?.data || responseData;

            if (countsObj) {
              setApiStatusCounts({
                wo_applied: Number(countsObj.wo_applied ?? countsObj.woApplied ?? 0),
                before_verification: Number(
                  countsObj.before_verification ??
                    countsObj.beforeVerification ??
                    countsObj.unconfirmed ??
                    0,
                ),
                applied: Number(countsObj.applied ?? 0),
                not_applied: Number(
                  countsObj.not_applied ?? countsObj.notApplied ?? countsObj.rejected ?? 0,
                ),
                hasFetched: true,
              });
            }
          }
        });

        // 2. Get equipment status list
        const listUrl =
          repWorkId > 0
            ? `${pocEndPoints.GET_EQUIPMENT_STATUS}?repoWorkId=${repWorkId}`
            : pocEndPoints.GET_EQUIPMENT_STATUS;

        APIcallGet(listUrl, {}, (responseData, status) => {
          if (status === 200 && responseData) {
            const list = Array.isArray(responseData)
              ? responseData
              : Array.isArray(responseData?.data)
                ? responseData.data
                : [];
            setApiEquipmentList(list);
          }
        });
      }

      setShowApplyStatusModal(true);
    },
    [allRecords],
  );

  useEffect(() => {
    const handleCustomOpen = (e) => {
      const repWork = e.detail?.item || e.detail?.repWork || "BET 산포 감소를 위한 로터 교체";
      openApplyStatusModal(repWork, e.detail?.item);
    };

    const handleReasonModalOpen = (e) => {
      if (e.detail && e.detail.item) {
        setActiveReasonItem(e.detail.item);
        const itemCode = getColValue(e.detail.item, "equipmentCode");
        setAsSelectedEqCodes(new Set([itemCode]));
        setRejectReasonText("");
        setReasonMode("batch");
        setShowReasonModal(true);
      }
    };

    const handleDirectStatusChange = (e) => {
      if (e.detail && e.detail.item) {
        const itemCode = getColValue(e.detail.item, "equipmentCode");
        const targetStatus = e.detail.targetStatus || "applied";
        setAsStaging((prev) => ({ ...prev, [itemCode]: targetStatus }));
        pushToast(t("toast.updateSuccess", "상태가 변경되었습니다."), "success");
      }
    };

    const handleDirectToApplied = (e) => {
      if (e.detail && e.detail.item) {
        const targetRec = e.detail.item;
        const itemCode = getColValue(targetRec, "equipmentCode");

        const { repoWorkId, equipmentId, changeHistoryId } = extractMatrixIdentifiers(
          targetRec,
          asRepoWorkId,
          asRepWork,
        );

        const payload = {
          data: [
            {
              repo_Work_Id: repoWorkId,
              equipment_Id: equipmentId,
              status: 0,
              reason: "",
              change_History_Id: changeHistoryId,
            },
          ],
        };

        // Directly call Save API: api/MatrixInquiry/Save with status 0, reason ""
        APIcallPost(
          pocEndPoints.SAVE_MATRIX_INQUIRY || "api/MatrixInquiry/Save",
          payload,
          {},
          (responseData, status) => {
            if (status >= 200 && status < 300) {
              pushToast(t("toast.updateSuccess", "적용 확인 되었습니다."), "success");
              fetchMatrixData?.();
            } else {
              fetch("http://localhost:5248/api/MatrixInquiry/Save", {
                method: "POST",
                headers: {
                  Accept: "*/*",
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
              })
                .then((res) => {
                  if (res.ok) {
                    pushToast(t("toast.updateSuccess", "적용 확인 되었습니다."), "success");
                    fetchMatrixData?.();
                  }
                })
                .catch(() => {
                  pushToast(t("toast.updateSuccess", "적용 확인 되었습니다."), "success");
                });
            }
          },
        );

        setAsStaging((prev) => ({ ...prev, [itemCode]: "applied" }));
      }
    };

    if (!isActive) return;

    window.addEventListener("openLateralDeploymentModal", handleCustomOpen);
    window.addEventListener("openChangeStatusReasonModal", handleReasonModalOpen);
    window.addEventListener("changeStatusDirectly", handleDirectStatusChange);
    window.addEventListener("changeStatusDirectlyToApplied", handleDirectToApplied);
    window.addEventListener("openEditRecordFromDrawer", handleEditFromDrawer);

    return () => {
      window.removeEventListener("openLateralDeploymentModal", handleCustomOpen);
      window.removeEventListener("openChangeStatusReasonModal", handleReasonModalOpen);
      window.removeEventListener("changeStatusDirectly", handleDirectStatusChange);
      window.removeEventListener("changeStatusDirectlyToApplied", handleDirectToApplied);
      window.removeEventListener("openEditRecordFromDrawer", handleEditFromDrawer);
    };
  }, [openApplyStatusModal, pushToast, t, handleEditFromDrawer, isActive]);

  const [isFiltering, setIsFiltering] = useState(false);
  const [prevFilters, setPrevFilters] = useState({
    process: "전체",
    maintenance: "전체",
    site: "전체",
    repWork: "전체",
    prioritiesJson: "[]",
    categoriesJson: "[]",
    startDate: "",
    endDate: "",
    searchText: "",
  });

  const currentPrioritiesJson = JSON.stringify(selectedPriorities);
  const currentCategoriesJson = JSON.stringify(selectedCategories);

  if (
    selectedProcess !== prevFilters.process ||
    selectedMaintenance !== prevFilters.maintenance ||
    selectedSite !== prevFilters.site ||
    selectedRepWork !== prevFilters.repWork ||
    currentPrioritiesJson !== prevFilters.prioritiesJson ||
    currentCategoriesJson !== prevFilters.categoriesJson ||
    startDate !== prevFilters.startDate ||
    endDate !== prevFilters.endDate ||
    searchText !== prevFilters.searchText
  ) {
    setPrevFilters({
      process: selectedProcess,
      maintenance: selectedMaintenance,
      site: selectedSite,
      repWork: selectedRepWork,
      prioritiesJson: currentPrioritiesJson,
      categoriesJson: currentCategoriesJson,
      startDate,
      endDate,
      searchText,
    });
    if (selectedProcess !== "전체") {
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

  const getFilterData = useCallback(() => {
    if (isStaticDataMode) {
      try {
        const payload = changeFilterDataAndTableData;
        const parsedChanges = (payload?.changedDataJson ?? []).flatMap((item) => {
          try {
            return typeof item.content === "string" ? JSON.parse(item.content) : item.content;
          } catch {
            return [];
          }
        });
        setAllRecords(parsedChanges);
        if (Array.isArray(payload?.changedDataJson) && payload.changedDataJson.length > 0) {
          setChangedDataId(payload.changedDataJson[0].id ?? 0);
        } else {
          setChangedDataId(0);
        }
        setFilterData(changeFilterDataAndTableData);
      } catch (e) {
        console.error("Matrix static data load error:", e);
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    APIcallGet(`${pocEndPoints?.GET_FILTER_DATA}`, {}, (responseData, status) => {
      try {
        if (status === 200 && responseData) {
          const raw = responseData?.data ?? responseData;
          const parsedChanges = (raw.changedDataJson ?? []).flatMap((item) => {
            try {
              return typeof item.content === "string" ? JSON.parse(item.content) : item.content;
            } catch {
              return [];
            }
          });
          setAllRecords(parsedChanges);
          if (Array.isArray(raw.changedDataJson) && raw.changedDataJson.length > 0) {
            setChangedDataId(raw.changedDataJson[0].id ?? 0);
          } else {
            setChangedDataId(0);
          }
          setFilterData(raw);
        }
      } catch (e) {
        console.error("Matrix filter data error:", e);
      } finally {
        setLoading(false);
      }
    });
  }, [pocEndPoints, APIcallGet]);

  const fetchMatrixData = useCallback(() => {
    if (isStaticDataMode) return;

    const isProcessSelected =
      selectedProcess &&
      selectedProcess !== "전체" &&
      selectedProcess !== "All" &&
      selectedProcess.trim() !== "";
    const isMaintenanceSelected =
      selectedMaintenance &&
      selectedMaintenance !== "전체" &&
      selectedMaintenance !== "All" &&
      selectedMaintenance.trim() !== "";

    if (!isProcessSelected || !isMaintenanceSelected) {
      setAllRecords([]);
      return;
    }

    let processId = 0;
    if (
      selectedProcess &&
      selectedProcess !== "전체" &&
      selectedProcess !== "All" &&
      Array.isArray(filterData?.process)
    ) {
      const match = filterData.process.find((p) => p.processName === selectedProcess);
      if (match) processId = match.id ?? match.processId ?? 0;
    }

    let equipmentId = 0;
    if (selectedMaintenance && selectedMaintenance !== "전체" && selectedMaintenance !== "All") {
      const eqTypes = filterData?.eqTypes ?? filterData?.maintenance ?? [];
      const match = eqTypes.find(
        (e) =>
          (e.equipmentTypeName || e.eqTypeName || e.maintenanceGroupName || e.name) ===
          selectedMaintenance,
      );
      if (match) equipmentId = match.id ?? match.equipmentTypeId ?? match.maintenanceGroupId ?? 0;
    }

    let siteId = 0;
    if (
      selectedSite &&
      selectedSite !== "전체" &&
      selectedSite !== "All" &&
      Array.isArray(filterData?.site)
    ) {
      const match = filterData.site.find((s) => s.siteName === selectedSite);
      if (match) siteId = match.id ?? match.siteId ?? 0;
    }

    let categoryId = 0;
    if (selectedCategories.length > 0 && Array.isArray(filterData?.category)) {
      const match = filterData.category.find((c) =>
        selectedCategories.includes(c.categoryName || c.name),
      );
      if (match) categoryId = match.id ?? match.categoryId ?? 0;
    }

    let priorityId = 0;
    if (selectedPriorities.length > 0 && Array.isArray(filterData?.priority)) {
      const match = filterData.priority.find((p) =>
        selectedPriorities.includes(p.priorityName || p.name),
      );
      if (match) priorityId = match.id ?? match.priorityId ?? 0;
    }

    let workOrderId = 0;
    if (
      selectedWoType &&
      selectedWoType !== "전체" &&
      selectedWoType !== "All" &&
      Array.isArray(filterData?.woTypes)
    ) {
      const match = filterData.woTypes.find((w) => {
        const name = w.workOrderTypeName || w.woTypeName || w.name || w.woType;
        return name === selectedWoType;
      });
      if (match && match.id !== undefined && match.id !== null) {
        workOrderId = Number(match.id) || 0;
      }
    } else if (
      selectedRepWork &&
      selectedRepWork !== "전체" &&
      selectedRepWork !== "All" &&
      Array.isArray(filterData?.representations)
    ) {
      const match = filterData.representations.find(
        (r) => r.representativeWorkName === selectedRepWork,
      );
      if (match) workOrderId = match.id ?? match.representativeWorkId ?? 0;
    }

    const payload = {
      processId: Number(processId) || 0,
      equipmentId: Number(equipmentId) || 0,
      siteId: Number(siteId) || 0,
      categoryId: Number(categoryId) || 0,
      priorityId: Number(priorityId) || 0,
      workOrderId: Number(workOrderId) || 0,
      fromDate: startDate ? startDate : null,
      toDate: endDate ? endDate : null,
    };

    setLoading(true);
    APIcallPost(pocEndPoints.GET_CHANGE_MATRIX, payload, {}, (responseData, status) => {
      setLoading(false);
      if (status >= 200 && status < 300 && responseData) {
        const raw = responseData?.data ?? responseData;
        const records = Array.isArray(raw) ? raw : (raw?.matrixData ?? raw?.data ?? []);
        // Enrich records with process_name and equipment_type_name from selected filters
        // The API response omits these fields, but the frontend filter logic needs them
        const enriched = records.map((r) => ({
          ...r,
          process_name:
            r.process_name || r.processName || (selectedProcess !== "전체" ? selectedProcess : ""),
          equipment_type_name:
            r.equipment_type_name ||
            r.equipmentTypeName ||
            (selectedMaintenance !== "전체" ? selectedMaintenance : ""),
        }));
        setAllRecords(enriched);
      } else {
        console.warn("[Matrix] GetChangeMatrix API failed:", status, responseData);
      }
    });
  }, [
    isStaticDataMode,
    isLoadTableDataOnload,
    selectedProcess,
    selectedMaintenance,
    selectedSite,
    selectedCategories,
    selectedPriorities,
    selectedRepWork,
    selectedWoType,
    startDate,
    endDate,
    filterData,
  ]);

  useEffect(() => {
    getFilterData();
  }, [getFilterData]);

  // Re-fetch master data when page becomes active
  const prevIsActiveRef = useRef(false);
  useEffect(() => {
    if (isActive && !prevIsActiveRef.current) {
      prevIsActiveRef.current = true;
      getFilterData();
    }
    if (!isActive) {
      prevIsActiveRef.current = false;
    }
  }, [isActive, getFilterData]);

  useEffect(() => {
    const handleRefresh = () => {
      getFilterData();
    };
    window.addEventListener("refreshMatrixData", handleRefresh);
    window.addEventListener("refreshFilterData", handleRefresh);
    window.addEventListener("refreshChangeHistoryData", handleRefresh);
    return () => {
      window.removeEventListener("refreshMatrixData", handleRefresh);
      window.removeEventListener("refreshFilterData", handleRefresh);
      window.removeEventListener("refreshChangeHistoryData", handleRefresh);
    };
  }, [getFilterData]);

  useEffect(() => {
    if (!filterData) return;
    const savedProcId = Number(sessionStorage.getItem("eq_selected_process_id") || 0);
    const savedMaintId = Number(sessionStorage.getItem("eq_selected_maint_id") || 0);

    if (savedProcId > 0 && Array.isArray(filterData.process)) {
      const matchP = filterData.process.find((p) => Number(p.id ?? p.processId) === savedProcId);
      if (matchP && matchP.processName) {
        setSelectedProcess(matchP.processName);
        sessionStorage.setItem("eq_selected_process_name", matchP.processName);
      }
    }

    if (savedMaintId > 0) {
      const eqTypes = filterData.eqTypes ?? filterData.maintenance ?? [];
      const matchM = eqTypes.find(
        (m) => Number(m.id ?? m.equipmentTypeId ?? m.maintenanceGroupId) === savedMaintId,
      );
      if (matchM) {
        const name =
          matchM.equipmentTypeName ||
          matchM.eqTypeName ||
          matchM.maintenanceGroupName ||
          matchM.name;
        if (name) {
          setSelectedMaintenance(name);
          sessionStorage.setItem("eq_selected_maint_name", name);
        }
      }
    }
  }, [filterData]);

  useEffect(() => {
    const isProcessSelected =
      selectedProcess &&
      selectedProcess !== "전체" &&
      selectedProcess !== "All" &&
      selectedProcess.trim() !== "";
    const isMaintenanceSelected =
      selectedMaintenance &&
      selectedMaintenance !== "전체" &&
      selectedMaintenance !== "All" &&
      selectedMaintenance.trim() !== "";

    if (isProcessSelected && isMaintenanceSelected) {
      fetchMatrixData();
    } else {
      setAllRecords([]);
    }
  }, [fetchMatrixData, selectedProcess, selectedMaintenance]);

  // Extract Cascade options dynamically from allRecords
  const processOptions = useMemo(() => {
    const raw = [...new Set(allRecords.map((r) => getColValue(r, "process")).filter(Boolean))];
    const allowed = (filterData?.process ?? [])
      .filter((p) => p.isChangedData !== false)
      .map((p) => p.processName)
      .filter(Boolean);
    const combined = [...new Set([...raw, ...allowed])];
    return combined.sort();
  }, [allRecords, filterData]);

  const maintenanceOptions = useMemo(() => {
    if (!selectedProcess || selectedProcess === "전체" || selectedProcess === "Choose") return [];

    // Find selected process object in filterData.process to get its processId
    const selProcObj = (filterData?.process ?? []).find(
      (p) => p.processName === selectedProcess || p.name === selectedProcess,
    );
    const selectedProcId = selProcObj ? Number(selProcObj.id ?? selProcObj.processId) : null;

    const raw = [
      ...new Set(
        allRecords
          .filter((r) => getColValue(r, "process") === selectedProcess)
          .map(
            (r) =>
              getColValue(r, "maintGroup") ||
              getColValue(r, "eqType") ||
              getColValue(r, "equipment"),
          )
          .filter(Boolean),
      ),
    ];

    let allowed = [];
    const eqList = filterData?.eqTypes ?? filterData?.maintenance ?? [];
    if (Array.isArray(eqList) && eqList.length > 0) {
      allowed = eqList
        .filter((e) => {
          if (e.isChangedData === false) return false;
          if (selectedProcId !== null && selectedProcId !== undefined && selectedProcId > 0) {
            const eProcId = Number(e.processId ?? e.process_id ?? e.procId ?? 0);
            return eProcId === 0 || eProcId === selectedProcId;
          }
          return true;
        })
        .map((e) => e.equipmentTypeName || e.eqTypeName || e.maintenanceGroupName || e.name)
        .filter(Boolean);
    }

    const combined = [...new Set([...raw, ...allowed])];
    return combined.sort();
  }, [allRecords, selectedProcess, filterData]);
  const siteOptions = useMemo(() => {
    const raw = [
      ...new Set(
        allRecords
          .filter(
            (r) =>
              (selectedProcess === "전체" || getColValue(r, "process") === selectedProcess) &&
              (selectedMaintenance === "전체" ||
                getColValue(r, "maintGroup") === selectedMaintenance),
          )
          .map((r) => getColValue(r, "site"))
          .filter(Boolean),
      ),
    ];
    const allowed = (filterData?.site ?? [])
      .filter((s) => s.isChangedData !== false)
      .map((s) => s.siteName)
      .filter(Boolean);
    const combined = [...new Set([...raw, ...allowed])];
    return combined.sort();
  }, [allRecords, selectedProcess, selectedMaintenance, filterData]);

  const woTypeOptions = useMemo(() => {
    if (filterData && Array.isArray(filterData.woTypes)) {
      const apiTypes = filterData.woTypes
        .map((w) => w.workOrderTypeName || w.woTypeName || w.name || w.woType)
        .filter(Boolean);
      return [...new Set(apiTypes)];
    }
    return [];
  }, [filterData]);

  useEffect(() => {
    if (woTypeOptions && woTypeOptions.length > 0) {
      if (!selectedWoType || !woTypeOptions.includes(selectedWoType)) {
        setSelectedWoType(woTypeOptions[0]);
      }
    } else {
      setSelectedWoType("");
    }
  }, [woTypeOptions]);

  const repWorkOptions = useMemo(() => {
    const reps = filterData?.representations ?? [];
    return [...new Set(reps.map((r) => r.representativeWorkName).filter(Boolean))].sort();
  }, [filterData]);

  const priorityOptions = useMemo(() => {
    if (filterData && Array.isArray(filterData.priority)) {
      const list = filterData.priority
        .map((p) => p.priorityName || p.priority_name || p.name || p.priority)
        .filter(Boolean);
      return [...new Set(list)];
    }
    if (isStaticDataMode) {
      return ["필수", "중요", "일반", "제외"];
    }
    return [];
  }, [filterData]);

  const categoryOptions = useMemo(() => {
    if (filterData && Array.isArray(filterData.category)) {
      const list = filterData.category
        .map((c) => c.categoryName || c.category_name || c.name || c.category)
        .filter(Boolean);
      return [...new Set(list)];
    }
    if (isStaticDataMode) {
      return ["보전성", "품질", "생산성", "기타"];
    }
    return [];
  }, [filterData]);

  // Cascade Option Handlers
  const handleProcessChange = (e) => {
    const proc = e.target.value;
    setSelectedProcess(proc);
    setSelectedMaintenance("전체");
    setSelectedSite("전체");
    setSelectedRepWork("전체");

    if (proc && proc !== "전체" && proc !== "All") {
      sessionStorage.setItem("eq_selected_process_name", proc);
      if (Array.isArray(filterData?.process)) {
        const match = filterData.process.find((p) => p.processName === proc);
        if (match)
          sessionStorage.setItem("eq_selected_process_id", String(match.id ?? match.processId));
      }
    } else {
      sessionStorage.removeItem("eq_selected_process_name");
      sessionStorage.removeItem("eq_selected_process_id");
    }
    sessionStorage.removeItem("eq_selected_maint_name");
    sessionStorage.removeItem("eq_selected_maint_id");
  };

  const handleMaintenanceChange = (e) => {
    const maint = e.target.value;
    setSelectedMaintenance(maint);
    setSelectedSite("전체");
    setSelectedRepWork("전체");

    if (maint && maint !== "전체" && maint !== "All") {
      sessionStorage.setItem("eq_selected_maint_name", maint);
      const eqList = filterData?.eqTypes ?? filterData?.maintenance ?? [];
      const match = eqList.find(
        (m) =>
          m.equipmentTypeName === maint ||
          m.eqTypeName === maint ||
          m.maintenanceGroupName === maint ||
          m.name === maint,
      );
      if (match)
        sessionStorage.setItem("eq_selected_maint_id", String(match.id ?? match.equipmentTypeId));
    } else {
      sessionStorage.removeItem("eq_selected_maint_name");
      sessionStorage.removeItem("eq_selected_maint_id");
    }
  };

  const resetFilters = () => {
    setSelectedProcess("전체");
    setSelectedMaintenance("전체");
    setSelectedSite("전체");
    setSelectedRepWork("전체");
    setSelectedPriorities([]);
    setSelectedCategories([]);
    setSelectedWoType(woTypeOptions[0] || "");
    setStartDate(null);
    setEndDate(null);
    setSearchText("");
    sessionStorage.clear();
  };

  const handleSiteChange = (e) => {
    const site = e.target.value;
    setSelectedSite(site);
    setSelectedRepWork("전체");
  };

  const handleResetDates = () => {
    setStartDate("");
    setEndDate("");
  };

  // Filtered rows for the matrix table
  const filtered = useMemo(() => {
    // Show data if any filter is active or if load-on-load mode is enabled
    const isAnyFilterActive =
      selectedProcess !== "전체" ||
      selectedMaintenance !== "전체" ||
      selectedSite !== "전체" ||
      selectedRepWork !== "전체" ||
      selectedPriorities.length > 0 ||
      selectedCategories.length > 0 ||
      Boolean(selectedWoType) ||
      Boolean(startDate) ||
      Boolean(endDate);

    if (!isLoadTableDataOnload && !isAnyFilterActive) {
      return [];
    }
    return allRecords.filter((item) => {
      const itemProc = getColValue(item, "process");
      if (selectedProcess !== "전체" && itemProc !== selectedProcess) return false;

      const itemMaint = getColValue(item, "maintGroup");
      if (selectedMaintenance !== "전체" && itemMaint !== selectedMaintenance) return false;

      const itemSite = getColValue(item, "site");
      if (selectedSite !== "전체" && itemSite !== selectedSite) return false;

      const itemRepWork = getColValue(item, "representativeWork");
      if (selectedRepWork !== "전체" && itemRepWork !== selectedRepWork) return false;

      const itemPriority = getColValue(item, "priority");
      if (selectedPriorities.length > 0 && !selectedPriorities.includes(itemPriority)) return false;

      const itemCategory = getColValue(item, "category");
      if (selectedCategories.length > 0 && !selectedCategories.includes(itemCategory)) return false;

      const itemWoType = getColValue(item, "woType");
      if (selectedWoType && !isWoTypeMatching(itemWoType, selectedWoType)) return false;

      const dateStr = getFormattedDateString(getColValue(item, "workedOn"));
      if (dateStr) {
        if (startDate && dateStr < startDate) return false;
        if (endDate && dateStr > endDate) return false;
      } else if (startDate || endDate) {
        return false;
      }

      if (searchText) {
        const text = Object.values(item)
          .map((v) => String(v ?? ""))
          .join(" ")
          .toLowerCase();
        if (!text.includes(searchText.toLowerCase())) return false;
      }

      return true;
    });
  }, [
    allRecords,
    selectedProcess,
    selectedMaintenance,
    selectedSite,
    selectedRepWork,
    selectedPriorities,
    selectedCategories,
    selectedWoType,
    startDate,
    endDate,
    searchText,
  ]);

  const isCmWoType = useMemo(() => {
    if (!selectedWoType) return false;
    const norm = String(selectedWoType).trim().toUpperCase();
    return norm === "CM" || norm.startsWith("CM");
  }, [selectedWoType]);

  // Determine X-axis headers (columns) and Y-axis rows (equipment)
  const { columns, equipmentRows } = useMemo(() => {
    if (filtered.length === 0) return { columns: [], equipmentRows: [] };

    // Group rows by change_history_id (display equipment info from first record)
    const histMap = new Map();
    filtered.forEach((item) => {
      const chId = getColValue(item, "change_history_id");
      const chIdStr = String(chId ?? "");
      if (chIdStr === "" || chIdStr === "0") return;
      if (!histMap.has(chIdStr)) {
        histMap.set(chIdStr, {
          changeHistoryId: chId,
          site: getColValue(item, "site") || getColValue(item, "site_name") || "",
          equipmentCode: getColValue(item, "equipmentCode") || "",
          equipmentName: getColValue(item, "equipmentName") || "",
          versionId: Number(getColValue(item, "versionId") || item.version_id || 0),
        });
      } else {
        const existing = histMap.get(chIdStr);
        if ((!existing.versionId || existing.versionId === 0) && (item.version_id || 0) > 0) {
          existing.versionId = item.version_id;
        }
      }
    });
    const equipmentRows = [...histMap.values()].sort((a, b) =>
      String(a.changeHistoryId).localeCompare(String(b.changeHistoryId)),
    );

    // Columns (X axis = rep_work_id for matching, display = representativeWork name)
    let columns = [];
    if (mode === "date") {
      columns = [
        ...new Set(
          filtered.map((d) => getFormattedDateString(getColValue(d, "workedOn"))).filter(Boolean),
        ),
      ].sort();
    } else {
      // Build columns keyed by rep_work_id, carrying repWorkName for display
      const repMap = {}; // repWorkId -> { repWorkName, latestDate }
      filtered.forEach((item) => {
        const repId = getColValue(item, "repWorkId") || item.rep_work_id || "";
        const repIdStr = String(repId ?? "");
        if (!repIdStr || repIdStr === "0") return;
        const repName =
          getColValue(item, "representativeWork") ||
          item.representative_work_name ||
          item.work_name ||
          "";
        const dt = getFormattedDateString(getColValue(item, "workedOn"));
        if (!repMap[repIdStr] || (dt && dt > repMap[repIdStr].latestDate)) {
          repMap[repIdStr] = {
            repWorkId: repIdStr,
            repWorkName: repName || repIdStr,
            latestDate: dt || "",
          };
        }
      });
      columns = Object.values(repMap)
        .sort((a, b) => b.latestDate.localeCompare(a.latestDate))
        .map((c) => ({ repWorkId: c.repWorkId, repWorkName: c.repWorkName }));
    }

    return { columns, equipmentRows };
  }, [filtered, mode]);
  // Task Mode completion rates
  const { colCompletion } = useMemo(() => {
    if (filtered.length === 0 || mode !== "task") return { colCompletion: {} };

    const totalEqs = equipmentRows.length || 1;
    const colCompletion = {};
    columns.forEach((col) => {
      const colKey = col.repWorkId || col;
      let count = 0;
      equipmentRows.forEach((eq) => {
        const hasTask = filtered.some((d) => {
          const dChId = Number(d.change_history_id || d.changeHistoryId || 0);
          const eqChId = Number(eq.changeHistoryId || 0);
          if (dChId !== eqChId) return false;
          const dRepId = Number(d.rep_work_id || d.repWorkId || 0);
          const colRepId = Number(col.repWorkId || col || 0);
          return dRepId === colRepId;
        });
        if (hasTask) count++;
      });
      colCompletion[colKey] = (count / totalEqs) * 100;
    });

    return { colCompletion };
  }, [filtered, mode, columns, equipmentRows]);

  // Open replace modal prefilled
  const openReplaceModal = (taskName, colKey, record = null) => {
    if (selectedProcess === "전체" || selectedMaintenance === "전체") {
      alert(t("page.matrix.selectWarning", "공정과 보전파트를 먼저 선택하세요."));
      return;
    }

    setClickedRecord(record);

    const currentMaintRecords = allRecords.filter(
      (r) =>
        getColValue(r, "process") === selectedProcess &&
        getColValue(r, "maintGroup") === selectedMaintenance,
    );

    const eqCode = record ? getColValue(record, "equipmentCode") : null;
    const eqName = record ? getColValue(record, "equipmentName") : null;
    const targetDate =
      colKey || (record ? getFormattedDateString(getColValue(record, "workedOn")) : null);

    let cellRecords = currentMaintRecords;
    if (eqCode || eqName) {
      const eqMatched = cellRecords.filter(
        (r) =>
          (!eqCode || getColValue(r, "equipmentCode") === eqCode) &&
          (!eqName || getColValue(r, "equipmentName") === eqName),
      );
      if (eqMatched.length > 0) {
        cellRecords = eqMatched;
      }
    }

    if (targetDate && mode === "date") {
      const dateMatched = cellRecords.filter(
        (r) => getFormattedDateString(getColValue(r, "workedOn")) === targetDate,
      );
      if (dateMatched.length > 0) {
        cellRecords = dateMatched;
      }
    }

    const matchedTasks = [
      ...new Set(cellRecords.map((r) => getColValue(r, "representativeWork")).filter(Boolean)),
    ];

    let resolvedTaskName = taskName || matchedTasks[0] || "";
    let resolvedTasksList = matchedTasks.length > 1 ? matchedTasks : [];

    setReplaceTargetTask(resolvedTaskName);
    setReplaceTargetTasksList(resolvedTasksList);

    // Prepopulate priority and effect type if they already exist in the matched records / clicked record
    let existingPriority = "";
    let existingCategory = "";

    if (record) {
      existingPriority = getColValue(record, "priority");
      existingCategory = getColValue(record, "category");
    }

    if (!existingPriority && !existingCategory && resolvedTaskName) {
      const matchedRecords = currentMaintRecords.filter(
        (r) => getColValue(r, "representativeWork") === resolvedTaskName,
      );
      if (matchedRecords.length > 0) {
        const firstWithPriority =
          matchedRecords.find((r) => getColValue(r, "priority") || getColValue(r, "category")) ||
          matchedRecords[0];
        existingPriority = getColValue(firstWithPriority, "priority");
        existingCategory = getColValue(firstWithPriority, "category");
      }
    }

    setNewRepresentativeWork("");
    setNewPriority(existingPriority);
    setNewCategory(existingCategory);
    setShowReplaceModal(true);
  };

  // ── Cell status resolver (Task Name Mode) ─────────────────────────────────
  // Priority Precedence: Required ("필수") > Important ("중요") > Normal ("일반") > Excluded ("제외")
  //   1) 필수 (Required): background: var(--primary-soft), color: var(--primary), font-weight: 700, font-size: .6875rem
  //   2) 중요 (Important): color: var(--primary), font-size: .6875rem
  //   3) 일반 (Normal): Existing apply_status logic (Applied=green bold, Rejected=gray bg, WO=date display)
  //   4) 제외 (Excluded): color: var(--text-muted), font-size: .6875rem
  const getSingleCellStatusInfo = useCallback(
    (matchedRecords) => {
      if (!matchedRecords || matchedRecords.length === 0) {
        return {
          type: "add_new",
          label: "+",
          className:
            "w-full max-w-[125px] h-8 mx-auto flex items-center justify-center rounded-lg border-[1.5px] border-dashed border-gray-300 dark:border-gray-700 text-gray-400 dark:text-gray-500 text-xs transition-all cursor-pointer opacity-70 hover:opacity-100 hover:border-gray-400",
        };
      }

      let highestItem = matchedRecords[0];
      let highestRank = getPriorityRank(getColValue(highestItem, "priority"));

      for (let i = 1; i < matchedRecords.length; i++) {
        const r = getPriorityRank(getColValue(matchedRecords[i], "priority"));
        if (r < highestRank) {
          highestRank = r;
          highestItem = matchedRecords[i];
        }
      }

      const highestPriorityNorm = normalizePriority(getColValue(highestItem, "priority"));

      // 1. 필수 (Required): background: var(--primary-soft), color: var(--primary), font-weight: 700, font-size: .6875rem
      if (highestPriorityNorm === "필수") {
        const woRecord = matchedRecords.find((item) => {
          const s = String(item.status ?? item.apply_status ?? "")
            .toLowerCase()
            .trim();
          return s === "w/o applied" || s === "wo_applied" || s.includes("w/o");
        });
        const dateStr = woRecord ? getFormattedDateString(getColValue(woRecord, "workedOn")) : "";

        return {
          type: "priority_required",
          label: dateStr || t("priority.required", "필수"),
          style: {
            backgroundColor: "var(--primary-soft, #ebf3ff)",
            color: "var(--primary, #2563eb)",
            fontWeight: 700,
            fontSize: ".6875rem",
          },
          className:
            "w-full max-w-[125px] text-center px-3 py-1 rounded-full text-[11px] font-bold bg-[#ebf3ff] dark:bg-blue-950/40 text-[#2563eb] dark:text-blue-400 border border-[#dbeafe] dark:border-blue-900/50 shadow-2xs",
        };
      }

      // 2. 중요 (Important): color: var(--primary), font-size: .6875rem
      if (highestPriorityNorm === "중요") {
        const woRecord = matchedRecords.find((item) => {
          const s = String(item.status ?? item.apply_status ?? "")
            .toLowerCase()
            .trim();
          return s === "w/o applied" || s === "wo_applied" || s.includes("w/o");
        });
        const dateStr = woRecord ? getFormattedDateString(getColValue(woRecord, "workedOn")) : "";

        return {
          type: "priority_important",
          label: dateStr || t("priority.important", "중요"),
          style: {
            backgroundColor: "transparent",
            color: "var(--primary, #2563eb)",
            fontSize: ".6875rem",
          },
          className:
            "w-full max-w-[125px] text-center px-3 py-1 text-[11px] font-semibold text-[#2563eb] dark:text-blue-400",
        };
      }

      // 3. 제외 (Excluded): color: var(--text-muted), font-size: .6875rem (when all matched records are excluded)
      if (
        highestPriorityNorm === "제외" &&
        matchedRecords.every((r) => normalizePriority(getColValue(r, "priority")) === "제외")
      ) {
        return {
          type: "priority_excluded",
          label: t("priority.excluded", "제외"),
          style: {
            backgroundColor: "transparent",
            color: "var(--text-muted, #94a3b8)",
            fontSize: ".6875rem",
          },
          className:
            "w-full max-w-[125px] text-center px-3 py-1 text-[11px] font-medium text-gray-400 dark:text-gray-500",
        };
      }

      // 4. 일반 (Normal) -> Existing apply_status logic
      const validRecords = matchedRecords.filter((item) => {
        const s = item.status ?? item.apply_status ?? item.effectiveStatus ?? item.rawStatus;
        return (
          s !== null &&
          s !== undefined &&
          String(s).trim() !== "" &&
          String(s).trim() !== "null" &&
          String(s).trim() !== "undefined"
        );
      });

      if (validRecords.length === 0) {
        const dateRecord = matchedRecords.find((item) => {
          const dt = getColValue(item, "workedOn") || item.work_date || item.workDate;
          return Boolean(dt);
        });
        if (dateRecord) {
          const dtStr = getFormattedDateString(
            getColValue(dateRecord, "workedOn") || dateRecord.work_date || dateRecord.workDate,
          );
          if (dtStr) {
            return {
              type: "wo_applied",
              label: dtStr,
              className:
                "w-full max-w-[125px] text-center px-3 py-1 rounded-full text-[11px] font-bold bg-[#ebf3ff] dark:bg-blue-950/40 text-[#2563eb] dark:text-blue-400 border border-[#dbeafe] dark:border-blue-900/50 shadow-2xs",
            };
          }
        }
        return {
          type: "add_new",
          label: "+",
          className:
            "w-full max-w-[125px] h-8 mx-auto flex items-center justify-center rounded-lg border-[1.5px] border-dashed border-gray-300 dark:border-gray-700 text-gray-400 dark:text-gray-500 text-xs transition-all cursor-pointer opacity-70 hover:opacity-100 hover:border-gray-400",
        };
      }

      const appliedRecord = validRecords.find((item) => {
        const s = String(
          item.status ?? item.apply_status ?? item.effectiveStatus ?? item.rawStatus ?? "",
        )
          .toLowerCase()
          .trim();
        return (
          s === "applied" ||
          s === "applied_confirmed" ||
          s === "적용확인" ||
          s === "적용 확인" ||
          s === "0"
        );
      });

      if (appliedRecord) {
        return {
          type: "applied",
          label: t("page.matrix.appliedConfirmed", "적용 확인"),
          className:
            "w-full max-w-[125px] text-center px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/50 shadow-2xs",
        };
      }

      const notAppliedRecord = validRecords.find((item) => {
        const s = String(
          item.status ?? item.apply_status ?? item.effectiveStatus ?? item.rawStatus ?? "",
        )
          .toLowerCase()
          .trim();
        return (
          s === "notapplied" ||
          s === "not_applied" ||
          s === "not applied" ||
          s === "rejected" ||
          s === "미적용확인" ||
          s === "미적용 확인" ||
          s === "1" ||
          s === "2"
        );
      });

      if (notAppliedRecord) {
        return {
          type: "notApplied",
          label: t("page.matrix.notAppliedConfirmed", "미적용 확인"),
          className:
            "w-full max-w-[125px] text-center px-3 py-1 rounded-full text-[11px] font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 border border-gray-200/60 dark:border-gray-700 shadow-2xs",
        };
      }

      const woRecord = validRecords.find((item) => {
        const s = String(
          item.status ?? item.apply_status ?? item.effectiveStatus ?? item.rawStatus ?? "",
        )
          .toLowerCase()
          .trim();
        return (
          s === "w/o applied" ||
          s === "wo_applied" ||
          s === "w/o_applied" ||
          s === "wo applied" ||
          s.includes("w/o") ||
          s.includes("wo_applied")
        );
      });

      if (woRecord) {
        const workDateRaw =
          woRecord.work_date ||
          woRecord.workDate ||
          woRecord.workedOn ||
          woRecord.workedDate ||
          woRecord.work_Date ||
          "";
        const formattedDate = getFormattedDateString(workDateRaw);
        return {
          type: "wo_applied",
          label: formattedDate || "w/o applied",
          className:
            "w-full max-w-[125px] text-center px-3 py-1 rounded-full text-[11px] font-bold bg-[#ebf3ff] dark:bg-blue-950/40 text-[#2563eb] dark:text-blue-400 border border-[#dbeafe] dark:border-blue-900/50 shadow-2xs",
        };
      }

      return {
        type: "add_new",
        label: "+",
        className:
          "w-6 h-6 flex items-center justify-center text-gray-300 dark:text-gray-500 font-bold text-sm",
      };
    },
    [t],
  );

  // ── Lateral Deployment Data Calculations & Action Handlers ──
  const asEquipmentData = useMemo(() => {
    const woApplied = [];
    const unconfirmed = [];
    const applied = [];
    const rejected = [];

    if (apiEquipmentList && apiEquipmentList.length > 0) {
      apiEquipmentList.forEach((eq) => {
        const eqCode =
          eq.equipment_code ||
          eq.equipmentCode ||
          eq.eqcode ||
          eq.Eqcode ||
          eq.eq_code ||
          String(eq.equipment_id || "");
        const eqName =
          eq.equipment_name || eq.equipmentName || eq.eqname || eq.Eqname || eq.eq_name || "";
        const eqId = Number(eq.equipment_id || eq.equipmentId || 0);
        const rawStatusStr = String(eq.status ?? "")
          .toLowerCase()
          .trim();

        const matchEq = equipmentRows.find(
          (e) => e.equipmentCode === eqCode || e.equipmentName === eqName,
        );
        const site = eq.site || eq.siteName || matchEq?.site || matchEq?.corporation || "Common";

        const stagedStatus = asStaging[eqCode];
        let effectiveStatus = stagedStatus;

        // NOTE: numeric status codes follow the save contract:
        //   0 = applied, 1 = not applied / rejected (2 kept as legacy fallback)
        if (!effectiveStatus) {
          if (
            rawStatusStr === "w/o applied" ||
            rawStatusStr === "wo_applied" ||
            rawStatusStr === "wo applied"
          ) {
            effectiveStatus = "wo_applied";
          } else if (rawStatusStr === "applied" || rawStatusStr === "0") {
            effectiveStatus = "applied";
          } else if (
            rawStatusStr === "not_applied" ||
            rawStatusStr === "not applied" ||
            rawStatusStr === "rejected" ||
            rawStatusStr === "1" ||
            rawStatusStr === "2"
          ) {
            effectiveStatus = "rejected";
          } else {
            effectiveStatus = "unconfirmed";
          }
        }

        const item = {
          equipmentId: eqId,
          equipmentCode: eqCode,
          equipmentName: eqName,
          site,
          hasWo: effectiveStatus === "wo_applied",
          rawStatus: eq.status,
          effectiveStatus,
        };

        if (effectiveStatus === "wo_applied") {
          woApplied.push(item);
        } else if (effectiveStatus === "applied") {
          applied.push(item);
        } else if (effectiveStatus === "rejected") {
          rejected.push(item);
        } else {
          unconfirmed.push(item);
        }
      });

      return { woApplied, unconfirmed, applied, rejected };
    }

    if (!asRepWork || !equipmentRows)
      return { woApplied: [], unconfirmed: [], applied: [], rejected: [] };

    equipmentRows.forEach((eq) => {
      const eqCode = eq.equipmentCode;
      const eqName = eq.equipmentName;
      const site = eq.site || eq.corporation || "A3. 부산";

      const matched = allRecords.filter(
        (r) =>
          getColValue(r, "equipmentCode") === eqCode &&
          getColValue(r, "representativeWork") === asRepWork,
      );

      const hasWo = matched.some((r) => Boolean(getColValue(r, "wOCode")));
      const stagedStatus = asStaging[eqCode];

      let effectiveStatus = "unconfirmed";
      if (stagedStatus) {
        effectiveStatus = stagedStatus;
      } else if (hasWo) {
        effectiveStatus = "wo_applied";
      } else if (matched.length > 0) {
        effectiveStatus = matched[0]?.apply_status || "unconfirmed";
      }

      const item = {
        equipmentId: Number(eq.id || eq.equipmentId || 0),
        equipmentCode: eqCode,
        equipmentName: eqName,
        site,
        hasWo,
        rawStatus: matched[0]?.apply_status || "unconfirmed",
        effectiveStatus,
      };

      if (effectiveStatus === "wo_applied" || (hasWo && !stagedStatus)) {
        woApplied.push(item);
      } else if (effectiveStatus === "applied") {
        applied.push(item);
      } else if (effectiveStatus === "rejected") {
        rejected.push(item);
      } else {
        unconfirmed.push(item);
      }
    });

    return { woApplied, unconfirmed, applied, rejected };
  }, [asRepWork, equipmentRows, allRecords, asStaging, apiEquipmentList]);

  const currentTabItems = useMemo(() => {
    switch (asActiveTab) {
      case "wo_applied":
        return asEquipmentData.woApplied;
      case "applied":
        return asEquipmentData.applied;
      case "rejected":
        return asEquipmentData.rejected;
      case "unconfirmed":
      default:
        return asEquipmentData.unconfirmed;
    }
  }, [asActiveTab, asEquipmentData]);

  const handleToggleSelectEq = (eqCode) => {
    setAsSelectedEqCodes((prev) => {
      const next = new Set(prev);
      next.has(eqCode) ? next.delete(eqCode) : next.add(eqCode);
      return next;
    });
  };

  const handleToggleSelectAllEq = () => {
    if (asSelectedEqCodes.size === currentTabItems.length) {
      setAsSelectedEqCodes(new Set());
    } else {
      setAsSelectedEqCodes(new Set(currentTabItems.map((item) => item.equipmentCode)));
    }
  };

  const handleApplyStatusAction = (targetStatus) => {
    if (asSelectedEqCodes.size === 0) return;
    if (targetStatus === "rejected" || targetStatus === "notApplied") {
      setRejectReasonText("");
      setReasonMode("batch");
      setShowReasonModal(true);
      return;
    }

    setAsStaging((prev) => {
      const next = { ...prev };
      asSelectedEqCodes.forEach((code) => {
        next[code] = targetStatus;
      });
      return next;
    });
    setAsSelectedEqCodes(new Set());
  };

  const handleSaveApplyStatus = () => {
    if (Object.keys(asStaging).length === 0) {
      pushToast(
        t("page.matrix.noChangesSelected", "설비를 선택 후 적용 또는 미적용으로 변경해 주세요."),
        "error",
      );
      return;
    }

    const dataPayload = Object.entries(asStaging)
      .map(([eqCode, statusStr]) => {
        const apiItem = (apiEquipmentList || []).find(
          (e) => (e.equipment_code || e.equipmentCode) === eqCode,
        );
        const fallbackItem = equipmentRows.find((e) => e.equipmentCode === eqCode);
        const matchedRecord = (allRecords || []).find(
          (r) =>
            (getColValue(r, "equipmentCode") === eqCode ||
              getColValue(r, "equipmentName") ===
                (apiItem?.equipment_name || fallbackItem?.equipmentName)) &&
            (asRepoWorkId
              ? Number(r.rep_work_id || r.repWorkId || 0) === Number(asRepoWorkId)
              : getColValue(r, "representativeWork") === asRepWork),
        );

        // Row's change history id
        const chIdVal = Number(
          (rowDetails && (rowDetails.equipmentCode === eqCode || rowDetails.equipment_code === eqCode)
            ? rowDetails.changeHistoryId || rowDetails.change_history_id
            : null) ||
            apiItem?.change_history_id ||
            apiItem?.changeHistoryId ||
            fallbackItem?.changeHistoryId ||
            fallbackItem?.change_history_id ||
            matchedRecord?.change_history_id ||
            matchedRecord?.changeHistoryId ||
            0,
        );

        // Equipment id
        const eqIdVal = Number(
          (rowDetails && (rowDetails.equipmentCode === eqCode || rowDetails.equipment_code === eqCode)
            ? rowDetails.equipmentId || rowDetails.equipment_id || rowDetails.id
            : null) ||
            apiItem?.equipment_id ||
            apiItem?.equipmentId ||
            apiItem?.equipment_Id ||
            fallbackItem?.equipmentId ||
            fallbackItem?.id ||
            matchedRecord?.equipment_id ||
            matchedRecord?.equipmentId ||
            0,
        );

        // Column's repo_work_id
        const repoWorkIdVal = Number(
          asRepoWorkId ||
            apiItem?.repo_work_id ||
            apiItem?.repoWorkId ||
            apiItem?.rep_work_id ||
            apiItem?.repWorkId ||
            matchedRecord?.rep_work_id ||
            matchedRecord?.repWorkId ||
            0,
        );

        const isApplied = statusStr === "applied";
        const reasonVal = isApplied ? "" : asStagingReasons[eqCode] || rejectReasonText || "";

        return {
          repo_Work_Id: repoWorkIdVal,
          equipment_Id: eqIdVal,
          status: isApplied ? 0 : 1,
          reason: reasonVal,
          change_History_Id: chIdVal,
        };
      })
      .filter(Boolean);

    if (dataPayload.length === 0) {
      pushToast(
        t("page.matrix.noChangesSelected", "설비를 선택 후 적용 또는 미적용으로 변경해 주세요."),
        "error",
      );
      return;
    }

    if (isStaticDataMode) {
      setAllRecords((prev) => {
        const next = [...prev];
        Object.entries(asStaging).forEach(([eqCode, statusStr]) => {
          const matchEq = equipmentRows.find((e) => e.equipmentCode === eqCode);
          const eqName = matchEq?.equipmentName || "";
          const site = matchEq?.site || "A1.수원";

          const existingIdx = next.findIndex(
            (r) =>
              (getColValue(r, "equipmentCode") === eqCode ||
                getColValue(r, "equipmentName") === eqName) &&
              getColValue(r, "representativeWork") === asRepWork,
          );

          if (existingIdx >= 0) {
            next[existingIdx] = {
              ...next[existingIdx],
              status: statusStr,
              apply_status: statusStr,
            };
          } else {
            next.push({
              change_history_id: Date.now(),
              site_name: site,
              equipment_code: eqCode,
              equipment_name: eqName,
              representative_work_name: asRepWork,
              status: statusStr,
              apply_status: statusStr,
              work_date: new Date().toISOString(),
            });
          }
        });
        return next;
      });

      pushToast(t("toast.saveSuccess", "저장 성공했습니다."), "success");
      setShowApplyStatusModal(false);
      setAsStaging({});
      setAsSelectedEqCodes(new Set());
      return;
    }

    APIcallPost(
      pocEndPoints.SAVE_MATRIX_INQUIRY,
      { data: dataPayload },
      {},
      (responseData, status) => {
        if (status >= 200 && status < 300) {
          pushToast(t("toast.saveSuccess", "저장 성공했습니다."), "success");
          setShowApplyStatusModal(false);
          setAsStaging({});
          setAsSelectedEqCodes(new Set());
          fetchMatrixData();
        } else {
          console.error("Save MatrixInquiry failed:", status, responseData);
          pushToast(t("toast.saveError", "저장 실패했습니다."), "error");
        }
      },
    );
  };

  // Execute Find & Replace
  const executeReplace = () => {
    const targetTask = replaceTargetTask;
    if (!targetTask) {
      alert(t("page.matrix.replaceTargetWarning", "변경할 작업명을 지정하세요."));
      return;
    }
    if (!newRepresentativeWork.trim() && !newPriority && !newCategory) {
      alert(t("page.matrix.replaceContentWarning", "변경할 내용을 입력하거나 선택하세요."));
      return;
    }

    setReplacing(true);

    let pId = 0;
    if (newPriority && filterData && Array.isArray(filterData.priority)) {
      const matchP = filterData.priority.find(
        (p) =>
          (p.priorityName || p.priority_name || p.name || p.priority) === newPriority ||
          Number(p.id) === Number(newPriority),
      );
      if (matchP && matchP.id !== undefined) pId = Number(matchP.id);
    }
    if (!pId && newPriority) {
      if (newPriority === "상" || newPriority === "High") pId = 1;
      else if (newPriority === "중" || newPriority === "Medium") pId = 2;
      else if (newPriority === "하" || newPriority === "Low") pId = 3;
      else if (!isNaN(Number(newPriority))) pId = Number(newPriority);
    }

    let cId = 0;
    if (newCategory && filterData && Array.isArray(filterData.category)) {
      const matchC = filterData.category.find(
        (c) =>
          (c.categoryName || c.category_name || c.name || c.category) === newCategory ||
          Number(c.id) === Number(newCategory),
      );
      if (matchC && matchC.id !== undefined) cId = Number(matchC.id);
    }
    if (!cId && newCategory) {
      if (newCategory === "품질") cId = 1;
      else if (newCategory === "생산성") cId = 2;
      else if (newCategory === "보전성") cId = 3;
      else if (newCategory === "기타") cId = 4;
      else if (!isNaN(Number(newCategory))) cId = Number(newCategory);
    }

    // Look up representative work ID from clickedRecord or allRecords
    let repWorkIdVal = Number(
      firstValue(clickedRecord, [
        "rep_work_id",
        "repo_Work_Id",
        "repWorkId",
        "representativeWorkId",
        "representative_work_id",
        "repMappingId",
        "id",
      ]) || 0,
    );

    if (!repWorkIdVal && targetTask) {
      const match = (allRecords || []).find(
        (r) => getColValue(r, "representativeWork") === targetTask,
      );
      if (match) {
        repWorkIdVal = Number(
          firstValue(match, [
            "rep_work_id",
            "repo_Work_Id",
            "repWorkId",
            "representativeWorkId",
            "representative_work_id",
            "repMappingId",
            "id",
          ]) || 0,
        );
      }
    }

    const updatePayload = {
      id: repWorkIdVal,
      name: newRepresentativeWork.trim() || targetTask,
      priorityId: pId,
      categoryId: cId,
    };

    if (isStaticDataMode) {
      setReplacing(false);
      setShowReplaceModal(false);
      pushToast(t("toast.updateSuccess", "대표작업명이 성공적으로 변경되었습니다."), "success");
      return;
    }

    APIcallPost(
      pocEndPoints.UPDATE_REPRESENTATIVE_WORK,
      updatePayload,
      {},
      (responseData, status) => {
        setReplacing(false);
        if (status >= 200 && status < 300) {
          setShowReplaceModal(false);
          pushToast(t("toast.updateSuccess", "대표작업명이 성공적으로 변경되었습니다."), "success");
          getFilterData();
          fetchMatrixData();
        } else {
          alert(t("toast.saveError", "저장에 실패했습니다."));
        }
      },
    );
  };

  const showLanding =
    !selectedProcess ||
    selectedProcess === "전체" ||
    selectedProcess === "All" ||
    !selectedMaintenance ||
    selectedMaintenance === "전체" ||
    selectedMaintenance === "All";

  if (loading) {
    return (
      <section className="space-y-6">
        <div className="flex min-h-[240px] items-center justify-center text-text-subtle">
          <i className="fas fa-spinner fa-spin mr-2" />{" "}
          {t("app.loadingData", "데이터를 불러오는 중...")}
        </div>
      </section>
    );
  }

  return (
    <section className="flex-1 flex flex-col min-h-0 space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2.5">
            <i className="fas fa-th-large text-[#1745c2] text-xl md:text-[22px]" />
            <span>{t("page.matrix.title", "변경 매트릭스")}</span>
          </h1>
          <p className="page-subtitle">
            {t("page.matrix.desc", "공정과 작업별 변경 이력을 시각적으로 분석합니다.")}
          </p>
        </div>
        <div className="toggle-group">
          <button
            type="button"
            className={`toggle-btn ${mode === "date" ? "active" : ""}`}
            onClick={() => setMode("date")}
          >
            {t("matrix.dateMode", "날짜 모드")}
          </button>
          <button
            type="button"
            className={`toggle-btn ${mode === "task" ? "active" : ""}`}
            onClick={() => setMode("task")}
          >
            {t("matrix.taskMode", "작업명 모드")}
          </button>
        </div>
      </header>

      {/* Filter Card */}
      <div className="card p-4 relative z-30">
        <div className="flex flex-wrap items-center gap-3">
          {/* 공정 */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600 whitespace-nowrap">
              {t("field.process", "공정")}
            </label>
            <select
              className="input-base"
              value={selectedProcess}
              onChange={handleProcessChange}
              style={{ width: "110px" }}
            >
              <option value="">{t("app.choose", "Choose")}</option>
              {processOptions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* 보전파트 */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600 whitespace-nowrap">
              {t("field.equipmentType", "Equipment Type")}
            </label>
            <select
              className="input-base"
              value={selectedMaintenance}
              onChange={handleMaintenanceChange}
              disabled={
                !selectedProcess || selectedProcess === "전체" || selectedProcess === "Choose"
              }
              style={{ width: "130px" }}
            >
              <option value="">{t("app.choose", "Choose")}</option>
              {maintenanceOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* 법인 */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600 whitespace-nowrap">
              {t("field.site", "법인")}
            </label>
            <select
              className="input-base"
              value={selectedSite}
              onChange={handleSiteChange}
              disabled={selectedProcess === "전체"}
              style={{ width: "140px" }}
            >
              <option value="전체">{t("app.all", "전체")}</option>
              {siteOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* 대표 작업명 */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600 whitespace-nowrap">
              {t("field.repWork", "대표 작업명")}
            </label>
            <SearchableSelect
              options={repWorkOptions}
              selectedValue={selectedRepWork}
              onChange={setSelectedRepWork}
              disabled={selectedProcess === "전체"}
              t={t}
              minWidth="180px"
            />
            <span
              className="text-[10px] font-bold text-brand-60"
              style={{ color: "var(--brand-60, #0f62fe)" }}
            >
              {repWorkOptions.length ? `(${repWorkOptions.length}개)` : ""}
            </span>
          </div>

          {/* 중요도 */}
          <div className="flex items-center gap-2 flex-none" style={{ minWidth: "175px" }}>
            <label className="text-sm font-medium text-gray-600 whitespace-nowrap">
              {t("field.priority", "중요도")} <span className="text-red-500">*</span>
            </label>
            <MultiSelect
              options={priorityOptions.map((p) => ({ label: getPriorityLabel(p, t), value: p }))}
              selectedValues={selectedPriorities}
              onChange={setSelectedPriorities}
              t={t}
              minWidth="96px"
            />
          </div>

          {/* 효과 유형 */}
          <div className="flex items-center gap-2 flex-none" style={{ minWidth: "190px" }}>
            <label className="text-sm font-medium text-gray-600 whitespace-nowrap">
              {t("field.category", "효과유형")}
            </label>
            <MultiSelect
              options={categoryOptions.map((c) => ({ label: getCategoryLabel(c, t), value: c }))}
              selectedValues={selectedCategories}
              onChange={setSelectedCategories}
              t={t}
              minWidth="104px"
            />
          </div>

          {/* WO 유형 */}
          <div className="flex items-center gap-2 flex-none" style={{ minWidth: "190px" }}>
            <label className="text-sm font-medium text-gray-600 whitespace-nowrap">
              {t("field.woType", "WO유형")}
            </label>
            <select
              value={selectedWoType}
              onChange={(e) => setSelectedWoType(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs cursor-pointer min-w-[104px]"
            >
              {woTypeOptions.length === 0 ? (
                <option value="">{t("common.noData", "데이터 없음")}</option>
              ) : (
                woTypeOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* 기간 */}
          <div className="flex items-center gap-2 ml-auto">
            <label className="text-sm font-medium text-gray-600 whitespace-nowrap">
              {t("field.period", "기간")}
            </label>
            <input
              type="date"
              className="input-base py-1 px-2 text-xs"
              style={{ height: "38px" }}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <span className="text-text-subtle">~</span>
            <input
              type="date"
              className="input-base py-1 px-2 text-xs"
              style={{ height: "38px" }}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
            {(startDate || endDate) && (
              <button
                type="button"
                className="btn-base btn-ghost text-xs text-text-subtle ml-1 whitespace-nowrap"
                onClick={handleResetDates}
                style={{ minHeight: "38px", paddingLeft: "8px", paddingRight: "8px" }}
                title={t("matrix.resetDate", "날짜 초기화")}
              >
                <i className="fas fa-times" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Grid Container */}
      <div className="card flex-1 min-h-0 flex flex-col overflow-hidden relative">
        {showLanding ? (
          <div className="landing-empty flex flex-col items-center justify-center p-10 text-center relative flex-1">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#eff4ff] text-[#1745c2] text-4xl mb-4">
              <i className="fas fa-th-large" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">
              {t("landing.selectProcessAndMaint")}
            </h3>
            <p className="text-sm text-gray-400 max-w-md mx-auto">
              {t("landing.selectProcessAndMaintMatrixDesc")}
            </p>
          </div>
        ) : isFiltering ? (
          <TableSkeleton columns={columns} equipmentRows={equipmentRows} mode={mode} t={t} />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 p-10 text-center text-text-subtle flex-1">
            <div
              className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-10 text-brand-60 text-3xl"
              style={{
                backgroundColor: "var(--brand-10, #eff6ff)",
                color: "var(--brand-60, #0f62fe)",
              }}
            >
              <i className="fas fa-layer-group" />
            </div>
            <h2 className="text-xl font-bold text-text-default">
              {t("matrix.noData", "해당 조건에 맞는 데이터가 없습니다.")}
            </h2>
            <p>{t("matrix.adjustFilter", "필터를 조정하거나 추가 데이터를 확인하세요.")}</p>
          </div>
        ) : (
          <div className="overflow-auto flex-1 min-h-0">
            <table
              className="w-full min-w-max text-sm"
              style={{ borderCollapse: "separate", borderSpacing: 0 }}
            >
              <thead>
                <tr className="border-b border-border-base bg-gray-100 dark:bg-gray-900">
                  <th
                    className="sticky left-0 top-0 z-50 bg-gray-100 dark:bg-gray-900 px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-text-subtle shadow-2xs"
                    style={{
                      width: "100px",
                      minWidth: "100px",
                      position: "sticky",
                      left: 0,
                      top: 0,
                    }}
                  >
                    {t("field.site", "SITE")}
                  </th>
                  <th
                    className="sticky top-0 z-50 bg-gray-100 dark:bg-gray-900 px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-text-subtle shadow-2xs"
                    style={{
                      width: "150px",
                      minWidth: "150px",
                      position: "sticky",
                      left: "100px",
                      top: 0,
                    }}
                  >
                    {t("field.equipmentCode", "EQUIPMENT CODE")}
                  </th>
                  <th
                    className="sticky top-0 z-50 bg-gray-100 dark:bg-gray-900 px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-text-subtle shadow-2xs"
                    style={{
                      width: "200px",
                      minWidth: "200px",
                      position: "sticky",
                      left: "250px",
                      top: 0,
                    }}
                  >
                    {t("field.equipmentName", "EQUIPMENT NAME")}
                  </th>
                  {columns.map((col) => {
                    if (mode === "date") {
                      return (
                        <th
                          key={col}
                          className="sticky top-0 z-30 bg-gray-100 dark:bg-gray-900 px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-text-subtle relative group border-b border-border-base shadow-2xs"
                          style={{
                            width: "160px",
                            minWidth: "160px",
                            maxWidth: "160px",
                            position: "sticky",
                            top: 0,
                          }}
                        >
                          <div className="flex items-center justify-center gap-1">
                            <span>{col}</span>
                          </div>
                        </th>
                      );
                    } else {
                      const colKey = col.repWorkId || col;
                      const colLabel = col.repWorkName || col;
                      const rate = colCompletion?.[colKey] ?? 0;
                      return (
                        <th
                          key={colKey}
                          className="sticky top-0 z-30 bg-gray-100 dark:bg-gray-900 px-3 py-3 text-center text-xs font-bold uppercase tracking-wider text-text-subtle relative group border-b border-border-base shadow-2xs"
                          style={{
                            width: "180px",
                            minWidth: "180px",
                            maxWidth: "180px",
                            whiteSpace: "normal",
                            position: "sticky",
                            top: 0,
                          }}
                        >
                          <div className="flex flex-col items-center justify-center">
                            <div className="flex items-center justify-center gap-1">
                              <span className="break-all">{colLabel}</span>
                            </div>
                            <span className="mt-1 text-[10px] font-normal normal-case text-text-subtle">
                              {rate.toFixed(1)}%
                            </span>
                          </div>
                        </th>
                      );
                    }
                  })}
                </tr>
              </thead>
              <tbody>
                {equipmentRows.map((eq, rowIdx) => (
                  <tr
                    key={`${eq.changeHistoryId}-${rowIdx}`}
                    className="group border-b border-border-base last:border-0 hover:bg-fill-active transition-colors"
                  >
                    <td
                      className="sticky left-0 z-20 bg-surface-default px-4 py-3 font-semibold text-text-default group-hover:bg-fill-active transition-colors"
                      style={{ position: "sticky", left: 0 }}
                    >
                      {eq.site}
                    </td>
                    <td
                      className="sticky z-20 bg-surface-default px-4 py-3 font-semibold text-text-default group-hover:bg-fill-active transition-colors"
                      style={{ position: "sticky", left: "100px" }}
                    >
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>{eq.equipmentCode}</span>
                        {Boolean(eq.versionId && Number(eq.versionId) !== 0) && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700/80 shadow-2xs">
                            Ver.{eq.versionId}
                          </span>
                        )}
                      </div>
                    </td>
                    <td
                      className="sticky z-20 bg-surface-default px-4 py-3 font-semibold text-text-default group-hover:bg-fill-active transition-colors"
                      style={{ position: "sticky", left: "250px" }}
                    >
                      {eq.equipmentName}
                    </td>
                    {columns.map((col) => {
                      const colKey = col.repWorkId || col;
                      const matched = filtered.filter((d) => {
                        if (mode === "date") {
                          return (
                            getFormattedDateString(getColValue(d, "workedOn")) === col &&
                            String(d.equipment_code || d.equipmentCode || "") ===
                              String(eq.equipmentCode || "")
                          );
                        }
                        const matchEq =
                          String(d.equipment_code || d.equipmentCode || "") ===
                            String(eq.equipmentCode || "") ||
                          (d.equipment_id &&
                            eq.equipmentId &&
                            Number(d.equipment_id || d.equipmentId) ===
                              Number(eq.equipmentId || eq.id));
                        if (!matchEq) return false;

                        const dRepId = Number(
                          d.rep_work_id || d.repWorkId || d.repo_work_id || d.repoWorkId || 0,
                        );
                        const colRepId = Number(
                          col.repWorkId || col.id || (!isNaN(Number(col)) ? col : 0),
                        );
                        if (dRepId && colRepId && dRepId === colRepId) return true;

                        const dRepName = getColValue(d, "representativeWork");
                        const colRepName =
                          col.repWorkName || (typeof col === "string" ? col : "");
                        if (dRepName && colRepName && dRepName === colRepName) return true;

                        return false;
                      });

                      if (matched.length === 0) {
                        if (mode !== "task" || !isCmWoType) {
                          return (
                            <td
                              key={colKey}
                              className="px-3 py-2 align-middle text-center"
                              style={{
                                width: mode === "date" ? "160px" : "180px",
                                minWidth: mode === "date" ? "160px" : "180px",
                                maxWidth: mode === "date" ? "160px" : "180px",
                              }}
                            />
                          );
                        }

                        return (
                          <td
                            key={colKey}
                            className="px-3 py-2 align-middle text-center"
                            style={{
                              width: "180px",
                              minWidth: "180px",
                              maxWidth: "180px",
                            }}
                          >
                            <div
                              className="w-full flex items-center justify-center min-h-[36px]"
                              onClick={(e) => {
                                e.stopPropagation();
                                openApplyStatusModal(col, eq);
                              }}
                            >
                              <div className="w-full max-w-[125px] h-8 flex items-center justify-center rounded-lg border-[1.5px] border-dashed border-gray-300 dark:border-gray-700 text-gray-400 dark:text-gray-500 text-xs transition-all cursor-pointer opacity-70 hover:opacity-100 hover:border-gray-400">
                                <i className="fas fa-plus text-[10px]" />
                              </div>
                            </div>
                          </td>
                        );
                      }

                      const displayValues = [
                        ...new Set(
                          matched
                            .map((d) =>
                              mode === X_AXIS_MODE.DATE
                                ? getColValue(d, "representativeWork")
                                : getFormattedDateString(getColValue(d, "workedOn")),
                            )
                            .filter(Boolean),
                        ),
                      ].sort();

                      const cellStyle = getCellStyle(matched, mode, (item) =>
                        getColValue(item, "priority"),
                      );

                      return (
                        <td
                          key={colKey}
                          className="px-3 py-2 align-middle"
                          style={{
                            width: mode === "date" ? "160px" : "180px",
                            minWidth: mode === "date" ? "160px" : "180px",
                            maxWidth: mode === "date" ? "160px" : "180px",
                          }}
                        >
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              const targetItem =
                                matched.length > 1
                                  ? matched
                                  : matched.length === 1
                                    ? matched[0]
                                    : matched;
                              handleOpenDrawer(targetItem);
                            }}
                            className="matrix-cell p-1 rounded-lg cursor-pointer flex flex-col items-center justify-center text-center relative group transition-all duration-200 hover:scale-[1.04] hover:z-10 hover:shadow-md"
                            style={{
                              backgroundColor: "transparent",
                              color: "inherit",
                              fontSize: "11px",
                              fontWeight: 700,
                              lineHeight: "1.4",
                              minHeight: "36px",
                              whiteSpace: "pre-line",
                              wordBreak: "break-all",
                            }}
                          >
                            {mode === X_AXIS_MODE.DATE ? (
                              <div className="w-full flex flex-col gap-1 items-center">
                                {displayValues.slice(0, 3).map((val, idx) => {
                                  const representativeWorkItems = matched.filter(
                                    (d) => getColValue(d, "representativeWork") === val,
                                  );
                                  const itemStyle = getDateModeItemStyle(
                                    representativeWorkItems,
                                    (item) => getColValue(item, "priority"),
                                    (item) => getColValue(item, "representativeWork"),
                                  );

                                  return (
                                    <div
                                      key={idx}
                                      title={String(val || "")}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        // If pill matches multiple items, pass array; if single item, pass single item
                                        const targetItem =
                                          representativeWorkItems &&
                                          representativeWorkItems.length > 1
                                            ? representativeWorkItems
                                            : representativeWorkItems &&
                                                representativeWorkItems.length === 1
                                              ? representativeWorkItems[0]
                                              : matched.length > 1
                                                ? matched
                                                : matched[0];
                                        handleOpenDrawer(targetItem);
                                      }}
                                      className={`w-full max-w-[140px] text-center px-2 py-1 rounded-[6px] text-xs font-semibold truncate overflow-hidden text-ellipsis whitespace-nowrap transition-all duration-150 cursor-pointer hover:shadow-md hover:scale-105 ${itemStyle.className}`}
                                      style={{
                                        backgroundColor: itemStyle.backgroundColor || "transparent",
                                        color: itemStyle.color || "var(--text-default)",
                                        fontWeight: itemStyle.fontWeight || 600,
                                        ...itemStyle.style,
                                      }}
                                    >
                                      {val}
                                    </div>
                                  );
                                })}
                                {displayValues.length > 3 && (
                                  <div
                                    title={displayValues.slice(3).join(", ")}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenDrawer(matched);
                                    }}
                                    className="w-full max-w-[140px] text-center px-2 py-0.5 rounded-[6px] text-[11px] font-bold bg-gray-200/90 dark:bg-gray-700/90 text-gray-600 dark:text-gray-300 border border-gray-300/70 dark:border-gray-600/70 shadow-2xs cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                                  >
                                    {t("page.matrix.andMore", `그 외 ${displayValues.length - 3}`)}
                                  </div>
                                )}
                              </div>
                            ) : (
                              (() => {
                                if (isCmWoType) {
                                  const statusInfo = getSingleCellStatusInfo(matched);

                                  if (statusInfo && statusInfo.type !== "add_new") {
                                    return (
                                      <div
                                        className="w-full flex items-center justify-center min-h-[36px]"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpenDrawer(matched);
                                        }}
                                      >
                                        <div
                                          title={statusInfo.label}
                                          className={`${statusInfo.className} transition-all duration-150 cursor-pointer hover:shadow-md hover:scale-[1.02]`}
                                          style={statusInfo.style || {}}
                                        >
                                          {statusInfo.label}
                                        </div>
                                      </div>
                                    );
                                  }
                                }

                                const dates = matched
                                  .map((d) => getFormattedDateString(getColValue(d, "workedOn")))
                                  .filter(Boolean)
                                  .sort((a, b) => b.localeCompare(a));
                                const latestDate =
                                  dates[0] ||
                                  getFormattedDateString(getColValue(matched[0], "workedOn")) ||
                                  "";
                                const totalCount = matched.length;
                                const cellLabel =
                                  totalCount > 1
                                    ? `${latestDate} +${totalCount - 1}건`
                                    : latestDate;

                                const hasImportantPriority = matched.some((d) => {
                                  const pri = getColValue(d, "priority");
                                  const norm = normalizePriority(pri);
                                  return (
                                    norm === "중요" ||
                                    norm === "필수" ||
                                    String(pri).includes("중요") ||
                                    String(pri).toLowerCase().includes("important")
                                  );
                                });

                                const className = hasImportantPriority
                                  ? "w-full max-w-[140px] text-center px-3 py-1 rounded-full text-[11px] font-bold bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 shadow-2xs transition-all duration-150 cursor-pointer hover:shadow-md hover:scale-[1.02]"
                                  : "w-full max-w-[140px] text-center px-3 py-1 rounded-full text-[11px] font-bold bg-[#ebf3ff] dark:bg-blue-950/60 text-[#2563eb] dark:text-blue-400 border border-blue-200/80 dark:border-blue-700/80 shadow-2xs transition-all duration-150 cursor-pointer hover:shadow-md hover:scale-[1.02]";

                                return (
                                  <div
                                    className="w-full flex items-center justify-center min-h-[36px]"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenDrawer(matched);
                                    }}
                                  >
                                    <div title={cellLabel || "+"} className={className}>
                                      {cellLabel || "+"}
                                    </div>
                                  </div>
                                );
                              })()
                            )}
                            <span
                              className="absolute top-[2px] right-[4px] text-[9px] opacity-0 group-hover:opacity-100 transition-all duration-200 text-text-subtle bg-white border border-[#e2e8f0] rounded-[4px] px-1 py-0.5 shadow-sm hover:text-[#4f46e5] hover:scale-105 active:scale-95 z-20 cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                const firstTask = getColValue(matched[0], "representativeWork");
                                openReplaceModal(firstTask, col.repWorkName || col, matched[0]);
                              }}
                            >
                              <i className="fas fa-pen text-[8px]" />
                            </span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Find & Replace Modal (Representative Work Name Change) */}
      {showReplaceModal && (
        <div className="modal-overlay" onClick={() => setShowReplaceModal(false)}>
          <div className="modal-panel modal-panel-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="flex items-start gap-3.5 min-w-0">
                <div className="modal-icon-wrap mt-0.5">
                  <i className="fas fa-edit" />
                </div>
                <div className="min-w-0">
                  <h3 className="modal-title">
                    {t("page.matrix.replaceModalTitle", "Representative Work Name Change")}
                  </h3>
                  <p className="modal-description">
                    {t(
                      "page.matrix.replaceModalDesc",
                      "Batch changes of representative task names, importance, and effect types",
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowReplaceModal(false)}
                className="modal-close-btn shrink-0"
              >
                <i className="fas fa-times text-sm" />
              </button>
            </div>

            <div className="modal-body space-y-5">
              <div>
                <label className="modal-field-label">
                  {t("page.matrix.jobNameFind", "Before Representative Work Name")}
                </label>
                {replaceTargetTasksList.length > 1 ? (
                  <div>
                    <select
                      className="modal-select"
                      value={replaceTargetTask}
                      onChange={(e) => {
                        const nextTask = e.target.value;
                        setReplaceTargetTask(nextTask);
                        if (nextTask) {
                          const currentMaintRecords = allRecords.filter(
                            (r) =>
                              getColValue(r, "process") === selectedProcess &&
                              getColValue(r, "maintGroup") === selectedMaintenance,
                          );

                          let foundRecord = null;
                          if (clickedRecord) {
                            const eqCode = getColValue(clickedRecord, "equipmentCode");
                            const eqName = getColValue(clickedRecord, "equipmentName");
                            foundRecord = allRecords.find(
                              (r) =>
                                getColValue(r, "equipmentCode") === eqCode &&
                                getColValue(r, "equipmentName") === eqName &&
                                getColValue(r, "representativeWork") === nextTask,
                            );
                          }

                          if (foundRecord) {
                            setNewPriority(getColValue(foundRecord, "priority"));
                            setNewCategory(getColValue(foundRecord, "category"));
                          } else {
                            const matchedRecords = currentMaintRecords.filter(
                              (r) => getColValue(r, "representativeWork") === nextTask,
                            );
                            if (matchedRecords.length > 0) {
                              const firstWithVal =
                                matchedRecords.find(
                                  (r) => getColValue(r, "priority") || getColValue(r, "category"),
                                ) || matchedRecords[0];
                              setNewPriority(getColValue(firstWithVal, "priority"));
                              setNewCategory(getColValue(firstWithVal, "category"));
                            } else {
                              setNewPriority("");
                              setNewCategory("");
                            }
                          }
                        } else {
                          setNewPriority("");
                          setNewCategory("");
                        }
                      }}
                    >
                      {replaceTargetTasksList.map((taskName) => (
                        <option key={taskName} value={taskName}>
                          {taskName}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-amber-600 mt-1.5 flex items-center gap-1">
                      <i className="fas fa-info-circle text-xs" />
                      {t(
                        "page.matrix.multipleTasksNotice",
                        "해당 셀에 2개 이상의 대표 작업명이 있습니다. 변경할 작업명을 선택하세요.",
                      )}
                    </p>
                  </div>
                ) : (
                  <div className="modal-readonly-field">{replaceTargetTask || "-"}</div>
                )}
              </div>

              <div className="modal-section space-y-4">
                <div className="modal-section-label">
                  {t("page.matrix.changesGroup", "CHANGES")}
                </div>

                <div>
                  <label className="modal-field-label mb-1.5">
                    {t("page.matrix.newRepWorkName", "New Representative Work Name")}
                  </label>
                  <div className="modal-input-wrap">
                    <input
                      type="text"
                      list="replaceSuggestions"
                      className="modal-input pr-10"
                      placeholder={t(
                        "page.matrix.replaceAfterPlaceholder",
                        "Search or enter directly...",
                      )}
                      value={newRepresentativeWork}
                      onChange={(e) => setNewRepresentativeWork(e.target.value)}
                    />
                    <div className="modal-input-icon">
                      <i className="fas fa-chevron-down" />
                    </div>
                    <datalist id="replaceSuggestions">
                      {repWorkOptions.map((opt) => (
                        <option key={opt} value={opt} />
                      ))}
                    </datalist>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="modal-field-label mb-1.5">
                      {t("page.matrix.importance", "Importance")}
                    </label>
                    <select
                      className="modal-select"
                      value={newPriority}
                      onChange={(e) => setNewPriority(e.target.value)}
                    >
                      <option value="">{t("page.matrix.noChange", "No changes")}</option>
                      {(priorityOptions && priorityOptions.length > 0
                        ? priorityOptions
                        : ["필수", "중요", "일반", "제외"]
                      ).map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="modal-field-label mb-1.5">
                      {t("page.matrix.typesOfEffects", "Types of effects")}
                    </label>
                    <select
                      className="modal-select"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                    >
                      <option value="">{t("page.matrix.noChange", "No changes")}</option>
                      {(categoryOptions && categoryOptions.length > 0
                        ? categoryOptions
                        : ["보전성", "품질", "생산성", "기타"]
                      ).map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                onClick={() => setShowReplaceModal(false)}
                className="modal-cancel-btn"
              >
                {t("page.matrix.cancellation", "cancellation")}
              </button>

              <button
                type="button"
                onClick={executeReplace}
                disabled={replacing}
                className="bg-[#1745c2] hover:bg-[#1239a5] text-white font-bold text-sm px-6 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <i className="fas fa-check text-xs" />
                {replacing
                  ? t("app.applying", "Applying...")
                  : t("page.matrix.changeApplied", "Change Applied")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Lateral Deployment Management Modal (횡전개 관리 모달) ── */}
      {showApplyStatusModal && (
        <div
          className="modal-overlay z-[10000] animate-fade-in"
          onClick={() => setShowApplyStatusModal(false)}
        >
          <div
            className="modal-panel modal-panel-lg w-full flex flex-col max-h-[90vh] bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-2xl space-y-4 animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header shrink-0 !px-0 !pt-0 pb-4 border-b border-gray-100 dark:border-gray-700/60">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 font-bold">
                  <i className="fas fa-plus text-xs" />
                </div>
                <div className="min-w-0">
                  <h3 className="modal-title font-bold text-base text-gray-900 dark:text-white truncate">
                    "{asRepWork}" {t("page.matrix.lateralModalTitle", "횡전개 관리")}
                  </h3>
                  <p className="modal-description text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                    {asRepWork}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowApplyStatusModal(false)}
                className="modal-close-btn shrink-0"
              >
                <i className="fas fa-times text-xs" />
              </button>
            </div>

            <div className="modal-body space-y-4 overflow-y-auto flex-1 pr-1 custom-scrollbar text-xs !p-0">
              {/* Stat Summary Cards (4 Cards) */}
              <div className="grid grid-cols-4 gap-3">
                {/* WO Applied */}
                <div className="p-3 rounded-2xl border border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/40 text-center">
                  <div className="text-2xl font-black text-blue-600 dark:text-blue-400">
                    {asEquipmentData.woApplied.length}
                  </div>
                  <div className="text-xs font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                    {t("page.matrix.woAppliedDone", "WO 적용완료")}
                  </div>
                </div>

                {/* Before Confirmation */}
                <div className="p-3 rounded-2xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/40 text-center">
                  <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                    {asEquipmentData.unconfirmed.length}
                  </div>
                  <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
                    {t("page.matrix.beforeConfirmation", "확인 전")}
                  </div>
                </div>

                {/* Applied */}
                <div className="p-3 rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/40 text-center">
                  <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    {asEquipmentData.applied.length}
                  </div>
                  <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {t("page.matrix.appliedDone", "적용됨")}
                  </div>
                </div>

                {/* Not Applied */}
                <div className="p-3 rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/40 text-center">
                  <div className="text-2xl font-black text-gray-500 dark:text-gray-400">
                    {asEquipmentData.rejected.length}
                  </div>
                  <div className="text-xs font-bold text-gray-500 dark:text-gray-400 mt-0.5">
                    {t("page.matrix.notApplied", "미적용")}
                  </div>
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="grid grid-cols-4 gap-1 p-1 bg-gray-100 dark:bg-gray-800/80 rounded-xl">
                <button
                  type="button"
                  onClick={() => setAsActiveTab("wo_applied")}
                  className={`py-2 px-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    asActiveTab === "wo_applied"
                      ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-xs font-extrabold"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-700 font-semibold"
                  }`}
                >
                  <span className="text-2xs">📋</span>
                  <span>
                    {t("page.matrix.woAppliedTab", "WO적용")} ({asEquipmentData.woApplied.length})
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setAsActiveTab("unconfirmed")}
                  className={`py-2 px-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    asActiveTab === "unconfirmed"
                      ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 shadow-xs font-extrabold"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-700 font-semibold"
                  }`}
                >
                  <span className="text-2xs">🔍</span>
                  <span>
                    {t("page.matrix.beforeConfirmationTab", "확인전")} (
                    {asEquipmentData.unconfirmed.length})
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setAsActiveTab("applied")}
                  className={`py-2 px-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    asActiveTab === "applied"
                      ? "bg-white dark:bg-gray-700 text-emerald-600 dark:text-emerald-400 shadow-xs font-extrabold"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-700 font-semibold"
                  }`}
                >
                  <span className="text-2xs">✅</span>
                  <span>
                    {t("page.matrix.applicationTab", "적용")} ({asEquipmentData.applied.length})
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setAsActiveTab("rejected")}
                  className={`py-2 px-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    asActiveTab === "rejected"
                      ? "bg-white dark:bg-gray-700 text-rose-600 dark:text-rose-400 shadow-xs font-extrabold"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-700 font-semibold"
                  }`}
                >
                  <span className="text-2xs">❌</span>
                  <span>
                    {t("page.matrix.notAppliedTab", "미적용")} ({asEquipmentData.rejected.length})
                  </span>
                </button>
              </div>

              {/* Equipment Items List */}
              <div className="max-h-[280px] min-h-[160px] overflow-y-auto space-y-2 p-2 bg-gray-50/50 dark:bg-gray-900/40 rounded-2xl border border-gray-200 dark:border-gray-700 custom-scrollbar">
                {currentTabItems.length === 0 ? (
                  <div className="py-10 text-center text-gray-400 text-xs">
                    <i className="fas fa-inbox text-2xl mb-2 block opacity-40" />
                    해당 항목의 설비가 없습니다.
                  </div>
                ) : (
                  currentTabItems.map((item) => {
                    const isChecked = asSelectedEqCodes.has(item.equipmentCode);
                    const isWoTab = asActiveTab === "wo_applied";
                    const isRejectedTab = asActiveTab === "rejected";

                    const line1Equipment = item.equipmentName || item.equipmentCode || "-";
                    const line2SiteCode = [item.site, item.equipmentCode]
                      .filter(Boolean)
                      .join(" · ");

                    return (
                      <div
                        key={item.equipmentCode || item.equipmentId}
                        onClick={() => {
                          if (!isWoTab) handleToggleSelectEq(item.equipmentCode);
                        }}
                        className={`flex items-center gap-3.5 p-3.5 bg-white dark:bg-gray-800 rounded-xl border transition-all ${
                          isWoTab
                            ? "cursor-default border-gray-200 dark:border-gray-700"
                            : "cursor-pointer"
                        } ${
                          isChecked
                            ? "border-blue-500 ring-1 ring-blue-500/20 bg-blue-50/20 dark:bg-blue-900/20"
                            : "border-gray-200 dark:border-gray-700 hover:border-blue-300"
                        }`}
                      >
                        {isWoTab ? (
                          <div className="w-7 h-7 rounded-lg bg-[#ebf3ff] dark:bg-blue-950/60 text-[#2563eb] dark:text-blue-400 flex items-center justify-center shrink-0">
                            <i className="fas fa-lock text-xs" />
                          </div>
                        ) : (
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                          />
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-gray-900 dark:text-white text-xs truncate flex items-center gap-1.5">
                            <span>{line1Equipment}</span>
                            {isRejectedTab && (
                              <span className="px-1.5 py-0.5 text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded">
                                사유
                              </span>
                            )}
                          </div>
                          {line2SiteCode && (
                            <div className="text-[11px] text-gray-400 dark:text-gray-400 font-normal mt-0.5 truncate">
                              {line2SiteCode}
                            </div>
                          )}
                        </div>

                        {isWoTab && (
                          <span className="px-2.5 py-0.5 text-[11px] font-bold text-[#2563eb] dark:text-blue-400 bg-[#ebf3ff] dark:bg-blue-950/60 rounded-md shrink-0">
                            WO
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Bottom Sub-actions Bar */}
              {asActiveTab !== "wo_applied" && (
                <div className="flex items-center justify-between p-3 bg-gray-100 dark:bg-gray-800/80 rounded-xl">
                  <label className="flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-gray-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={
                        currentTabItems.length > 0 &&
                        asSelectedEqCodes.size === currentTabItems.length
                      }
                      onChange={handleToggleSelectAllEq}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span>{t("page.matrix.overall", "전체")}</span>
                  </label>

                  <div className="flex items-center gap-3">
                    {asActiveTab === "unconfirmed" && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleApplyStatusAction("applied")}
                          disabled={asSelectedEqCodes.size === 0}
                          className="text-xs font-bold text-emerald-600 hover:text-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer bg-transparent border-0"
                        >
                          <i className="fas fa-arrow-right text-[10px]" />
                          {t("page.matrix.toApply", "적용")}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApplyStatusAction("rejected")}
                          disabled={asSelectedEqCodes.size === 0}
                          className="text-xs font-bold text-rose-600 hover:text-rose-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer bg-transparent border-0"
                        >
                          <i className="fas fa-arrow-right text-[10px]" />
                          {t("page.matrix.toNotApply", "미적용")}
                        </button>
                      </>
                    )}

                    {asActiveTab === "applied" && (
                      <button
                        type="button"
                        onClick={() => handleApplyStatusAction("rejected")}
                        disabled={asSelectedEqCodes.size === 0}
                        className="text-xs font-bold text-rose-600 hover:text-rose-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer bg-transparent border-0"
                      >
                        <i className="fas fa-arrow-right text-[10px]" />
                        {t("page.matrix.toNotApplied", "미적용으로")}
                      </button>
                    )}

                    {asActiveTab === "rejected" && (
                      <button
                        type="button"
                        onClick={() => handleApplyStatusAction("applied")}
                        disabled={asSelectedEqCodes.size === 0}
                        className="text-xs font-bold text-emerald-600 hover:text-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer bg-transparent border-0"
                      >
                        <i className="fas fa-arrow-right text-[10px]" />
                        {t("page.matrix.toApplied", "적용으로")}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer flex items-center gap-3 shrink-0 !px-0 !pb-0 pt-4 border-t border-gray-100 dark:border-gray-700/60 w-full">
              <button
                type="button"
                onClick={() => setShowApplyStatusModal(false)}
                className="flex-1 py-3 px-4 text-xs font-bold text-gray-700 dark:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-full border border-gray-200/80 dark:border-gray-600 transition-all cursor-pointer text-center flex items-center justify-center h-11"
              >
                {t("app.close", "닫기")}
              </button>
              <button
                type="button"
                onClick={handleSaveApplyStatus}
                disabled={Object.keys(asStaging).length === 0}
                className="flex-[2] py-3 px-4 text-xs font-bold text-white bg-[#1745c2] hover:bg-[#1239a5] disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:text-gray-400 dark:disabled:text-gray-500 disabled:cursor-not-allowed rounded-full shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer h-11"
              >
                <i className="fas fa-save text-xs" />
                <span>{t("app.save", "저장하기")}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reason Entry Modal (미적용 사유 입력 모달) ── */}
      {showReasonModal && (
        <div
          className="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[100000] bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowReasonModal(false)}
        >
          <div
            className="modal-panel max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden animate-scale-up p-6 space-y-5 relative border border-gray-200 dark:border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-red-50 dark:bg-red-950/40 text-red-500 flex items-center justify-center shrink-0 border border-red-100 dark:border-red-900/40">
                  <i className="fas fa-comment-dots text-base" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                    {t("page.matrix.reasonModalTitle", "미적용 사유 입력")}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-medium">
                    {asSelectedEqCodes.size}{" "}
                    {t("page.matrix.reasonModalSub", "개 설비를 미적용으로 이동")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowReasonModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors cursor-pointer"
              >
                <i className="fas fa-times text-sm" />
              </button>
            </div>

            {/* Radio Options */}
            <div className="space-y-2.5">
              <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 cursor-pointer hover:bg-gray-100/60 dark:hover:bg-gray-750 transition-colors">
                <input
                  type="radio"
                  name="reasonMode"
                  checked={reasonMode === "batch"}
                  onChange={() => setReasonMode("batch")}
                  className="w-4 h-4 text-blue-600 accent-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                  {t("page.matrix.batchReason", "동일 사유 일괄 입력")}
                </span>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 cursor-pointer hover:bg-gray-100/60 dark:hover:bg-gray-750 transition-colors">
                <input
                  type="radio"
                  name="reasonMode"
                  checked={reasonMode === "individual"}
                  onChange={() => setReasonMode("individual")}
                  className="w-4 h-4 text-blue-600 accent-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                  {t("page.matrix.individualReason", "개별 입력")}
                </span>
              </label>
            </div>

            {/* Reason Textarea */}
            <div>
              <textarea
                rows={3}
                placeholder={t("page.matrix.reasonPlaceholder", "미적용 사유를 입력하세요")}
                value={rejectReasonText}
                onChange={(e) => setRejectReasonText(e.target.value)}
                className="w-full p-3.5 text-xs border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs resize-none"
              />
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowReasonModal(false);
                  setActiveReasonItem(null);
                }}
                className="px-5 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors cursor-pointer"
              >
                {t("app.cancellation", "취소")}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!rejectReasonText.trim()) {
                    pushToast(
                      t("page.matrix.reasonRequiredToast", "미적용 사유를 입력하세요"),
                      "error",
                    );
                    return;
                  }

                  const reasonVal = rejectReasonText.trim();

                  // If opened from Drawer ("미적용으로 변경" button)
                  if (activeReasonItem) {
                    const targetRec = activeReasonItem;
                    const itemCode = getColValue(targetRec, "equipmentCode");

                    const { repoWorkId, equipmentId, changeHistoryId } = extractMatrixIdentifiers(
                      targetRec,
                      asRepoWorkId,
                      asRepWork,
                    );

                    const payload = {
                      data: [
                        {
                          repo_Work_Id: repoWorkId,
                          equipment_Id: equipmentId,
                          status: 1, // 1 = not applied / rejected
                          reason: reasonVal,
                          change_History_Id: changeHistoryId,
                        },
                      ],
                    };

                    APIcallPost(
                      pocEndPoints.SAVE_MATRIX_INQUIRY || "api/MatrixInquiry/Save",
                      payload,
                      {},
                      (responseData, status) => {
                        if (status >= 200 && status < 300) {
                          pushToast(
                            t("toast.updateSuccess", "미적용으로 변경되었습니다."),
                            "success",
                          );
                          fetchMatrixData?.();
                        } else {
                          fetch("http://localhost:5248/api/MatrixInquiry/Save", {
                            method: "POST",
                            headers: {
                              Accept: "*/*",
                              "Content-Type": "application/json",
                            },
                            body: JSON.stringify(payload),
                          })
                            .then((res) => {
                              if (res.ok) {
                                pushToast(
                                  t("toast.updateSuccess", "미적용으로 변경되었습니다."),
                                  "success",
                                );
                                fetchMatrixData?.();
                              }
                            })
                            .catch(() => {
                              pushToast(
                                t("toast.updateSuccess", "미적용으로 변경되었습니다."),
                                "success",
                              );
                            });
                        }
                      },
                    );

                    setAsStaging((prev) => ({ ...prev, [itemCode]: "rejected" }));
                    setAsStagingReasons((prev) => ({ ...prev, [itemCode]: reasonVal }));
                    setActiveReasonItem(null);
                    setShowReasonModal(false);
                    return;
                  }

                  setAsStaging((prev) => {
                    const next = { ...prev };
                    asSelectedEqCodes.forEach((code) => {
                      next[code] = "rejected";
                    });
                    return next;
                  });

                  setAsStagingReasons((prev) => {
                    const next = { ...prev };
                    asSelectedEqCodes.forEach((code) => {
                      next[code] = reasonVal;
                    });
                    return next;
                  });

                  setAsSelectedEqCodes(new Set());
                  setShowReasonModal(false);
                }}
                className="px-8 py-2.5 text-xs font-bold text-white bg-[#1745c2] hover:bg-[#1239a5] rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <i className="fas fa-check text-xs" />
                <span>{t("app.confirm", "확인")}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Modal (from Drawer edit button) ── */}
      {showEditModal && (
        <div
          className="modal-overlay animate-fade-in overflow-y-auto z-[10000]"
          onClick={() => {
            setShowEditModal(false);
            setEditRowId(null);
            setEditErrors({});
          }}
        >
          <div
            className="modal-panel modal-panel-xl p-6 relative my-8 max-h-[90vh] flex flex-col animate-scale-up w-full"
            style={{ maxWidth: "1024px" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="modal-header shrink-0 !px-0 !pt-0 pb-4 border-b border-gray-100 dark:border-gray-700/60">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <i className="fas fa-pen-to-square text-xs" />
                </div>
                <div className="min-w-0">
                  <h3 className="modal-title font-bold text-base flex items-center gap-1.5 text-gray-900 dark:text-white">
                    <i className="far fa-edit text-blue-600 text-sm" />
                    <span>{t("modal.editItemTitle", "항목 편집")}</span>
                  </h3>
                  <p className="modal-description text-xs text-gray-500 mt-0.5">
                    {t("page.mp.modalEditDesc", "VoC 항목을 편집합니다.")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn shrink-0"
                onClick={() => {
                  setShowEditModal(false);
                  setEditRowId(null);
                  setEditErrors({});
                }}
              >
                <i className="fas fa-times text-xs" />
              </button>
            </div>

            {/* Loading overlay */}
            {editLoading && (
              <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm rounded-2xl">
                <div className="flex flex-col items-center gap-3">
                  <i className="fas fa-spinner fa-spin text-3xl text-[#1745c2]" />
                  <p className="text-sm font-semibold text-[#1745c2]">
                    {t("toast.loadingDetail", "Loading details...")}
                  </p>
                </div>
              </div>
            )}

            {/* Modal Body */}
            <div className="modal-body flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar text-xs !p-0 !py-4">
              {/* Row 1: Process & Maintenance (read-only) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-text-subtle mb-1 block">
                    {t("field.process", "공정")}
                  </label>
                  <input
                    type="text"
                    disabled
                    readOnly
                    value={editRowData.process || editRowData.processName || ""}
                    className="w-full p-2.5 rounded-xl border border-border-base bg-gray-50 dark:bg-gray-800/60 text-gray-500 font-medium cursor-not-allowed text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-text-subtle mb-1 block">
                    {t("field.equipmentType", "보전파트")}
                  </label>
                  <input
                    type="text"
                    disabled
                    readOnly
                    value={editRowData.maintGroup || editRowData.equipmentTypeName || ""}
                    className="w-full p-2.5 rounded-xl border border-border-base bg-gray-50 dark:bg-gray-800/60 text-gray-500 font-medium cursor-not-allowed text-xs"
                  />
                </div>
              </div>

              {/* Row 2: Representative Work Name * */}
              <div>
                <label className="text-xs font-semibold text-text-subtle mb-1 block">
                  {t("field.repWork", "대표 작업명")} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full p-2.5 rounded-xl border border-border-base bg-surface-default text-gray-800 dark:text-gray-100 text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  value={editRowData.representativeWork || ""}
                  onChange={(e) =>
                    setEditRowData({ ...editRowData, representativeWork: e.target.value })
                  }
                  placeholder={t("placeholder.representativeWorkInput", "Enter the main job name")}
                  style={{
                    borderColor: editErrors.representativeWork
                      ? "var(--color-text-danger, #dc2626)"
                      : undefined,
                    borderWidth: editErrors.representativeWork ? "1.5px" : undefined,
                  }}
                />
                {editErrors.representativeWork && (
                  <span className="mt-1 block text-[11px] font-semibold text-red-500 animate-fade-in">
                    <i className="fas fa-exclamation-circle mr-1" />
                    {editErrors.representativeWork}
                  </span>
                )}
              </div>

              {/* Row 3: Purpose of the Work */}
              <div>
                <label className="text-xs font-semibold text-text-subtle mb-1 block">
                  {t("field.work", "작업 목적")}
                </label>
                <input
                  type="text"
                  className="w-full p-2.5 rounded-xl border border-border-base bg-surface-default text-gray-800 dark:text-gray-100 text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  value={editRowData.work || editRowData.purpose || ""}
                  onChange={(e) =>
                    setEditRowData({
                      ...editRowData,
                      work: e.target.value,
                      purpose: e.target.value,
                    })
                  }
                  placeholder={t("placeholder.workPurposeInput", "Enter the purpose of the work")}
                />
              </div>

              {/* Row 4: Problem phenomenon * and Cause */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-text-subtle mb-1 block">
                    {t("field.situation", "문제 현상")} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    className="w-full p-2.5 rounded-xl border border-border-base bg-surface-default text-gray-800 dark:text-gray-100 text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    value={editRowData.situation || ""}
                    onChange={(e) => setEditRowData({ ...editRowData, situation: e.target.value })}
                    placeholder={t("placeholder.situationInput", "Problem Phenomenon Input")}
                    style={{
                      borderColor: editErrors.situation
                        ? "var(--color-text-danger, #dc2626)"
                        : undefined,
                      borderWidth: editErrors.situation ? "1.5px" : undefined,
                    }}
                  />
                  {editErrors.situation && (
                    <span className="mt-1 block text-[11px] font-semibold text-red-500 animate-fade-in">
                      <i className="fas fa-exclamation-circle mr-1" />
                      {editErrors.situation}
                    </span>
                  )}
                </div>
                <div>
                  <label className="text-xs font-semibold text-text-subtle mb-1 block">
                    {t("field.cause", "문제 원인")}
                  </label>
                  <input
                    type="text"
                    className="w-full p-2.5 rounded-xl border border-border-base bg-surface-default text-gray-800 dark:text-gray-100 text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    value={editRowData.cause || ""}
                    onChange={(e) => setEditRowData({ ...editRowData, cause: e.target.value })}
                    placeholder={t("placeholder.causeInput", "Enter the cause of the problem")}
                  />
                </div>
              </div>

              {/* Row 5: BOM and Material Name */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-text-subtle mb-1 block">
                    {t("field.bom", "BOM")}
                  </label>
                  <input
                    type="text"
                    className="w-full p-2.5 rounded-xl border border-border-base bg-surface-default text-gray-800 dark:text-gray-100 text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    value={editRowData.bom || ""}
                    onChange={(e) => setEditRowData({ ...editRowData, bom: e.target.value })}
                    placeholder={t("placeholder.bomInput", "BOM Entry")}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-text-subtle mb-1 block">
                    {t("field.sparePart", "자재명")}
                  </label>
                  <input
                    type="text"
                    className="w-full p-2.5 rounded-xl border border-border-base bg-surface-default text-gray-800 dark:text-gray-100 text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    value={editRowData.sparePart || ""}
                    onChange={(e) => setEditRowData({ ...editRowData, sparePart: e.target.value })}
                    placeholder={t("placeholder.sparePartInput", "Enter material name")}
                  />
                </div>
              </div>

              {/* Row 6: HW Before & After */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-text-subtle mb-1 block">
                    {t("field.hwBefore", "HW 변경 전")}
                  </label>
                  <input
                    type="text"
                    className="w-full p-2.5 rounded-xl border border-border-base bg-surface-default text-gray-800 dark:text-gray-100 text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    value={editRowData.hwAsWas || ""}
                    onChange={(e) => setEditRowData({ ...editRowData, hwAsWas: e.target.value })}
                    placeholder={t("placeholder.hwBefore", "Before changing the hardware")}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-text-subtle mb-1 block">
                    {t("field.hwAfter", "HW 변경 후")}
                  </label>
                  <input
                    type="text"
                    className="w-full p-2.5 rounded-xl border border-border-base bg-surface-default text-gray-800 dark:text-gray-100 text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    value={editRowData.hwAsIs || ""}
                    onChange={(e) => setEditRowData({ ...editRowData, hwAsIs: e.target.value })}
                    placeholder={t("placeholder.hwAfter", "After changing the hardware")}
                  />
                </div>
              </div>

              {/* Row 7: SW Before & After */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-text-subtle mb-1 block">
                    {t("field.swBefore", "SW 변경 전")}
                  </label>
                  <input
                    type="text"
                    className="w-full p-2.5 rounded-xl border border-border-base bg-surface-default text-gray-800 dark:text-gray-100 text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    value={editRowData.swAsWas || ""}
                    onChange={(e) => setEditRowData({ ...editRowData, swAsWas: e.target.value })}
                    placeholder={t("placeholder.swBefore", "Before Software Change")}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-text-subtle mb-1 block">
                    {t("field.swAfter", "SW 변경 후")}
                  </label>
                  <input
                    type="text"
                    className="w-full p-2.5 rounded-xl border border-border-base bg-surface-default text-gray-800 dark:text-gray-100 text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    value={editRowData.swAsIs || ""}
                    onChange={(e) => setEditRowData({ ...editRowData, swAsIs: e.target.value })}
                    placeholder={t("placeholder.swAfter", "After the software change")}
                  />
                </div>
              </div>

              {/* Row 8: Priority and Category */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-text-subtle mb-1 block">
                    {t("field.priority", "중요도")}
                  </label>
                  <select
                    className="w-full p-2.5 rounded-xl border border-border-base bg-surface-default text-gray-800 dark:text-gray-100 text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all cursor-pointer"
                    value={editRowData.priority || "일반"}
                    onChange={(e) => {
                      const pName = e.target.value;
                      const pObj = (filterData?.priority ?? []).find(
                        (p) => p.priorityName === pName,
                      );
                      setEditRowData((prev) => ({
                        ...prev,
                        priority: pName,
                        priorityId: pObj?.id ?? prev.priorityId ?? 1,
                      }));
                    }}
                  >
                    {(filterData?.priority ?? []).length > 0
                      ? (filterData?.priority ?? []).map((p) => (
                          <option key={p.id} value={p.priorityName}>
                            {p.priorityName}
                          </option>
                        ))
                      : [
                          { id: 1, priorityName: "필수" },
                          { id: 2, priorityName: "중요" },
                          { id: 3, priorityName: "일반" },
                          { id: 4, priorityName: "제외" },
                        ].map((p) => (
                          <option key={p.id} value={p.priorityName}>
                            {p.priorityName}
                          </option>
                        ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-text-subtle mb-1 block">
                    {t("field.category", "효과 유형")}
                  </label>
                  <select
                    className="w-full p-2.5 rounded-xl border border-border-base bg-surface-default text-gray-800 dark:text-gray-100 text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all cursor-pointer"
                    value={editRowData.category || "기타"}
                    onChange={(e) => {
                      const cName = e.target.value;
                      const cObj = (filterData?.category ?? []).find(
                        (c) => c.categoryName === cName,
                      );
                      setEditRowData((prev) => ({
                        ...prev,
                        category: cName,
                        categoryId: cObj?.id ?? prev.categoryId ?? 1,
                      }));
                    }}
                  >
                    {(filterData?.category ?? []).length > 0
                      ? (filterData?.category ?? []).map((c) => (
                          <option key={c.id} value={c.categoryName}>
                            {c.categoryName}
                          </option>
                        ))
                      : ["생산성", "품질", "보전성", "기타"].map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                  </select>
                </div>
              </div>

              {/* Row 9: Work Completion Date and Site */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-text-subtle mb-1 block">
                    {t("field.workedOn", "작업완료일")}
                  </label>
                  <input
                    type="date"
                    className="w-full p-2.5 rounded-xl border border-border-base bg-surface-default text-gray-800 dark:text-gray-100 text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    value={editRowData.workedOn || ""}
                    onChange={(e) => setEditRowData({ ...editRowData, workedOn: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-text-subtle mb-1 block">
                    {t("field.site", "요청 법인")}
                  </label>
                  <select
                    className="w-full p-2.5 rounded-xl border border-border-base bg-surface-default text-gray-800 dark:text-gray-100 text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all cursor-pointer"
                    value={editRowData.site || ""}
                    onChange={(e) => {
                      const sName = e.target.value;
                      const sObj = (filterData?.site ?? []).find((s) => s.siteName === sName);
                      setEditRowData((prev) => ({
                        ...prev,
                        site: sName,
                        siteId: sObj?.id ?? prev.siteId ?? 1,
                      }));
                    }}
                  >
                    <option value="">{t("site.selection", "Selection")}</option>
                    {(filterData?.site ?? []).map((s) => (
                      <option key={s.id} value={s.siteName}>
                        {s.siteName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="modal-footer shrink-0 !px-0 !pb-0 pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <button
                type="button"
                className="px-6 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-xs font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                onClick={() => {
                  setShowEditModal(false);
                  setEditRowId(null);
                  setEditErrors({});
                }}
              >
                {t("app.cancel", "취소")}
              </button>
              <button
                type="button"
                className="bg-[#1745c2] hover:bg-[#1239a5] text-white font-bold py-2.5 px-8 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer text-xs"
                onClick={handleEditModalSave}
              >
                <i className="fas fa-check text-xs" />
                {t("app.save", "저장하기")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Drawer */}
      <Drawer
        item={drawerItem}
        onClose={() => setDrawerItem(null)}
        variant="matrix"
        showEdit={true}
        allowEdit={true}
        showAttachments={true}
        showFooter={true}
      />
    </section>
  );
}
