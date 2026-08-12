import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import Modal from "../components/Modal.jsx";
import { pocEndPoints } from "../axios/endPoints.js";
import { APIcallGet, APIcallPost, APIcallDelete } from "../axios/apiCall.js";
import { useI18n } from "../i18n.jsx";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import ExportDropdown from "../components/ExportDropdown.jsx";
import Pagination from "../components/Pagination.jsx";
import SortableTh from "../components/SortableTh.jsx";
import { isStaticDataMode, isLoadTableDataOnload } from "../utils/staticDataMode.js";
import { changeFilterDataAndTableData } from "./static-data/ChangeHistoryData.js";
import { getUserInfo } from "../utils/cookieUtils.js";

// Reusable SearchableSelect Dropdown Component (single-select with search)
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
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400" />
            <input
              type="text"
              autoFocus
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t("matrix.searchRepWork", "Search rep work...")}
              className="w-full rounded-xl input-base pl-8 pr-7 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
              >
                <i className="fas fa-times" />
              </button>
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
              <span>{t("app.all", "All")}</span>
              {(selectedValue === "전체" || !selectedValue) && (
                <i className="fas fa-check text-blue-600 dark:text-blue-400 text-xs" />
              )}
            </button>

            {filteredOptions.length === 0 ? (
              <div className="px-3 py-3 text-center text-xs text-gray-400">
                {t("matrix.noMatchingTask", "No matching results")}
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
function MultiSelect({ options, selectedValues, onChange, placeholder, t, disabled }) {
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
      displayText = selectedValues[0];
    } else {
      displayText = `${selectedValues.length}${t("app.selectedCount", "개 선택")}`;
    }
  }

  return (
    <div ref={containerRef} className="relative w-full">
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
          fontSize: "13px",
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
                <span className="truncate" style={{ fontSize: "13px" }}>
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
// FilterToast — inline toast supporting loading / success / error / warning
// ─────────────────────────────────────────────────────────────────────────────
const TOAST_STYLES = {
  success: { bg: "#f0fdf4", border: "#86efac", color: "#15803d", icon: "fas fa-check-circle" },
  error: { bg: "#fef2f2", border: "#fca5a5", color: "#dc2626", icon: "fas fa-times-circle" },
  warning: {
    bg: "#fffbeb",
    border: "#fcd34d",
    color: "#b45309",
    icon: "fas fa-exclamation-triangle",
  },
  loading: { bg: "#eff6ff", border: "#93c5fd", color: "#1d4ed8", icon: "fas fa-spinner fa-spin" },
};

function FilterToast({ isVisible, status, message, autoClose, onClose }) {
  const timerRef = useRef(null);

  useEffect(() => {
    if (isVisible && autoClose) {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(onClose, 3000);
    }
    return () => clearTimeout(timerRef.current);
  }, [isVisible, autoClose, message, onClose]);

  if (!isVisible) return null;

  const s = TOAST_STYLES[status] ?? TOAST_STYLES.loading;

  return (
    <div
      style={{
        position: "fixed",
        top: "24px",
        right: "24px",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "12px 18px",
        borderRadius: "10px",
        background: s.bg,
        border: `1px solid ${s.border}`,
        color: s.color,
        fontSize: "14px",
        fontWeight: 500,
        boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
        maxWidth: "360px",
        animation: "toastIn 0.22s ease",
      }}
    >
      <i className={s.icon} style={{ fontSize: "16px", flexShrink: 0 }} />
      <span style={{ flex: 1 }}>{message}</span>
      <button
        type="button"
        onClick={onClose}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: s.color,
          opacity: 0.6,
          padding: "0 2px",
          fontSize: "14px",
        }}
        aria-label="닫기"
      >
        <i className="fas fa-times" />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants — columns shown in the table
// ─────────────────────────────────────────────────────────────────────────────
const TABLE_COLUMNS = [
  "report",
  "representativeWork",
  "work",
  "situation",
  "cause",
  "hwAsWas",
  "hwAsIs",
  "swAsWas",
  "swAsIs",
  "bom",
  "sparePart",
  "wOCode",
  "workedOn",
  "createdBy",
  "createdAt",
];

const COLUMN_LABELS = {
  report: "보고서",
  representativeWork: "대표작업명",
  work: "작업 목적",
  situation: "문제 현상",
  cause: "문제 원인",
  bom: "BOM",
  sparePart: "자재명",
  hwAsWas: "HW 변경 전",
  hwAsIs: "HW 변경 후",
  swAsWas: "SW 변경 전",
  swAsIs: "SW 변경 후",
  wOCode: "W/O코드",
  workedOn: "작업완료일",
  createdBy: "생성자",
  createdAt: "생성일",
};

const COLUMN_LABEL_KEYS = {
  report: "field.report",
  representativeWork: "field.repWork",
  work: "field.work",
  situation: "field.situation",
  cause: "field.cause",
  bom: "field.bom",
  sparePart: "field.sparePart",
  hwAsWas: "field.hwBefore",
  hwAsIs: "field.hwAfter",
  swAsWas: "field.swBefore",
  swAsIs: "field.swAfter",
  wOCode: "field.woCode",
  workedOn: "field.workedOn",
  createdBy: "field.createdBy",
  createdAt: "field.createdAt",
};

function columnLabel(col, t) {
  return t(COLUMN_LABEL_KEYS[col], COLUMN_LABELS[col] ?? col);
}

const EMPTY_ROW = {
  representativeWork: "",
  work: "",
  report: "",
  situation: "",
  cause: "",
  bom: "",
  sparePart: "",
  hwAsWas: "",
  hwAsIs: "",
  swAsWas: "",
  swAsIs: "",
  priority: "일반",
  category: "기타",
  wOCode: "",
  workedOn: "",
  equipmentCode: "-",
  equipmentName: " Common",
  process: "",
  maintGroup: "",
  site: "",
};

// Key mapping helper
function getColValue(row, col) {
  if (!row) return "";
  if (col === "representativeWork") {
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
  if (col === "work") {
    return row.purpose ?? row.work ?? row.workName ?? row["작업 목적"] ?? row["작업목적"] ?? "";
  }
  if (col === "situation") {
    return row.situation ?? row["문제 현상"] ?? "";
  }
  if (col === "cause") {
    return row.cause ?? row["문제 원인"] ?? "";
  }
  if (col === "report") {
    return row.report_content ?? row.report ?? row["보고서"] ?? "";
  }
  if (col === "bom") {
    return row.bom ?? row["BOM"] ?? "";
  }
  if (col === "sparePart") {
    return row.sparePart ?? row["자재명"] ?? "";
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
      row.effect_type ??
      row.effectType ??
      row["효과 유형"] ??
      row["효과유형"] ??
      ""
    );
  }
  if (col === "wOCode") {
    return row.wOCode ?? row.woCode ?? row["W/O코드"] ?? "";
  }
  if (col === "workedOn") {
    return (
      row.work_date ?? row.workedDate ?? row.workDate ?? row.workedOn ?? row["작업완료일"] ?? ""
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
  if (col === "createdBy") {
    return row.created_by ?? row.createdBy ?? row["생성자"] ?? "";
  }
  if (col === "createdAt") {
    return row.created_at ?? row.createdAt ?? row["생성일"] ?? "";
  }
  return row[col] ?? "";
}

function getFormattedDateString(raw) {
  if (!raw) return "";
  if (!isNaN(Number(raw))) {
    const d = new Date(new Date(1899, 11, 30).getTime() + Number(raw) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  const parsed = new Date(raw);
  if (parsed && !isNaN(parsed)) {
    return parsed.toISOString().slice(0, 10);
  }
  return String(raw).trim();
}

function rowKey(row, index) {
  return `${index}__${row.id ?? ""}__${row.equipmentCode ?? ""}__${getColValue(row, "representativeWork") || getColValue(row, "work")}`;
}

function isRowSelected(row, drawerItem) {
  if (!row || !drawerItem) return false;

  const rowWo = getColValue(row, "wOCode");
  const drawerWo = getColValue(drawerItem, "wOCode");
  if (rowWo && drawerWo && rowWo !== "—" && drawerWo !== "—") {
    return rowWo === drawerWo;
  }

  if (row.id && drawerItem.id && row.id !== 0 && drawerItem.id !== 0) {
    return row.id === drawerItem.id;
  }

  if (row._localId && drawerItem._localId) {
    return row._localId === drawerItem._localId;
  }

  return (
    getColValue(row, "representativeWork") === getColValue(drawerItem, "representativeWork") &&
    getColValue(row, "process") === getColValue(drawerItem, "process") &&
    getColValue(row, "maintGroup") === getColValue(drawerItem, "maintGroup") &&
    getColValue(row, "workedOn") === getColValue(drawerItem, "workedOn")
  );
}

function SelectSkeleton({ width = "100%" }) {
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

function TableSkeleton({ rows = 6, t }) {
  return (
    <div className="mp-table-scroll overflow-auto">
      <table
        className="min-w-full text-left text-sm"
        style={{ tableLayout: "fixed", width: "100%", minWidth: "1280px" }}
      >
        <colgroup>
          <col style={{ width: "3%" }} />
          <col style={{ width: "8%" }} />
          <col style={{ width: "8%" }} />
          <col style={{ width: "8%" }} />
          <col style={{ width: "7%" }} />
          <col style={{ width: "7%" }} />
          <col style={{ width: "6%" }} />
          <col style={{ width: "6%" }} />
          <col style={{ width: "6%" }} />
          <col style={{ width: "6%" }} />
          <col style={{ width: "5%" }} />
          <col style={{ width: "5%" }} />
          <col style={{ width: "7%" }} />
          <col style={{ width: "7%" }} />
          <col style={{ width: "7%" }} />
          <col style={{ width: "8%" }} />
        </colgroup>
        <thead className="table-header" style={{ position: "sticky", top: 0, zIndex: 1 }}>
          <tr>
            <th style={{ textAlign: "center" }}></th>
            {TABLE_COLUMNS.map((col) => (
              <th
                key={col}
                className="px-3 py-3 text-text-subtle whitespace-nowrap text-xs font-semibold"
              >
                {columnLabel(col, t)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i} className="border-t border-border-base">
              <td className="px-3 py-3"></td>
              {TABLE_COLUMNS.map((col) => (
                <td key={col} className="px-4 py-3">
                  <div
                    style={{
                      height: "14px",
                      borderRadius: "4px",
                      width: `${50 + ((i * col.length * 3) % 40)}%`,
                      background: "linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)",
                      backgroundSize: "200% 100%",
                      animation: "shimmer 1.4s infinite",
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

export default function MPList({
  onAddRow,
  onExport,
  searchText,
  onOpenDetail,
  drawerItem,
  onUpload,
}) {
  const { t, language } = useI18n();
  const batchFileInputRef = useRef(null);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchModalError, setBatchModalError] = useState("");
  const [batchParsedRows, setBatchParsedRows] = useState([]);
  const [batchDuplicateFlags, setBatchDuplicateFlags] = useState([]);
  const [batchFilter, setBatchFilter] = useState("all");
  const [batchSaving, setBatchSaving] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [applicableRows, setApplicableRows] = useState([]);
  const [notApplicableRows, setNotApplicableRows] = useState([]);

  // ── Filter state ──────────────────────────────────────────────────────────
  const [selectedProcessId, setSelectedProcessId] = useState(null);
  const [selectedEquipmentTypeId, setSelectedEquipmentTypeId] = useState(null);
  const [selectedSiteId, setSelectedSiteId] = useState(null);
  const [selectedWoType, setSelectedWoType] = useState("전체");
  const [selectedPriorities, setSelectedPriorities] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });
  const [dateTo, setDateTo] = useState(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });

  const [isFiltering, setIsFiltering] = useState(false);
  const [prevFilters, setPrevFilters] = useState({
    processId: null,
    equipmentTypeId: null,
    siteId: null,
    woType: "전체",
    prioritiesJson: "[]",
    categoriesJson: "[]",
    dateFrom: "",
    dateTo: "",
    searchText: "",
  });

  const currentWoType = selectedWoType;
  const currentPrioritiesJson = JSON.stringify(selectedPriorities);
  const currentCategoriesJson = JSON.stringify(selectedCategories);

  if (
    selectedProcessId !== prevFilters.processId ||
    selectedSiteId !== prevFilters.siteId ||
    selectedWoType !== prevFilters.woType ||
    currentPrioritiesJson !== prevFilters.prioritiesJson ||
    currentCategoriesJson !== prevFilters.categoriesJson ||
    dateFrom !== prevFilters.dateFrom ||
    dateTo !== prevFilters.dateTo ||
    searchText !== prevFilters.searchText
  ) {
    setPrevFilters({
      processId: selectedProcessId,
      siteId: selectedSiteId,
      woType: currentWoType,
      prioritiesJson: currentPrioritiesJson,
      categoriesJson: currentCategoriesJson,
      dateFrom,
      dateTo,
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

  // ── Master data ───────────────────────────────────────────────────────────
  const [allRecords, setAllRecords] = useState([]);
  const [changedDataId, setChangedDataId] = useState(0);
  const [dataLoading, setDataLoading] = useState(true);
  const [filterPayload, setFilterPayload] = useState(null);
  const [filterError, setFilterError] = useState(null);

  // ── Modal ─────────────────────────────────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [newRow, setNewRow] = useState(EMPTY_ROW);
  const [editingRowLocalId, setEditingRowLocalId] = useState(null);
  const [modalError, setModalError] = useState("");
  const [errors, setErrors] = useState({});

  // ── Unsaved edits tracking ────────────────────────────────────────────────
  const [isDirty, setIsDirty] = useState(false);
  const [savingAll, setSavingAll] = useState(false);

  // ── Toast ─────────────────────────────────────────────────────────────────
  const [operationStatus, setOperationStatus] = useState({
    isVisible: false,
    status: "loading",
    message: "",
    autoClose: true,
  });

  const filterLoading = filterPayload === null && filterError === null;

  // ── Derived cascade option lists ──────────────────────────────────────────
  const processList = useMemo(() => {
    return (filterPayload?.process ?? []).filter((p) => p.isChangedData !== false);
  }, [filterPayload]);

  const equipmentTypeList = useMemo(() => {
    const all = (filterPayload?.eqTypes ?? filterPayload?.EqTypes ?? []).filter(
      (e) => e.isChangedData !== false,
    );
    if (!selectedProcessId) return all;
    return all.filter((e) => e.processId === selectedProcessId);
  }, [filterPayload, selectedProcessId]);

  const siteList = useMemo(() => {
    const all = (filterPayload?.site ?? []).filter((s) => s.isChangedData !== false);
    if (!selectedProcessId) return all;
    return all.filter((s) => s.processId === selectedProcessId);
  }, [filterPayload, selectedProcessId]);

  const woTypeOptions = useMemo(() => {
    return (filterPayload?.woTypes ?? filterPayload?.WoTypes ?? [])
      .map((w) => w.workOrderTypeName)
      .filter(Boolean);
  }, [filterPayload]);

  const priorityOptions = useMemo(() => {
    const rawList = [
      ...new Set((filterPayload?.priority ?? []).map((p) => p.priorityName).filter(Boolean)),
    ];
    if (rawList.length === 0) {
      return [
        { label: "중요", value: "중요" },
        { label: "일반", value: "일반" },
      ];
    }
    return rawList.map((p) => ({ label: p, value: p }));
  }, [filterPayload]);

  const categoryOptions = useMemo(() => {
    const rawList = [
      ...new Set((filterPayload?.category ?? []).map((c) => c.categoryName).filter(Boolean)),
    ];
    if (rawList.length === 0) {
      return [
        { label: "생산성", value: "생산성" },
        { label: "품질", value: "품질" },
        { label: "보전성", value: "보전성" },
        { label: "기타", value: "기타" },
      ];
    }
    return rawList.map((c) => ({ label: c, value: c }));
  }, [filterPayload]);

  // ── Cascade reset handlers ────────────────────────────────────────────────
  const handleProcessChange = (e) => {
    const val = e.target.value;
    setSelectedProcessId(val === "" ? null : Number(val));
    setSelectedEquipmentTypeId(null);
    setSelectedSiteId(null);
  };

  const handleResetDates = () => {
    setDateFrom("");
    setDateTo("");
  };

  useEffect(() => {
    setSelectedWoType("전체");
  }, [selectedProcessId]);

  // ── Fetch filter options + changedDataJson rows ───────────────────────────
  const fetchData = useCallback(() => {
    setDataLoading(true);

    if (isStaticDataMode) {
      try {
        const payload = changeFilterDataAndTableData;
        setFilterPayload(payload);
        setFilterError(null);

        const loadedRecords = [];
        if (Array.isArray(payload?.changedDataJson)) {
          payload.changedDataJson.forEach((item) => {
            try {
              if (item.content) {
                const parsed =
                  typeof item.content === "string" ? JSON.parse(item.content) : item.content;
                if (Array.isArray(parsed)) {
                  loadedRecords.push(...parsed.map((r) => ({ ...r, _sourceId: item.id })));
                }
              }
            } catch (e) {
              console.warn("[MPList] Failed to parse static changedDataJson content:", e);
            }
          });
          loadedRecords.sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
        }
        setAllRecords(loadedRecords);
        if (payload?.changedDataJson?.[0]) {
          setChangedDataId(payload.changedDataJson[0].id ?? 0);
        }
      } catch (error) {
        console.error("[MPList] Error processing static data:", error);
        setFilterPayload({
          process: [],
          site: [],
          maintenance: [],
          representations: [],
          priority: [],
          category: [],
        });
        setFilterError(t("toast.filterError", "데이터 처리 중 오류가 발생했습니다."));
        setAllRecords([]);
      } finally {
        setDataLoading(false);
      }
      return;
    }

    APIcallGet(`${pocEndPoints?.GET_FILTER_DATA}`, {}, (responseData, status) => {
      try {
        if (status === 200 && responseData) {
          const payload = responseData?.data || responseData;
          setFilterPayload(payload);
          setFilterError(null);

          const loadedRecords = [];
          if (Array.isArray(payload?.changedDataJson)) {
            payload.changedDataJson.forEach((item) => {
              try {
                if (item.content) {
                  const parsed =
                    typeof item.content === "string" ? JSON.parse(item.content) : item.content;
                  if (Array.isArray(parsed)) {
                    loadedRecords.push(...parsed.map((r) => ({ ...r, _sourceId: item.id })));
                  }
                }
              } catch (e) {
                console.warn("[MPList] Failed to parse changedDataJson content:", e);
              }
            });
            loadedRecords.sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
          }
          setAllRecords(loadedRecords);
          if (payload?.changedDataJson?.[0]) {
            setChangedDataId(payload.changedDataJson[0].id ?? 0);
          }
        } else {
          console.warn("[MPList] API invalid status:", status);
          setFilterPayload({
            process: [],
            site: [],
            maintenance: [],
            representations: [],
            priority: [],
            category: [],
          });
          setFilterError(t("toast.filterLoadError", "필터 데이터를 불러올 수 없습니다."));
          setAllRecords([]);
        }
      } catch (error) {
        console.error("[MPList] Error:", error);
        setFilterPayload({
          process: [],
          site: [],
          maintenance: [],
          representations: [],
          priority: [],
          category: [],
        });
        setFilterError(t("toast.filterError", "데이터 처리 중 오류가 발생했습니다."));
        setAllRecords([]);
      } finally {
        setDataLoading(false);
      }
    });
  }, [t]);

  const fetchMPList = useCallback(() => {
    if (isStaticDataMode) return;

    const sanitizeArrayOfNums = (arr) => {
      if (!Array.isArray(arr) || arr.length === 0) return [0];
      const res = arr
        .map((item) => {
          const num = Number(item);
          return isNaN(num) ? 0 : num;
        })
        .filter((val) => !isNaN(val));
      return res.length > 0 ? res : [0];
    };

    const reqBody = {
      processId:
        selectedProcessId && !isNaN(Number(selectedProcessId)) ? Number(selectedProcessId) : 0,
      equipmentTypeId:
        selectedEquipmentTypeId && !isNaN(Number(selectedEquipmentTypeId))
          ? Number(selectedEquipmentTypeId)
          : 0,
      siteId: selectedSiteId && !isNaN(Number(selectedSiteId)) ? Number(selectedSiteId) : 0,
      workOrderType: selectedWoType && selectedWoType !== "전체" ? selectedWoType : 0,
      priority: sanitizeArrayOfNums(selectedPriorities),
      effectType: sanitizeArrayOfNums(selectedCategories),
      fromDate: dateFrom ? dateFrom : null,
      toDate: dateTo ? dateTo : null,
    };

    setDataLoading(true);

    APIcallPost(pocEndPoints.GET_MP_LIST, reqBody, {}, (responseData, status) => {
      setDataLoading(false);
      if (status === 200 && responseData) {
        let records = [];
        if (Array.isArray(responseData) && Array.isArray(responseData[0]?.data?.dataList)) {
          records = responseData[0].data.dataList;
        } else if (Array.isArray(responseData?.data?.dataList)) {
          records = responseData.data.dataList;
        } else if (Array.isArray(responseData?.dataList)) {
          records = responseData.dataList;
        } else if (Array.isArray(responseData) && responseData.length > 0 && !responseData[0]?.data) {
          records = responseData;
        } else if (Array.isArray(responseData?.data)) {
          records = responseData.data;
        } else if (Array.isArray(responseData?.data?.mpList)) {
          records = responseData.data.mpList;
        } else if (Array.isArray(responseData?.mpList)) {
          records = responseData.mpList;
        }
        setAllRecords(records);
      } else {
        console.warn("[MPList] GetMPList API failed:", status, responseData);
      }
    });
  }, [
    isStaticDataMode,
    selectedProcessId,
    selectedEquipmentTypeId,
    selectedWoType,
    selectedSiteId,
    selectedPriorities,
    selectedCategories,
    dateFrom,
    dateTo,
  ]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!filterPayload) return;
    // Call API on load if any filter is active (not just process/maintenance)
    const isAnyFilterActive =
      selectedProcessId !== null ||
      selectedEquipmentTypeId !== null ||
      selectedSiteId !== null ||
      (Array.isArray(selectedPriorities) && selectedPriorities.length > 0) ||
      (Array.isArray(selectedCategories) && selectedCategories.length > 0) ||
      Boolean(dateFrom) ||
      Boolean(dateTo);

    if (isLoadTableDataOnload || isAnyFilterActive) {
      fetchMPList();
    }
  }, [
    filterPayload,
    fetchMPList,
    isLoadTableDataOnload,
    selectedProcessId,
    selectedEquipmentTypeId,
    selectedSiteId,
    selectedPriorities,
    selectedCategories,
    dateFrom,
    dateTo,
  ]);

  // ── Filtered & Grouped rows ───────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!selectedProcessId) {
      return [];
    }
    const selProcessName = processList.find((p) => p.id === selectedProcessId)?.processName;
    const selEqTypeName = equipmentTypeList.find(
      (e) => e.id === selectedEquipmentTypeId,
    )?.equipmentTypeName;
    const selSiteName = siteList.find((s) => s.id === selectedSiteId)?.siteName;
    let preFiltered = allRecords.filter((item) => {
      // Match by name OR by ID — API may return either process_name or process_id
      const itemProc = getColValue(item, "process");
      const itemProcId = item.process_id ?? item.processId ?? null;
      const matchProc =
        !selectedProcessId ||
        itemProc === selProcessName ||
        Number(itemProcId) === Number(selectedProcessId);

      const itemEqType = getColValue(item, "maintGroup");
      const itemEqTypeId = item.equipment_type_id ?? item.equipmentTypeId ?? null;
      const matchEqType =
        !selectedEquipmentTypeId ||
        itemEqType === selEqTypeName ||
        Number(itemEqTypeId) === Number(selectedEquipmentTypeId);

      const itemSite = getColValue(item, "site");
      const itemSiteId = item.site_id ?? item.siteId ?? null;
      const matchSite =
        !selectedSiteId ||
        itemSite === selSiteName ||
        Number(itemSiteId) === Number(selectedSiteId);

      const itemWoType = getColValue(item, "woType");
      const matchWoType =
        selectedWoType === "전체" || !selectedWoType || itemWoType === selectedWoType;

      const itemPriority = getColValue(item, "priority");
      const matchPri = selectedPriorities.length === 0 || selectedPriorities.includes(itemPriority);

      const itemCategory = getColValue(item, "category");
      const matchCat = selectedCategories.length === 0 || selectedCategories.includes(itemCategory);

      let matchDate = true;
      if (dateFrom || dateTo) {
        const dateStr = getFormattedDateString(getColValue(item, "workedOn"));
        if (dateStr) {
          if (dateFrom && dateStr < dateFrom) matchDate = false;
          if (dateTo && dateStr > dateTo) matchDate = false;
        } else {
          matchDate = false;
        }
      }

      let matchSearch = true;
      if (searchText) {
        const text = Object.values(item)
          .map((v) => String(v ?? ""))
          .join(" ")
          .toLowerCase();
        matchSearch = text.includes(searchText.toLowerCase());
      }

      return (
        matchProc &&
        matchEqType &&
        matchSite &&
        matchWoType &&
        matchPri &&
        matchCat &&
        matchDate &&
        matchSearch
      );
    });

    // Grouping: Representative Work unique, keep latest by completion date
    const latestMap = {};
    const noNameRows = [];

    preFiltered.forEach((r) => {
      const name = String(getColValue(r, "representativeWork")).trim();
      if (!name) {
        noNameRows.push(r);
        return;
      }
      const workedOnDate = getFormattedDateString(getColValue(r, "workedOn"));
      if (!latestMap[name]) {
        latestMap[name] = r;
      } else {
        const existingDate = getFormattedDateString(getColValue(latestMap[name], "workedOn"));
        if (workedOnDate > existingDate) {
          latestMap[name] = r;
        }
      }
    });

    const groupedData = Object.values(latestMap).concat(noNameRows);

    // Sort descending by workedOn date
    groupedData.sort((a, b) => {
      const dateA = getFormattedDateString(getColValue(a, "workedOn"));
      const dateB = getFormattedDateString(getColValue(b, "workedOn"));
      return dateB.localeCompare(dateA);
    });

    return groupedData;
  }, [
    allRecords,
    selectedProcessId,
    selectedEquipmentTypeId,
    selectedSiteId,
    selectedWoType,
    selectedPriorities,
    selectedCategories,
    dateFrom,
    dateTo,
    searchText,
    processList,
    equipmentTypeList,
    siteList,
    filterPayload,
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
  }, [
    selectedProcessId,
    selectedEquipmentTypeId,
    selectedWoType,
    selectedPriorities,
    selectedCategories,
    dateFrom,
    dateTo,
    searchText,
    sortConfig,
  ]);

  const sortedFilteredData = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) return filtered;
    return [...filtered].sort((a, b) => {
      const valA = getColValue(a, sortConfig.key) ?? "";
      const valB = getColValue(b, sortConfig.key) ?? "";
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

  // ── Format workedOn for display ───────────────────────────────────────────
  function formatWorkedOn(raw) {
    if (!raw) return "—";
    if (!isNaN(Number(raw))) {
      const d = new Date(new Date(1899, 11, 30).getTime() + Number(raw) * 86400000);
      return d.toISOString().slice(0, 10);
    }
    const parsed = new Date(raw);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
    return String(raw);
  }

  // ── Inline Editor for Priority / Category ──────────────────────────────────
  const handleInlineChange = (row, field, value) => {
    const proc = getColValue(row, "process");
    const part = getColValue(row, "maintGroup");
    const repWork = String(getColValue(row, "representativeWork")).trim();

    setAllRecords((prev) => {
      return prev.map((r) => {
        const matchProc = getColValue(r, "process") === proc;
        const matchPart = getColValue(r, "maintGroup") === part;
        const matchRep = String(getColValue(r, "representativeWork")).trim() === repWork;

        const isTarget =
          matchProc &&
          matchPart &&
          (repWork ? matchRep : r._localId === row._localId || r.id === row.id);

        if (isTarget) {
          const updated = { ...r };
          if (field === "priority") {
            updated.priority = value;
            updated["중요도"] = value;
          } else if (field === "category") {
            updated.category = value;
            updated["효과 유형"] = value;
            updated["효과유형"] = value;
          }
          return updated;
        }
        return r;
      });
    });
    setIsDirty(true);
    setOperationStatus({
      isVisible: true,
      status: "success",
      message: t("toast.valueUpdatedHint", "값이 변경되었습니다 (저장 필요)."),
      autoClose: true,
    });
  };

  // ── Delete a row ───────────────────────────────────────────────────────────
  const handleDeleteRow = (e, row) => {
    e.stopPropagation();
    if (!window.confirm(t("app.confirmDelete", "선택한 행을 삭제하시겠습니까?"))) {
      return;
    }

    const rowId = Number(row.id || row.mpListId || row.versionId || row.changeHistoryId || 0);

    if (isStaticDataMode || !rowId || rowId <= 0) {
      setAllRecords((prev) =>
        prev.filter((r) => {
          if (row._localId && r._localId) return r._localId !== row._localId;
          return r.id !== row.id;
        }),
      );
      setIsDirty(true);
      setOperationStatus({
        isVisible: true,
        status: "success",
        message: t("toast.deleteSuccess", "행이 성공적으로 삭제되었습니다."),
        autoClose: true,
      });
      return;
    }

    setOperationStatus({
      isVisible: true,
      status: "loading",
      message: t("toast.deleting", "삭제 중입니다..."),
      autoClose: false,
    });

    APIcallDelete(`${pocEndPoints.DELETE_MP_LIST_ITEM}/${rowId}`, {}, (responseData, status) => {
      if (status === 200) {
        setOperationStatus({
          isVisible: true,
          status: "success",
          message: t("toast.deleteSuccess", "행이 성공적으로 삭제되었습니다."),
          autoClose: true,
        });
        fetchMPList();
      } else {
        console.error("DeleteMpListItem failed:", status, responseData);
        setOperationStatus({
          isVisible: true,
          status: "error",
          message: t("toast.deleteError", "삭제에 실패했습니다."),
          autoClose: true,
        });
      }
    });
  };

  // ── Edit row on double click ───────────────────────────────────────────────
  const handleRowDoubleClick = (row) => {
    const woCode = getColValue(row, "wOCode");
    if (!woCode || woCode === "—" || woCode === "") {
      setNewRow({
        representativeWork: getColValue(row, "representativeWork"),
        work: getColValue(row, "work"),
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
        workedOn: getColValue(row, "workedOn") || "",
        equipmentCode: row.equipmentCode ?? "-",
        equipmentName: row.equipmentName ?? " Common",
        process: getColValue(row, "process"),
        maintGroup: getColValue(row, "maintGroup"),
        site: getColValue(row, "site"),
      });
      setEditingRowLocalId(row._localId || row.id || "temp");
      setModalError("");
      setErrors({});
      setShowModal(true);
    }
  };

  // ── Modal submit: Add or Edit row ─────────────────────────────────────────
  const handleModalAdd = () => {
    const fieldsToValidate = ["representativeWork", "situation"];
    const nextErrors = {};
    fieldsToValidate.forEach((key) => {
      const val = newRow[key];
      if (!val || !String(val).trim()) {
        nextErrors[key] = t("page.mp.requiredFieldError", "필수 입력 항목입니다.");
      }
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const selProcess = processList.find((p) => p.id === selectedProcessId);
    const selSite = (filterPayload?.site ?? []).find((s) => s.id === selectedSiteId);

    const procName = selProcess?.processName ?? newRow.process ?? "";
    const maintName = newRow.maintGroup ?? "";
    const siteName = selSite?.siteName ?? newRow.site ?? "";

    if (editingRowLocalId !== null) {
      // Edit Mode
      setAllRecords((prev) => {
        return prev.map((r) => {
          const isMatch =
            r._localId === editingRowLocalId || (r.id !== 0 && r.id === editingRowLocalId);
          if (isMatch) {
            return {
              ...r,
              representativeWork: newRow.representativeWork,
              work: newRow.work,
              report: newRow.report,
              situation: newRow.situation,
              cause: newRow.cause,
              bom: newRow.bom,
              sparePart: newRow.sparePart,
              hwAsWas: newRow.hwAsWas,
              hwAsIs: newRow.hwAsIs,
              swAsWas: newRow.swAsWas,
              swAsIs: newRow.swAsIs,
              priority: newRow.priority,
              category: newRow.category,
              workedOn: newRow.workedOn,
            };
          }
          return r;
        });
      });
      setOperationStatus({
        isVisible: true,
        status: "success",
        message: t("toast.rowEditedSuccess", "행이 성공적으로 수정되었습니다."),
        autoClose: true,
      });
      setNewRow(EMPTY_ROW);
      setEditingRowLocalId(null);
      setShowModal(false);
      setIsDirty(true);
    } else {
      // Validation check before Add VoC
      if (
        !newRow.representativeWork?.trim() &&
        !newRow.situation?.trim() &&
        !newRow.problemSymptom?.trim()
      ) {
        setModalError(t("mp.validationRequired", "대표 작업명 또는 문제 현상을 입력해 주세요."));
        return;
      }
      setModalError("");

      // Add VoC Mode via API
      const vocItem = {
        id: 0,
        repWorkId: 0,
        reportContent: newRow.reportContent || newRow.report || "",
        workName: newRow.representativeWork || "",
        purpose: newRow.purpose || newRow.workPurpose || newRow.work || "",
        situation: newRow.situation || newRow.problemSymptom || "",
        cause: newRow.cause || newRow.problemCause || "",
        hwWas: newRow.hwAsWas || newRow.hwBefore || "",
        hwIs: newRow.hwAsIs || newRow.hwAfter || "",
        swWas: newRow.swAsWas || newRow.swBefore || "",
        swIs: newRow.swAsIs || newRow.swAfter || "",
        bom: newRow.bom || "",
        sparePart: newRow.sparePart || newRow.materialList || "",
        equipmentCode: newRow.equipmentCode || "",
        equipmentName: newRow.equipmentName || "",
        woCode: newRow.woCode || newRow.wOCode || "",
        workDate: newRow.workedOn
          ? new Date(newRow.workedOn).toISOString()
          : new Date().toISOString(),
        categoryName: newRow.category || "기타",
        priorityName: newRow.priority || "일반",
        processName: procName,
        siteName: siteName,
        maintenanceGroupName: maintName,
        equipmentTypeName: maintName,
        processId: selectedProcessId ? Number(selectedProcessId) : 0,
        siteId: selectedSiteId ? Number(selectedSiteId) : 0,
        equipmentTypeId: 0,
        createdBy: getUserInfo()?.name || "admin",
      };

      const payload = {
        vocData: [vocItem],
        isVoc: true,
      };

      setOperationStatus({
        isVisible: true,
        status: "loading",
        message: t("toast.saving", "저장 중입니다..."),
        autoClose: false,
      });

      if (isStaticDataMode) {
        const enrichedRow = {
          ...newRow,
          id: 0,
          _pending: true,
          _localId: Date.now(),
          process: procName,
          maintGroup: maintName,
          site: siteName,
        };
        setAllRecords((prev) => [enrichedRow, ...prev]);
        setOperationStatus({
          isVisible: true,
          status: "success",
          message: t("toast.saveSuccess", "저장 성공했습니다."),
          autoClose: true,
        });
        setNewRow(EMPTY_ROW);
        setEditingRowLocalId(null);
        setShowModal(false);
        return;
      }

      APIcallPost(pocEndPoints.SAVE_VOC, payload, {}, (responseData, status) => {
        if (status >= 200 && status < 300) {
          setOperationStatus({
            isVisible: true,
            status: "success",
            message: t("toast.saveSuccess", "저장 성공했습니다."),
            autoClose: true,
          });
          setNewRow(EMPTY_ROW);
          setEditingRowLocalId(null);
          setShowModal(false);
          fetchMPList();
        } else {
          console.error("SaveVoc API failed:", status, responseData);
          setOperationStatus({
            isVisible: true,
            status: "error",
            message: t("toast.saveError", "저장에 실패했습니다."),
            autoClose: true,
          });
        }
      });
    }
  };

  const handleConfirmBatchAdd = useCallback(() => {
    if (batchParsedRows.length === 0) return;

    const changeDataList = batchParsedRows.map((r, idx) => ({
      id: idx + 1,
      site: r.site || "",
      process: r.process || "",
      maintGroup: r.maintGroup || "",
      equipmentCode: r.equipmentCode || "",
      equipmentName: r.equipmentName || "",
      woCode: r.woCode || "",
      report: r.reportContent || r.report || "",
      bom: r.bom || "",
      sparePart: r.sparePart || "",
      workedOn: r.workedOn || "",
      work: r.work || "",
      purpose: r.purpose || "",
      situation: r.situation || "",
      cause: r.cause || "",
      hwAsWas: r.hwAsWas || "",
      hwAsIs: r.hwAsIs || "",
      swAsWas: r.swAsWas || "",
      swAsIs: r.swAsIs || "",
      representativeWork: r.representativeWork || "",
      priority: r.priority || "일반",
      category: r.category || "기타",
      woType: r.woType || "",
      woTypeId: 0,
      eqType: r.maintGroup || "",
      eqTypeId: 0,
      representativeColor: "",
      processId: selectedProcessId ? Number(selectedProcessId) : 0,
      categoryId: 0,
      priorityId: 0,
      siteId: selectedSiteId ? Number(selectedSiteId) : 0,
      maintenanceId: 0,
      equipmentId: 0,
      createdBy: getUserInfo()?.name || "admin",
      is_voc: false,
    }));

    const payload = {
      changeDataList,
      id: 0,
    };

    setBatchSaving(true);
    setOperationStatus({
      isVisible: false,
      status: "loading",
      message: "",
      autoClose: false,
    });

    if (isStaticDataMode) {
      setAllRecords((prev) => [...batchParsedRows, ...prev]);
      setOperationStatus({
        isVisible: true,
        status: "success",
        message: `${batchParsedRows.length} ${t("toast.saveSuccess", "Saved successfully.")}`,
        autoClose: true,
      });
      setBatchParsedRows([]);
      setBatchDuplicateFlags([]);
      setBatchFilter("all");
      setShowBatchModal(false);
      return;
    }

    APIcallPost(pocEndPoints.CHANGE_HISTORY_DATA, payload, {}, (responseData, status) => {
      setBatchSaving(false);
      // API always returns HTTP 200; actual status is in responseData.statusCode
      const bizStatus = responseData?.statusCode ?? status;
      if (bizStatus === 200) {
        setOperationStatus({
          isVisible: true,
          status: "success",
          message: t("toast.saveSuccess", "Saved successfully."),
          autoClose: true,
        });
        setBatchParsedRows([]);
        setBatchDuplicateFlags([]);
        setBatchFilter("all");
        setShowBatchModal(false);
        fetchMPList();
      } else if (bizStatus === 409) {
        // Duplicate records found - parse response and flag duplicates
        const dupData = responseData?.data ?? [];
        const flags = dupData.map((item) => !!item.is_duplicate);
        setBatchDuplicateFlags(flags);
        setBatchFilter("all");
        const dupCount = flags.filter(Boolean).length;
        setOperationStatus({
          isVisible: true,
          status: "warning",
          message: `${dupCount} ${t("batch.duplicateFound", "duplicate record(s) found. Please review.")}`,
          autoClose: true,
        });
      } else {
        console.error("Batch save failed:", bizStatus, responseData);
        setOperationStatus({
          isVisible: true,
          status: "error",
          message: t("toast.saveError", "Save failed."),
          autoClose: true,
        });
      }
    });
  }, [batchParsedRows, selectedProcessId, selectedSiteId, t, fetchMPList]);

  // Remove all duplicate rows from batchParsedRows
  const handleRemoveDuplicates = useCallback(() => {
    const filteredRows = batchParsedRows.filter((_, idx) => !batchDuplicateFlags[idx]);
    setBatchParsedRows(filteredRows);
    setBatchDuplicateFlags([]);
    setBatchFilter("all");
  }, [batchParsedRows, batchDuplicateFlags]);

  // Count of duplicate rows
  const batchDupCount = useMemo(
    () => batchDuplicateFlags.filter(Boolean).length,
    [batchDuplicateFlags],
  );

  // Filtered rows based on batchFilter tab
  const batchFilteredRows = useMemo(() => {
    if (batchFilter === "duplicate") {
      return batchParsedRows.filter((_, idx) => batchDuplicateFlags[idx]);
    }
    if (batchFilter === "missing") {
      return batchParsedRows.filter((_, idx) => !batchDuplicateFlags[idx]);
    }
    return batchParsedRows;
  }, [batchParsedRows, batchDuplicateFlags, batchFilter]);

  // ── Save MP Version ───────────────────────────────────────────────────────
  const handleSaveAll = useCallback(() => {
    setSavingAll(true);
    setOperationStatus({
      isVisible: true,
      status: "loading",
      message: t("toast.saving", "저장 중입니다..."),
      autoClose: false,
    });

    const changeDataList = [
      ...applicableRows.map((r) => ({
        changeHistoryId: Number(r.id || r.changeHistoryId || r.mpListId || 0),
        isApplicable: true,
        reason: "",
      })),
      ...notApplicableRows.map((r) => ({
        changeHistoryId: Number(r.id || r.changeHistoryId || r.mpListId || 0),
        isApplicable: false,
        reason: r.nonImplReason || "",
      })),
    ];

    const payload = {
      id: 0,
      processId: selectedProcessId ? Number(selectedProcessId) : 0,
      equipmentTypeId: selectedEquipmentTypeId ? Number(selectedEquipmentTypeId) : 0,
      changeDataList,
    };

    if (isStaticDataMode) {
      setSavingAll(false);
      setIsDirty(false);
      setShowSaveModal(false);
      setOperationStatus({
        isVisible: true,
        status: "success",
        message: `${changeDataList.length} ${t("toast.rowsSavedSuccess", "개 행이 성공적으로 저장되었습니다.")}`,
        autoClose: true,
      });
      onUpload?.("change_rows", payload);
      return;
    }

    APIcallPost(pocEndPoints.SAVE_MP_VERSION, payload, {}, (responseData, status) => {
      setSavingAll(false);
      if (status >= 200 && status < 300) {
        setIsDirty(false);
        setShowSaveModal(false);
        fetchMPList();
        setOperationStatus({
          isVisible: true,
          status: "success",
          message: `${changeDataList.length} ${t("toast.rowsSavedSuccess", "개 행이 성공적으로 저장되었습니다.")}`,
          autoClose: true,
        });
        onUpload?.("change_rows", payload);
      } else {
        console.error("SaveMPVersion failed:", status, responseData);
        setOperationStatus({
          isVisible: true,
          status: "error",
          message: t("toast.saveError", "저장에 실패했습니다."),
          autoClose: true,
        });
      }
    });
  }, [
    applicableRows,
    notApplicableRows,
    selectedProcessId,
    selectedEquipmentTypeId,
    onUpload,
    fetchMPList,
    t,
  ]);

  // ── Export filtered view ──────────────────────────────────────────────────
  const prepareExportData = () => {
    if (filtered.length === 0) {
      return null;
    }
    const exportData = filtered.map((row) => {
      const out = {};
      TABLE_COLUMNS.forEach((col) => {
        out[columnLabel(col, t)] = getColValue(row, col) ?? "";
      });
      return out;
    });
    const headerCols = TABLE_COLUMNS.map((c) => columnLabel(c, t));
    return { exportData, headerCols };
  };

  const handleExportCsv = () => {
    const prepared = prepareExportData();
    if (!prepared) {
      setOperationStatus({
        isVisible: true,
        status: "error",
        message: t("toast.noRecordsExport", "내보낼 데이터가 없습니다."),
        autoClose: true,
      });
      return;
    }
    try {
      const { exportData, headerCols } = prepared;
      const ws = XLSX.utils.json_to_sheet(exportData, { header: headerCols });
      const csvContent = "\uFEFF" + XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "mp-list.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setOperationStatus({
        isVisible: true,
        status: "success",
        message: `${filtered.length} ${t("toast.exportSuccess", "개 행 내보내기 완료.")}`,
        autoClose: true,
      });
      onExport?.();
    } catch (e) {
      console.error(e);
      setOperationStatus({
        isVisible: true,
        status: "error",
        message: t("toast.exportFailed", "내보내기에 실패했습니다."),
        autoClose: true,
      });
    }
  };

  const handleExportExcel = () => {
    const prepared = prepareExportData();
    if (!prepared) {
      setOperationStatus({
        isVisible: true,
        status: "error",
        message: t("toast.noRecordsExport", "내보낼 데이터가 없습니다."),
        autoClose: true,
      });
      return;
    }
    try {
      const { exportData, headerCols } = prepared;
      const ws = XLSX.utils.json_to_sheet(exportData, { header: headerCols });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "MP List");
      XLSX.writeFile(wb, "mp-list.xlsx");

      setOperationStatus({
        isVisible: true,
        status: "success",
        message: `${filtered.length} ${t("toast.exportSuccess", "개 행 내보내기 완료.")}`,
        autoClose: true,
      });
      onExport?.();
    } catch (e) {
      console.error(e);
      setOperationStatus({
        isVisible: true,
        status: "error",
        message: t("toast.exportFailed", "내보내기에 실패했습니다."),
        autoClose: true,
      });
    }
  };

  const handleExportZip = async () => {
    const prepared = prepareExportData();
    if (!prepared) {
      setOperationStatus({
        isVisible: true,
        status: "error",
        message: t("toast.noRecordsExport", "내보낼 데이터가 없습니다."),
        autoClose: true,
      });
      return;
    }
    try {
      const { exportData, headerCols } = prepared;
      const ws = XLSX.utils.json_to_sheet(exportData, { header: headerCols });
      const csvContent = "\uFEFF" + XLSX.utils.sheet_to_csv(ws);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "MP List");
      const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });

      const zip = new JSZip();
      zip.file("mp-list.csv", csvContent);
      zip.file("mp-list.xlsx", excelBuffer);
      const zipBlob = await zip.generateAsync({ type: "blob" });

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "mp-list.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setOperationStatus({
        isVisible: true,
        status: "success",
        message: `${filtered.length} ${t("toast.exportSuccess", "개 행 내보내기 완료.")}`,
        autoClose: true,
      });
      onExport?.();
    } catch (e) {
      console.error(e);
      setOperationStatus({
        isVisible: true,
        status: "error",
        message: t("toast.exportFailed", "내보내기에 실패했습니다."),
        autoClose: true,
      });
    }
  };

  const setField = (key, val) => {
    setNewRow((prev) => ({ ...prev, [key]: val }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const handleRowClick = useCallback(
    (row) => {
      if (!onOpenDetail) return;

      const rowId = Number(row?.id || row?.changeHistoryId || row?.mpListId || 0);

      if (isStaticDataMode || !rowId || rowId <= 0) {
        onOpenDetail(row);
        return;
      }

      setOperationStatus({
        isVisible: true,
        status: "loading",
        message: t("toast.loadingDetail", "Loading details..."),
        autoClose: false,
      });

      APIcallGet(`${pocEndPoints.GET_MATRIX_DATA}?Id=${rowId}`, {}, (responseData, status) => {
        if (status === 200 && responseData) {
          const raw = responseData?.data ?? responseData;
          const detail = Array.isArray(raw) ? raw[0] : raw;
          const merged = detail ? { ...row, ...detail } : row;
          onOpenDetail(merged);
          setOperationStatus({
            isVisible: false,
            status: "loading",
            message: "",
            autoClose: true,
          });
        } else {
          console.warn("[MPList] GetMatrixData failed:", status, responseData);
          onOpenDetail(row);
          setOperationStatus({
            isVisible: false,
            status: "loading",
            message: "",
            autoClose: true,
          });
        }
      });
    },
    [onOpenDetail, t],
  );
  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes shimmer {
          0%   { background-position:  200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(-10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }
        .mp-row-pending { background: #f0fdf4 !important; border-left: 3px solid #16a34a; }
        .mp-row-clickable { cursor: pointer; }
        .mp-row-selected { background: var(--fill-active, #ddeaff) !important; }
        .mp-page {
          color: var(--ref-text-primary, #0f172a);
          display: flex;
          flex-direction: column;
          flex: 1 1 0%;
          min-height: 0;
        }
        .mp-page-header {
          margin-bottom: 20px;
          position: relative;
          z-index: 100;
        }
        .mp-page-title {
          color: var(--ref-text-primary, #0f172a);
          font-size: 22px;
          font-weight: 700;
          line-height: 1.2;
        }
        .mp-page-subtitle {
          margin-top: 4px;
          color: #64748b;
          font-size: 13px;
          font-weight: 400;
        }
        .mp-filter-card {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 12px 18px;
          min-height: 70px;
          margin-bottom: 16px;
          padding: 16px 20px;
          position: relative;
          z-index: 10;
        }
        .mp-filter-item {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .mp-filter-item label {
          color: #4b5563;
          font-size: 14px;
          font-weight: 500;
          white-space: nowrap;
        }
        .mp-filter-item .input-base {
          margin-top: 0;
          height: 38px;
        }
        .mp-filter-alert {
          width: 100%;
        }
        .mp-table-card {
          min-height: 300px;
          border-radius: 16px;
        }
        .mp-table-scroll {
          flex: 1 1 0%;
          min-height: 0;
        }
        .user-row { background: rgba(6, 182, 212, 0.04) !important; }
        .user-row:hover td { background: rgba(6, 182, 212, 0.08) !important; }
        .mp-wo-link {
          color: var(--brand-60, #0f62fe);
          cursor: pointer;
          text-decoration: underline dotted;
          text-underline-offset: 3px;
        }
        .mp-wo-link:hover {
          color: var(--brand-70, #0043ce);
          text-decoration: underline;
        }
        [data-theme="dark"] .mp-wo-link {
          color: var(--brand-30, #90b5ff);
        }
        [data-theme="dark"] .mp-wo-link:hover {
          color: var(--brand-40, #6ea6ff);
        }
        .mp-inline-select {
          width: 100%;
          min-width: 60px;
          padding: 2px 6px;
          border: 1px solid var(--border-base, #e6e9ef);
          border-radius: 6px;
          font-size: 11px;
          background: var(--surface-default, #ffffff);
          color: var(--text-default, #111827);
          cursor: pointer;
          outline: none;
          height: 24px;
        }
        .mp-inline-select:focus {
          border-color: var(--brand-60, #0f62fe);
          box-shadow: 0 0 0 2px rgba(15, 98, 254, 0.15);
        }
        [data-theme="dark"] .mp-inline-select {
          border-color: var(--border-base, #334155);
          background: var(--surface-default, #1e293b);
          color: var(--text-default, #f1f5f9);
        }
        .mp-del-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border-radius: 6px;
          border: none;
          cursor: pointer;
          background: transparent;
          color: var(--text-subtlest, #7e8a9e);
          transition: all 0.2s;
          font-size: 11px;
        }
        .mp-del-btn:hover {
          background: #fef2f2;
          color: var(--danger, #dc2626);
        }
        .user-badge {
          display: inline-flex;
          align-items: center;
          padding: 1px 6px;
          border-radius: 10px;
          font-size: 9px;
          font-weight: 700;
          background-color: var(--accent-soft, #ecfeff);
          color: var(--accent, #0891b2);
          margin-left: 4px;
          vertical-align: middle;
        }
      `}</style>

      <section className="mp-page">
        {/* ── Page header ── */}
        <header className="mp-page-header flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="page-title flex items-center gap-2.5">
              <i className="fas fa-clipboard-list text-[#1745c2] text-xl md:text-[22px]" />
              <span>{t("page.mp.title", "MP List 조회")}</span>
            </h1>
            <p className="page-subtitle">
              {t("page.mp.desc", "보전파트별 대표 작업명을 최신순으로 조회합니다.")}
              {isDirty && (
                <span style={{ color: "#16a34a", fontWeight: 600, marginLeft: "8px" }}>
                  {t(
                    "page.mp.pending",
                    "저장되지 않은 변경사항이 있습니다. 저장하기를 눌러주세요.",
                  )}
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Row Count Badge */}
            <span className="inline-flex items-center px-3 py-1 text-xs font-bold text-[#1745c2] bg-[#eff4ff] border border-[#bfdbfe] rounded-full shrink-0">
              {filtered?.length || 0} {t("app.cases", "cases")}
            </span>

            {/* + VoC 추가 Button */}
            <button
              type="button"
              className="btn-base btn-secondary text-[13px] px-3.5 h-[36px] rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
              onClick={() => {
                if (!selectedProcessId) {
                  setOperationStatus({
                    isVisible: true,
                    status: "warning",
                    message: `${t("field.process")} ${t("app.search")}`,
                    autoClose: true,
                  });
                  return;
                }
                setNewRow({
                  ...EMPTY_ROW,
                  workedOn: new Date().toISOString().slice(0, 10),
                });
                setEditingRowLocalId(null);
                setModalError("");
                setErrors({});
                setShowModal(true);
              }}
            >
              <i className="fas fa-plus text-xs" />
              <span>{t("page.mp.addVoc", "VoC 추가")}</span>
            </button>

            {/* Hidden File Input for Batch Import */}
            <input
              ref={batchFileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setBatchModalError("");
                if (file.size > 5 * 1024 * 1024) {
                  setBatchModalError(t("mp.fileSizeLimit", "Up to 5MB, supports only CSV format"));
                  return;
                }
                const reader = new FileReader();
                reader.onload = (evt) => {
                  try {
                    const bstr = evt.target.result;
                    const wb = XLSX.read(bstr, { type: "binary" });
                    const wsname = wb.SheetNames[0];
                    const ws = wb.Sheets[wsname];
                    const rawData = XLSX.utils.sheet_to_json(ws);
                    if (rawData && rawData.length > 0) {
                      const selProcess = processList.find((p) => p.id === selectedProcessId);
                      const procName = selProcess?.processName || "03.성형";

                      const newItems = rawData.map((row, idx) => ({
                        ...EMPTY_ROW,
                        id: 0,
                        _localId: `imported-${Date.now()}-${idx}`,
                        _pending: true,
                        is_voc: true,
                        isVoc: true,
                        is_user: true,
                        process: procName,
                        maintGroup: "",
                        site: row["Corporation"] || row["법인"] || row["site"] || "A3.부산",
                        representativeWork:
                          row["Main Work Name"] ||
                          row["대표작업명"] ||
                          row["대표 작업명"] ||
                          row["representativeWork"] ||
                          "",
                        work:
                          row["Purpose"] ||
                          row["작업목적"] ||
                          row["작업 목적"] ||
                          row["purpose"] ||
                          "",
                        situation: row["Symptom"] || row["문제현상"] || row["symptom"] || "",
                        cause: row["Cause"] || row["문제원인"] || row["cause"] || "",
                        bom: row["BOM"] || row["bom"] || "",
                        sparePart: row["Material"] || row["자재명"] || row["sparePart"] || "",
                        hwAsWas: row["HW변경전"] || row["HW 변경 전"] || row["hwBefore"] || "",
                        hwAsIs: row["HW변경후"] || row["HW 변경 후"] || row["hwAfter"] || "",
                        swAsWas: row["SW변경전"] || row["SW 변경 전"] || row["swBefore"] || "",
                        swAsIs: row["SW변경후"] || row["SW 변경 후"] || row["swAfter"] || "",
                        workedOn:
                          row["Work Completion Date"] ||
                          row["작업완료일"] ||
                          row["workedOn"] ||
                          new Date().toISOString().slice(0, 10),
                        priority: row["Importance"] || row["중요도"] || row["priority"] || "일반",
                        category:
                          row["Effect Type"] ||
                          row["효과유형"] ||
                          row["효과 유형"] ||
                          row["category"] ||
                          "기타",
                      }));
                      setBatchParsedRows(newItems);
                    }
                  } catch (err) {
                    console.error("Batch import error:", err);
                    setBatchModalError(
                      t("mp.importError", "CSV 파일을 읽는 도중 오류가 발생했습니다."),
                    );
                  }
                };
                reader.readAsBinaryString(file);
                e.target.value = "";
              }}
            />

            {/* VoC 일괄 추가 Button */}
            <button
              type="button"
              className="btn-base btn-secondary text-[13px] px-3.5 h-[36px] rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
              onClick={() => {
                setBatchModalError("");
                setShowBatchModal(true);
              }}
            >
              <i className="fas fa-file-import text-xs" />
              <span>{t("page.mp.batchAddVoc", "VoC 일괄 추가")}</span>
            </button>

            {/* MP List 저장 Button */}
            <button
              type="button"
              className="btn-base btn-secondary text-[13px] px-3.5 h-[36px] rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => {
                const initialApplicable = [...filtered];
                setApplicableRows(initialApplicable);
                setNotApplicableRows([]);
                setShowSaveModal(true);
              }}
              disabled={savingAll || filtered.length === 0}
              title={
                !isDirty ? t("app.noData", "저장할 변경사항이 없습니다.") : t("app.save", "저장")
              }
            >
              {savingAll ? (
                <>
                  <i className="fas fa-spinner fa-spin text-xs" />
                  <span>{t("app.saving", "저장 중...")}</span>
                </>
              ) : (
                <>
                  <i className="fas fa-save text-xs" />
                  <span>{t("page.mp.saveMpList", "MP List 저장")}</span>
                </>
              )}
            </button>

            {/* 내보내기 Dropdown */}
            <ExportDropdown
              onExportCsv={handleExportCsv}
              onExportExcel={handleExportExcel}
              onExportZip={handleExportZip}
            />
          </div>
        </header>

        {/* ── Filter card ── */}
        <div className="card mp-filter-card">
          {filterError && (
            <div
              className="mp-filter-alert p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-start gap-2"
              role="alert"
            >
              <i className="fas fa-exclamation-circle mt-0.5 flex-shrink-0" />
              <div>{filterError}</div>
            </div>
          )}

          {/* Process Filter */}
          <div className="mp-filter-item">
            <label>{t("field.process", "공정")}</label>
            {filterLoading ? (
              <SelectSkeleton width="110px" />
            ) : (
              <select
                className="input-base"
                value={selectedProcessId ?? ""}
                onChange={handleProcessChange}
                style={{ width: "110px" }}
              >
                <option value="">{t("app.all", "전체")}</option>
                {processList.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.processName}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Equipment Type Filter */}
          <div className="mp-filter-item">
            <label>{t("field.maintenanceType", "Equipment Type")}</label>
            {filterLoading ? (
              <SelectSkeleton width="160px" />
            ) : (
              <select
                className="input-base"
                value={selectedEquipmentTypeId ?? ""}
                onChange={(e) =>
                  setSelectedEquipmentTypeId(e.target.value === "" ? null : Number(e.target.value))
                }
                style={{ width: "160px" }}
              >
                <option value="">{t("app.all", "All")}</option>
                {equipmentTypeList.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.equipmentTypeName}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Site Filter */}
          <div className="mp-filter-item">
            <label>{t("field.site", "Site")}</label>
            {filterLoading ? (
              <SelectSkeleton width="120px" />
            ) : (
              <select
                className="input-base"
                value={selectedSiteId ?? ""}
                onChange={(e) =>
                  setSelectedSiteId(e.target.value === "" ? null : Number(e.target.value))
                }
                style={{ width: "120px" }}
              >
                <option value="">{t("app.all", "All")}</option>
                {siteList.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.siteName}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* WO Type Filter */}
          <div className="mp-filter-item">
            <label>{t("field.woType", "WO Type")}</label>
            {filterLoading ? (
              <SelectSkeleton width="160px" />
            ) : (
              <select
                className="input-base"
                value={selectedWoType}
                onChange={(e) => setSelectedWoType(e.target.value)}
                style={{ width: "160px" }}
              >
                <option value="전체">{t("app.all", "All")}</option>
                {woTypeOptions.map((name, idx) => (
                  <option key={idx} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Priority Filter (Multi-select) */}
          <div className="mp-filter-item">
            <label>
              {t("field.priority", "중요도")} <span className="text-red-500">*</span>
            </label>
            {filterLoading ? (
              <SelectSkeleton width="120px" />
            ) : (
              <div style={{ width: "120px" }}>
                <MultiSelect
                  options={priorityOptions}
                  selectedValues={selectedPriorities}
                  onChange={setSelectedPriorities}
                  placeholder={t("app.all", "전체")}
                  t={t}
                />
              </div>
            )}
          </div>

          {/* Category Filter (Multi-select) */}
          <div className="mp-filter-item">
            <label>{t("field.category", "효과 유형")}</label>
            {filterLoading ? (
              <SelectSkeleton width="140px" />
            ) : (
              <div style={{ width: "140px" }}>
                <MultiSelect
                  options={categoryOptions}
                  selectedValues={selectedCategories}
                  onChange={setSelectedCategories}
                  placeholder={t("app.all", "전체")}
                  t={t}
                />
              </div>
            )}
          </div>

          {/* Period Filter */}
          <div className="mp-filter-item ml-auto">
            <label>{t("field.period", "기간")}</label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                className="input-base"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                style={{ width: "150px" }}
              />
              <span className="text-text-subtle">~</span>
              <input
                type="date"
                className="input-base"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                style={{ width: "150px" }}
              />
              {(dateFrom || dateTo) && (
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

        {/* ── Table or Empty Landing state ── */}
        <div className="card mp-table-card flex-1 min-h-0 flex flex-col overflow-hidden">
          {selectedProcessId === null ? (
            <div className="flex-grow flex flex-col items-center justify-center gap-4 p-10 text-center">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#eff4ff] text-[#1745c2] text-4xl">
                <i className="fas fa-clipboard-list" />
              </div>
              <h2 className="text-xl font-bold text-gray-800">
                {t("landing.selectProcessAndMaint")}
              </h2>
              <p className="text-sm text-gray-400 max-w-md">
                {t("landing.selectProcessAndMaintMPDesc")}
              </p>
            </div>
          ) : dataLoading || isFiltering ? (
            <TableSkeleton rows={6} t={t} />
          ) : (
            <div className="mp-table-scroll overflow-auto border border-border-base dark:border-gray-700 rounded-xl shadow-2xs">
              <table
                className="min-w-full text-left text-sm"
                style={{ tableLayout: "fixed", width: "100%", minWidth: "1280px" }}
              >
                <colgroup>
                  <col style={{ width: "3%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "6%" }} />
                  <col style={{ width: "6%" }} />
                  <col style={{ width: "6%" }} />
                  <col style={{ width: "6%" }} />
                  <col style={{ width: "5%" }} />
                  <col style={{ width: "5%" }} />
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "8%" }} />
                </colgroup>
                <thead className="table-header" style={{ position: "sticky", top: 0, zIndex: 1 }}>
                  <tr>
                    <th
                      className="border-b border-border-base dark:border-gray-700/60 text-center px-1 py-2"
                      style={{ textAlign: "center" }}
                    ></th>
                    {TABLE_COLUMNS.map((col) => (
                      <SortableTh
                        key={col}
                        columnKey={col}
                        label={columnLabel(col, t)}
                        sortConfig={sortConfig}
                        onSort={handleSort}
                      />
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td
                        colSpan={TABLE_COLUMNS.length + 1}
                        className="text-center py-10 text-text-subtle text-sm"
                      >
                        {t("empty.noMatch", "조건에 맞는 데이터가 없습니다.")}
                      </td>
                    </tr>
                  ) : (
                    paginatedData.map((row, index) => {
                      const isVoc =
                        row.is_voc === true ||
                        row.isVoc === true ||
                        row.is_voc === "true" ||
                        row.isVoc === "true" ||
                        !!row._pending;
                      const isPending = !!row._pending;
                      const currentUserName = getUserInfo()?.name || "admin";
                      const isUser =
                        (row.created_by ?? row.createdBy ?? "") === currentUserName &&
                        !row.work_order_id;
                      const detailKey = rowKey(row, index);
                      const isSelected = isRowSelected(row, drawerItem);

                      const rowBgClass = isSelected
                        ? "bg-[#ddeaff] dark:bg-blue-900/60"
                        : isPending
                          ? "bg-[#f0fdf4]"
                          : isVoc
                            ? "bg-[#e8f2ff] dark:bg-blue-950/40 hover:bg-[#dbe9fe] dark:hover:bg-blue-900/50"
                            : "bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/60";

                      return (
                        <tr
                          key={detailKey}
                          role="button"
                          tabIndex={0}
                          aria-selected={isSelected}
                          onClick={() => handleRowClick(row)}
                          onDoubleClick={() => handleRowDoubleClick(row)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              handleRowClick(row);
                            }
                          }}
                          className={`mp-row-clickable border-t border-border-base transition-colors ${rowBgClass}${isSelected ? " mp-row-selected" : ""}`}
                        >
                          <td className="text-center px-1 py-2">
                            {isVoc && (
                              <button
                                type="button"
                                className="mp-del-btn text-gray-400 hover:text-red-500 transition-colors p-1 cursor-pointer"
                                onClick={(e) => handleDeleteRow(e, row)}
                                title={t("app.delete", "삭제")}
                              >
                                <i className="fas fa-trash-alt text-xs" />
                              </button>
                            )}
                          </td>
                          {TABLE_COLUMNS.map((col) => {
                            if (col === "photos") {
                              const photoList =
                                row.photos ||
                                row.attachments ||
                                (row.samplePhoto ? [row.samplePhoto] : []);
                              const photoCount =
                                Array.isArray(photoList) && photoList.length > 0
                                  ? photoList.length
                                  : row.photoCount ||
                                    row.attachmentCount ||
                                    (row.wOCode === "WC09114213" ||
                                    row.woCode === "WC09114213" ||
                                    row.samplePhoto
                                      ? 1
                                      : 0);

                              return (
                                <td key={col} className="px-3 py-2 text-center whitespace-nowrap">
                                  {photoCount > 0 ? (
                                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/40 px-2 py-0.5 rounded-full border border-teal-200 dark:border-teal-800">
                                      <i className="fas fa-camera text-[11px]" />
                                      <span>{String(photoCount).padStart(2, "0")}</span>
                                    </span>
                                  ) : (
                                    <span className="text-gray-300 dark:text-gray-600 text-xs">
                                      —
                                    </span>
                                  )}
                                </td>
                              );
                            }
                            if (col === "priority") {
                              const val = getColValue(row, "priority") || "일반";
                              return (
                                <td key={col} className="px-3 py-2">
                                  <select
                                    className="mp-inline-select"
                                    value={val}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) =>
                                      handleInlineChange(row, "priority", e.target.value)
                                    }
                                  >
                                    <option value="중요">{t("priority.high", "중요")}</option>
                                    <option value="일반">{t("priority.normal", "일반")}</option>
                                  </select>
                                </td>
                              );
                            }
                            if (col === "category") {
                              const val = getColValue(row, "category") || "기타";
                              return (
                                <td key={col} className="px-3 py-2">
                                  <select
                                    className="mp-inline-select"
                                    value={val}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) =>
                                      handleInlineChange(row, "category", e.target.value)
                                    }
                                  >
                                    <option value="생산성">
                                      {t("category.productivity", "생산성")}
                                    </option>
                                    <option value="품질">{t("category.quality", "품질")}</option>
                                    <option value="보전성">
                                      {t("category.maintenance", "보전성")}
                                    </option>
                                    <option value="기타">{t("category.etc", "기타")}</option>
                                  </select>
                                </td>
                              );
                            }
                            if (col === "wOCode") {
                              const val = getColValue(row, "wOCode");
                              return (
                                <td
                                  key={col}
                                  className="px-3 py-2 text-text-subtle text-xs"
                                  style={{
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {val && val !== "—" ? (
                                    <span
                                      className="mp-wo-link"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRowClick(row);
                                      }}
                                    >
                                      {val}
                                    </span>
                                  ) : (
                                    "—"
                                  )}
                                </td>
                              );
                            }
                            if (col === "workedOn") {
                              return (
                                <td
                                  key={col}
                                  className="px-3 py-2 text-text-subtle whitespace-nowrap text-xs"
                                >
                                  {formatWorkedOn(getColValue(row, "workedOn"))}
                                </td>
                              );
                            }
                            if (col === "createdAt") {
                              const rawDate = getColValue(row, "createdAt");
                              const formatted = rawDate ? formatWorkedOn(rawDate) : "";
                              return (
                                <td
                                  key={col}
                                  className="px-3 py-2 text-text-subtle whitespace-nowrap text-xs"
                                >
                                  {formatted || "—"}
                                </td>
                              );
                            }
                            if (col === "representativeWork") {
                              const val = getColValue(row, "representativeWork");
                              return (
                                <td
                                  key={col}
                                  className="px-3 py-2 text-text-subtle text-xs"
                                  style={{
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    maxWidth: "180px",
                                  }}
                                  title={String(val ?? "")}
                                >
                                  {val === null || val === "" ? "—" : String(val)}
                                  {isUser && (
                                    <span className="user-badge">{t("app.userRow", "사용자")}</span>
                                  )}
                                </td>
                              );
                            }
                            const val = getColValue(row, col);
                            return (
                              <td
                                key={col}
                                className="px-3 py-2 text-text-subtle text-xs"
                                style={{
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  maxWidth: "180px",
                                }}
                                title={String(val ?? "")}
                              >
                                {val === null || val === "" ? "—" : String(val)}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })
                  )}
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

      {/* ── Add/Edit row modal ── */}
      <Modal
        open={showModal}
        title={
          editingRowLocalId !== null
            ? t("page.mp.modalEditTitle", "MP List 행 수정")
            : t("page.mp.modalTitle", "Add MP List Row")
        }
        description={
          editingRowLocalId !== null
            ? t("page.mp.modalEditDesc", "항목 정보를 수정합니다.")
            : t(
                "page.mp.modalDesc",
                "Add new items. The W/O code is automatically emptied and separated from system data.",
              )
        }
        onClose={() => {
          setShowModal(false);
          setEditingRowLocalId(null);
          setErrors({});
        }}
        titleIcon={
          <span className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
            <i className={`fas ${editingRowLocalId !== null ? "fa-edit" : "fa-plus"}`} />
          </span>
        }
        maxWidth="680px"
        footer={
          <button
            type="button"
            className="bg-[#1745c2] hover:bg-[#1239a5] text-white font-semibold py-3 px-8 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer text-sm w-[60%] sm:w-[220px]"
            onClick={handleModalAdd}
          >
            <i className="fas fa-check text-xs" />
            {editingRowLocalId !== null ? t("app.edit", "수정하기") : t("page.mp.addButton", "Add")}
          </button>
        }
      >
        <div className="space-y-3.5">
          {/* Row 1: Fairness (Process) and Conservation Part (Maintenance Part) in read-only mode */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-text-subtle mb-1 block">
                {t("field.process", "Fairness")}
              </label>
              <input
                type="text"
                className="w-full p-2.5 rounded-xl border border-border-base bg-gray-50 dark:bg-gray-800/60 text-gray-500 font-medium cursor-not-allowed text-xs"
                value={
                  processList.find((p) => p.id === selectedProcessId)?.processName || "02.배치"
                }
                disabled
                readOnly
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-text-subtle mb-1 block">
                {t("field.equipmentType", "Conservation Part")}
              </label>
              <input
                type="text"
                className="w-full p-2.5 rounded-xl border border-border-base bg-gray-50 dark:bg-gray-800/60 text-gray-500 font-medium cursor-not-allowed text-xs"
                value={
                  equipmentTypeList.find((e) => e.id === selectedEquipmentTypeId)
                    ?.equipmentTypeName || ""
                }
                disabled
                readOnly
              />
            </div>
          </div>

          {/* Row 2: Representative Work Name * (Full width) */}
          <div>
            <label className="text-xs font-semibold text-text-subtle mb-1 block">
              {t("field.repWork", "Representative Work Name")}{" "}
              <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="w-full p-2.5 rounded-xl border border-border-base bg-surface-default text-gray-800 dark:text-gray-100 text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              value={newRow.representativeWork}
              onChange={(e) => setField("representativeWork", e.target.value)}
              placeholder={t("placeholder.representativeWorkInput", "Enter the main job name")}
              style={{
                borderColor: errors.representativeWork
                  ? "var(--color-text-danger, #dc2626)"
                  : undefined,
                borderWidth: errors.representativeWork ? "1.5px" : undefined,
              }}
            />
            {errors.representativeWork && (
              <span className="mt-1 block text-[11px] font-semibold text-red-500 animate-fade-in">
                <i className="fas fa-exclamation-circle mr-1" />
                {errors.representativeWork}
              </span>
            )}
          </div>

          {/* Row 3: Purpose of the Work (Full width) */}
          <div>
            <label className="text-xs font-semibold text-text-subtle mb-1 block">
              {t("field.work", "Purpose of the Work")}
            </label>
            <input
              type="text"
              className="w-full p-2.5 rounded-xl border border-border-base bg-surface-default text-gray-800 dark:text-gray-100 text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              value={newRow.work}
              onChange={(e) => setField("work", e.target.value)}
              placeholder={t("placeholder.workPurposeInput", "Enter the purpose of the work")}
            />
          </div>

          {/* Row 4: Problem phenomenon * and Cause of the problem */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-text-subtle mb-1 block">
                {t("field.situation", "Problem phenomenon")} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="w-full p-2.5 rounded-xl border border-border-base bg-surface-default text-gray-800 dark:text-gray-100 text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                value={newRow.situation}
                onChange={(e) => setField("situation", e.target.value)}
                placeholder={t("placeholder.situationInput", "Problem Phenomenon Input")}
                style={{
                  borderColor: errors.situation ? "var(--color-text-danger, #dc2626)" : undefined,
                  borderWidth: errors.situation ? "1.5px" : undefined,
                }}
              />
              {errors.situation && (
                <span className="mt-1 block text-[11px] font-semibold text-red-500 animate-fade-in">
                  <i className="fas fa-exclamation-circle mr-1" />
                  {errors.situation}
                </span>
              )}
            </div>
            <div>
              <label className="text-xs font-semibold text-text-subtle mb-1 block">
                {t("field.cause", "Cause of the problem")}
              </label>
              <input
                type="text"
                className="w-full p-2.5 rounded-xl border border-border-base bg-surface-default text-gray-800 dark:text-gray-100 text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                value={newRow.cause}
                onChange={(e) => setField("cause", e.target.value)}
                placeholder={t("placeholder.causeInput", "Enter the cause of the problem")}
              />
            </div>
          </div>

          {/* Row 5: BOM and Material Name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-text-subtle mb-1 block">
                {t("field.bom", "BOM")}
              </label>
              <input
                type="text"
                className="w-full p-2.5 rounded-xl border border-border-base bg-surface-default text-gray-800 dark:text-gray-100 text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                value={newRow.bom}
                onChange={(e) => setField("bom", e.target.value)}
                placeholder={t("placeholder.bomInput", "BOM Entry")}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-text-subtle mb-1 block">
                {t("field.sparePart", "Material Name")}
              </label>
              <input
                type="text"
                className="w-full p-2.5 rounded-xl border border-border-base bg-surface-default text-gray-800 dark:text-gray-100 text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                value={newRow.sparePart}
                onChange={(e) => setField("sparePart", e.target.value)}
                placeholder={t("placeholder.sparePartInput", "Enter material name")}
              />
            </div>
          </div>

          {/* Row 6: Before changing the hardware and After changing the hardware */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-text-subtle mb-1 block">
                {t("field.hwBefore", "Before changing the hardware")}
              </label>
              <input
                type="text"
                className="w-full p-2.5 rounded-xl border border-border-base bg-surface-default text-gray-800 dark:text-gray-100 text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                value={newRow.hwAsWas}
                onChange={(e) => setField("hwAsWas", e.target.value)}
                placeholder={t("placeholder.hwBefore", "Before changing the hardware")}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-text-subtle mb-1 block">
                {t("field.hwAfter", "After changing the hardware")}
              </label>
              <input
                type="text"
                className="w-full p-2.5 rounded-xl border border-border-base bg-surface-default text-gray-800 dark:text-gray-100 text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                value={newRow.hwAsIs}
                onChange={(e) => setField("hwAsIs", e.target.value)}
                placeholder={t("placeholder.hwAfter", "After changing the hardware")}
              />
            </div>
          </div>

          {/* Row 7: Before Software Change and After the software change */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-text-subtle mb-1 block">
                {t("field.swBefore", "Before Software Change")}
              </label>
              <input
                type="text"
                className="w-full p-2.5 rounded-xl border border-border-base bg-surface-default text-gray-800 dark:text-gray-100 text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                value={newRow.swAsWas}
                onChange={(e) => setField("swAsWas", e.target.value)}
                placeholder={t("placeholder.swBefore", "Before Software Change")}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-text-subtle mb-1 block">
                {t("field.swAfter", "After the software change")}
              </label>
              <input
                type="text"
                className="w-full p-2.5 rounded-xl border border-border-base bg-surface-default text-gray-800 dark:text-gray-100 text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                value={newRow.swAsIs}
                onChange={(e) => setField("swAsIs", e.target.value)}
                placeholder={t("placeholder.swAfter", "After the software change")}
              />
            </div>
          </div>

          {/* Row 8: Importance and Types of effects */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-text-subtle mb-1 block">
                {t("field.priority", "Importance")}
              </label>
              <select
                className="w-full p-2.5 rounded-xl border border-border-base bg-surface-default text-gray-800 dark:text-gray-100 text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all cursor-pointer"
                value={newRow.priority || "중요"}
                onChange={(e) => setField("priority", e.target.value)}
              >
                <option value="중요">{t("priority.high", "Important")}</option>
                <option value="일반">{t("priority.normal", "Normal")}</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-text-subtle mb-1 block">
                {t("field.category", "Types of effects")}
              </label>
              <select
                className="w-full p-2.5 rounded-xl border border-border-base bg-surface-default text-gray-800 dark:text-gray-100 text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all cursor-pointer"
                value={newRow.category || "기타"}
                onChange={(e) => setField("category", e.target.value)}
              >
                <option value="기타">{t("category.etc", "Others")}</option>
                <option value="생산성">{t("category.productivity", "Productivity")}</option>
                <option value="품질">{t("category.quality", "Quality")}</option>
                <option value="보전성">{t("category.maintenance", "Maintenance")}</option>
              </select>
            </div>
          </div>

          {/* Row 9: Date of Completion and Requesting Corporation */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-text-subtle mb-1 block">
                {t("field.workedOn", "Date of Completion")}
              </label>
              <input
                type="date"
                className="w-full p-2.5 rounded-xl border border-border-base bg-surface-default text-gray-800 dark:text-gray-100 text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                value={newRow.workedOn}
                onChange={(e) => setField("workedOn", e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-text-subtle mb-1 block">
                {t("field.site", "Requesting Corporation")}
              </label>
              <select
                className="w-full p-2.5 rounded-xl border border-border-base bg-surface-default text-gray-800 dark:text-gray-100 text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all cursor-pointer"
                value={newRow.site}
                onChange={(e) => setField("site", e.target.value)}
              >
                <option value="">{t("site.selection", "Selection")}</option>
                {siteList.map((s) => (
                  <option key={s.id} value={s.siteName}>
                    {s.siteName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className="text-xs text-gray-400 font-medium pt-3 border-t border-gray-100 dark:border-gray-800 mt-2">
            {t("page.mp.attachNotice", "You can attach photos after saving the item")}
          </p>
        </div>
      </Modal>

      {/* ── Batch addition of VoC Modal ── */}
      {showBatchModal && (
        <div className="modal-overlay animate-fade-in" onClick={() => setShowBatchModal(false)}>
          <div
            className="modal-panel modal-panel-xl p-6 relative animate-scale-up w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Loading Overlay - shown while validating/saving */}
            {batchSaving && (
              <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm rounded-2xl">
                <div className="flex flex-col items-center gap-3">
                  <i className="fas fa-spinner fa-spin text-3xl text-[#1745c2]" />
                  <p className="text-sm font-semibold text-[#1745c2]">
                    {t("batch.validating", "Validating...")}
                  </p>
                </div>
              </div>
            )}
            {/* Modal Header */}
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 text-base shrink-0">
                  <i className="fas fa-file-import" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-text-default">
                    {t("page.mp.batchModalTitle", "Batch addition of VoC")}
                  </h3>
                  <p className="text-xs text-text-subtlest mt-0.5">
                    {t("page.mp.batchModalDesc", "Batch register VoC items as CSV files")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="w-8 h-8 rounded-lg border border-border-base flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer shrink-0"
                onClick={() => setShowBatchModal(false)}
              >
                <i className="fas fa-times text-xs" />
              </button>
            </div>

            {/* Error alert if any */}
            {batchModalError && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-600 font-medium flex items-center gap-2">
                <i className="fas fa-exclamation-circle text-sm shrink-0" />
                <span>{batchModalError}</span>
              </div>
            )}

            {/* Notice Card: Download input form first */}
            <div className="bg-gray-50/80 dark:bg-gray-700/40 border border-gray-100 dark:border-gray-700 rounded-2xl p-4 flex items-center justify-between gap-4 mb-5">
              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-white text-[10px] shrink-0 mt-0.5">
                  <i className="fas fa-info" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-text-default">
                    {t("page.mp.downloadFormTitle", "Download the input form first")}
                  </h4>
                  <p className="text-[11px] text-text-subtlest mt-0.5 leading-relaxed">
                    {t(
                      "page.mp.downloadFormDesc",
                      "Required columns: Process, Maintenance Part, Main Work Name, Work Completion Date, Importance, Effect Type, Corporation",
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const headers = [
                    "Process",
                    "Maintenance Part",
                    "Main Work Name",
                    "Work Completion Date",
                    "Importance",
                    "Effect Type",
                    "Corporation",
                  ];
                  const sampleRow = [
                    "03.성형",
                    "0307. UT Coater",
                    "3기어 펌프 교체",
                    "2024-07-30",
                    "상",
                    "품질",
                    "A1. Seoul",
                  ];
                  const csvContent =
                    "data:text/csv;charset=utf-8,\uFEFF" +
                    [headers.join(","), sampleRow.join(",")].join("\n");
                  const encodedUri = encodeURI(csvContent);
                  const link = document.createElement("a");
                  link.setAttribute("href", encodedUri);
                  link.setAttribute("download", "voc_import_template.csv");
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="bg-surface-default border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 font-bold text-xs px-3.5 py-2 rounded-xl shadow-2xs flex items-center gap-1.5 shrink-0 cursor-pointer transition-all"
              >
                <i className="fas fa-download text-xs text-gray-500" />
                <span>{t("page.mp.downloadFormBtn", "Download Form")}</span>
              </button>
            </div>

            {/* Dropzone Card: Select the CSV file */}
            <div
              className="border-2 border-dashed border-border-base rounded-2xl p-6 flex flex-col items-center justify-center text-center bg-surface-default/40 hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-all cursor-pointer mb-5"
              onClick={() => batchFileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) {
                  if (batchFileInputRef.current) {
                    const dataTransfer = new DataTransfer();
                    dataTransfer.items.add(file);
                    batchFileInputRef.current.files = dataTransfer.files;
                    batchFileInputRef.current.dispatchEvent(new Event("change", { bubbles: true }));
                  }
                }
              }}
            >
              <div className="w-10 h-10 rounded-full bg-[#1745c2] flex items-center justify-center text-white text-lg mb-2 shadow-md">
                <i className="fas fa-cloud-upload-alt" />
              </div>
              <h4 className="text-xs font-bold text-text-default">
                {t("page.mp.selectCsvTitle", "Select the CSV file")}
              </h4>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                {t("page.mp.selectCsvDesc", "Up to 5MB, supports only CSV format")}
              </p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  batchFileInputRef.current?.click();
                }}
                className="mt-3 bg-[#1745c2] hover:bg-[#1239a5] text-white font-semibold text-xs px-4 py-2 rounded-xl shadow-sm flex items-center gap-2 cursor-pointer transition-all"
              >
                <i className="fas fa-folder-open text-xs" />
                <span>{t("page.mp.fileSelectionBtn", "File selection")}</span>
              </button>
            </div>

            {/* Row Preview Table if files imported */}
            {batchParsedRows.length > 0 && (
              <div className="mb-5">
                {/* Filter Tabs: All / Duplicate / Missing */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setBatchFilter("all")}
                      className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                        batchFilter === "all"
                          ? "bg-[#1745c2] text-white shadow-sm"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                      }`}
                    >
                      {t("batch.all", "All")} ({batchParsedRows.length})
                    </button>
                    {batchDupCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setBatchFilter("duplicate")}
                        className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                          batchFilter === "duplicate"
                            ? "bg-red-500 text-white shadow-sm"
                            : "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50"
                        }`}
                      >
                        {t("batch.duplicate", "Duplicate")} ({batchDupCount})
                      </button>
                    )}
                    {batchDupCount > 0 && batchDupCount < batchParsedRows.length && (
                      <button
                        type="button"
                        onClick={() => setBatchFilter("missing")}
                        className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                          batchFilter === "missing"
                            ? "bg-emerald-500 text-white shadow-sm"
                            : "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
                        }`}
                      >
                        {t("batch.missing", "Missing")} ({batchParsedRows.length - batchDupCount})
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setBatchParsedRows([]);
                      setBatchDuplicateFlags([]);
                      setBatchFilter("all");
                    }}
                    className="text-[11px] text-red-500 hover:text-red-700 font-medium cursor-pointer"
                  >
                    {t("batch.reset", "Reset")}
                  </button>
                </div>

                {/* Duplicate warning banner */}
                {batchDupCount > 0 && (
                  <div className="mb-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg flex items-center gap-2">
                    <i className="fas fa-exclamation-triangle text-red-500 text-xs" />
                    <span className="text-[11px] font-semibold text-red-600 dark:text-red-400">
                      {batchDupCount}{" "}
                      {t("batch.duplicateFound", "duplicate record(s) found. Please review.")}
                    </span>
                  </div>
                )}

                <div className="max-h-48 overflow-y-auto border border-border-base dark:border-gray-700 rounded-xl overflow-x-auto">
                  <table
                    className="w-full text-left text-xs"
                    style={{ borderCollapse: "separate", borderSpacing: 0 }}
                  >
                    <thead className="sticky top-0 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-[10px] font-bold uppercase">
                      <tr>
                        <th className="px-2.5 py-2 w-8 text-center">#</th>
                        <th className="px-2.5 py-2">
                          {t("field.repWork", "REPRESENTATIVE WORK NAME")}
                        </th>
                        <th className="px-2.5 py-2">{t("field.purpose", "PURPOSE OF THE WORK")}</th>
                        <th className="px-2.5 py-2">
                          {t("field.hwBefore", "BEFORE CHANGING THE HARDWARE")}
                        </th>
                        <th className="px-2.5 py-2">
                          {t("field.hwAfter", "AFTER CHANGING THE HARDWARE")}
                        </th>
                        <th className="px-2.5 py-2">
                          {t("field.swBefore", "BEFORE SOFTWARE CHANGE")}
                        </th>
                        <th className="px-2.5 py-2">
                          {t("field.swAfter", "AFTER THE SOFTWARE CHANGE")}
                        </th>
                        <th className="px-2.5 py-2 text-center">
                          {t("field.priority", "IMPORTANCE")}
                        </th>
                        <th className="px-2.5 py-2 text-center">{t("field.category", "EFFECT")}</th>
                        <th className="px-2.5 py-2 text-center">
                          {t("field.workedOn", "WORK DATE")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {batchFilteredRows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={10}
                            className="px-4 py-6 text-center text-gray-400 font-medium text-xs"
                          >
                            {batchFilter === "duplicate"
                              ? t("batch.noDuplicates", "No duplicate records")
                              : batchFilter === "missing"
                                ? t("batch.noMissing", "No missing records")
                                : t("batch.noRecords", "No records")}
                          </td>
                        </tr>
                      ) : (
                        batchFilteredRows.map((r) => {
                          const origIdx = batchParsedRows.indexOf(r);
                          const isDup = batchDuplicateFlags[origIdx];
                          return (
                            <tr
                              key={`batch-row-${origIdx}`}
                              className={
                                isDup
                                  ? "bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30"
                                  : "bg-[#f0f7ff] dark:bg-blue-950/30 hover:bg-[#e4efff]"
                              }
                            >
                              <td className="px-2.5 py-1.5 text-center text-gray-400">
                                {origIdx + 1}
                                {isDup && (
                                  <i
                                    className="fas fa-exclamation-circle text-red-500 text-[9px] ml-1"
                                    title="Duplicate"
                                  />
                                )}
                              </td>
                              <td className="px-2.5 py-1.5 font-semibold max-w-[120px] truncate">
                                {r.representativeWork || "—"}
                              </td>
                              <td className="px-2.5 py-1.5 max-w-[120px] truncate">
                                {r.work || "—"}
                              </td>
                              <td className="px-2.5 py-1.5 max-w-[100px] truncate">
                                {r.hwAsWas || "—"}
                              </td>
                              <td className="px-2.5 py-1.5 max-w-[100px] truncate">
                                {r.hwAsIs || "—"}
                              </td>
                              <td className="px-2.5 py-1.5 max-w-[100px] truncate">
                                {r.swAsWas || "—"}
                              </td>
                              <td className="px-2.5 py-1.5 max-w-[100px] truncate">
                                {r.swAsIs || "—"}
                              </td>
                              <td className="px-2.5 py-1.5 text-center">{r.priority || "일반"}</td>
                              <td className="px-2.5 py-1.5 text-center">{r.category || "기타"}</td>
                              <td className="px-2.5 py-1.5 text-center whitespace-nowrap">
                                {r.workedOn || "—"}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 transition-colors cursor-pointer py-1"
                  onClick={() => {
                    setBatchParsedRows([]);
                    setBatchDuplicateFlags([]);
                    setBatchFilter("all");
                    setShowBatchModal(false);
                  }}
                >
                  {t("app.cancellation", "cancellation")}
                </button>
                {batchDupCount > 0 && (
                  <button
                    type="button"
                    onClick={handleRemoveDuplicates}
                    className="text-xs font-bold text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors cursor-pointer px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 flex items-center gap-1.5"
                  >
                    <i className="fas fa-trash-alt text-[10px]" />
                    {t("batch.removeDuplicate", "Remove Duplicate")} ({batchDupCount})
                  </button>
                )}
              </div>
              {batchParsedRows.length > 0 && (
                <button
                  type="button"
                  onClick={handleConfirmBatchAdd}
                  disabled={batchSaving}
                  className="bg-[#1745c2] hover:bg-[#1239a5] text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <i className={`fas ${batchSaving ? "fa-spinner fa-spin" : "fa-save"} text-xs`} />
                  <span>
                    {batchSaving
                      ? t("batch.validating", "Validating...")
                      : `${t("batch.save", "Save")} (${batchParsedRows.length})`}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Storing MP List Modal ── */}
      {showSaveModal && (
        <div
          className="modal-overlay animate-fade-in overflow-y-auto"
          onClick={() => setShowSaveModal(false)}
        >
          <div
            className="modal-panel modal-panel-2xl p-6 relative my-8 max-h-[90vh] flex flex-col animate-scale-up w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 mb-4 border-b border-gray-100 dark:border-gray-700 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 text-lg shrink-0">
                  <i className="fas fa-save" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-text-default">
                    {t("page.mp.storingModalTitle", "Storing MP List")}
                  </h3>
                  <p className="text-xs text-text-subtlest mt-0.5 font-medium">
                    {processList.find((p) => p.id === selectedProcessId)?.processName ||
                      "02. Placement"}{" "}
                    · {dateFrom || "2025-07-27"} ~ {dateTo || "2026-07-27"} · v1
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="w-8 h-8 rounded-xl border border-border-base flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer shrink-0"
                onClick={() => setShowSaveModal(false)}
              >
                <i className="fas fa-times text-xs" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto space-y-6 pr-1 custom-scrollbar">
              {/* Section 1: Applicable Items */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <i className="fas fa-check-circle text-emerald-500 text-sm" />
                    <h4 className="text-sm font-bold text-text-default">
                      {t("page.mp.applicableItems", "Applicable Items")}
                    </h4>
                    <span className="px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 rounded-full border border-emerald-100 dark:border-emerald-800/40">
                      {applicableRows.length} {t("app.cases", "cases")}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const toMove = applicableRows.filter(
                        (r) => r.priority !== "중요" && r.priority !== "Important",
                      );
                      const keep = applicableRows.filter(
                        (r) => r.priority === "중요" || r.priority === "Important",
                      );
                      setApplicableRows(keep);
                      setNotApplicableRows((prev) => [
                        ...prev,
                        ...toMove.map((item) => ({
                          ...item,
                          nonImplReason:
                            item.nonImplReason ||
                            t("page.mp.generalItemReason", "일반 항목 - 미적용 대상"),
                        })),
                      ]);
                    }}
                    className="border border-red-200 dark:border-red-800/50 bg-red-50/60 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100/80 font-bold text-xs px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <i className="fas fa-arrow-down text-xs" />
                    <span>{t("page.mp.notApplyingGeneral", "Not applying general items")}</span>
                  </button>
                </div>

                {/* Applicable Items Table */}
                <div className="border border-emerald-200 dark:border-emerald-800/40 rounded-2xl overflow-hidden border-l-4 border-l-emerald-500 bg-surface-default shadow-2xs">
                  <div className="max-h-60 overflow-y-auto custom-scrollbar">
                    <table
                      className="w-full text-left text-xs"
                      style={{ borderCollapse: "separate", borderSpacing: 0 }}
                    >
                      <thead className="sticky top-0 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 uppercase text-[10px] font-bold tracking-wider z-20 border-b border-border-base shadow-2xs">
                        <tr>
                          <th className="bg-gray-100 dark:bg-gray-800 px-3 py-2.5 w-8 text-center">
                            #
                          </th>
                          <th className="bg-gray-100 dark:bg-gray-800 px-3 py-2.5">
                            {t("field.repWork", "REPRESENTATIVE WORK NAME")}
                          </th>
                          <th className="bg-gray-100 dark:bg-gray-800 px-3 py-2.5">
                            {t("field.purpose", "PURPOSE OF THE WORK")}
                          </th>
                          <th className="bg-gray-100 dark:bg-gray-800 px-3 py-2.5">
                            {t("field.hwBefore", "BEFORE CHANGING THE HARDWARE")}
                          </th>
                          <th className="bg-gray-100 dark:bg-gray-800 px-3 py-2.5">
                            {t("field.hwAfter", "AFTER CHANGING THE HARDWARE")}
                          </th>
                          <th className="bg-gray-100 dark:bg-gray-800 px-3 py-2.5">
                            {t("field.swBefore", "BEFORE SOFTWARE CHANGE")}
                          </th>
                          <th className="bg-gray-100 dark:bg-gray-800 px-3 py-2.5">
                            {t("field.swAfter", "AFTER THE SOFTWARE CHANGE")}
                          </th>
                          <th className="bg-gray-100 dark:bg-gray-800 px-3 py-2.5 w-24 text-center">
                            {t("field.priority", "IMPORTANCE")}
                          </th>
                          <th className="bg-gray-100 dark:bg-gray-800 px-3 py-2.5 w-24 text-center">
                            {t("field.category", "EFFECT")}
                          </th>
                          <th className="bg-gray-100 dark:bg-gray-800 px-3 py-2.5 w-12 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                        {applicableRows.length === 0 ? (
                          <tr>
                            <td
                              colSpan={10}
                              className="px-4 py-8 text-center text-gray-400 font-medium"
                            >
                              {t("page.mp.noApplicable", "No applicable items")}
                            </td>
                          </tr>
                        ) : (
                          applicableRows.map((row, idx) => (
                            <tr
                              key={`app-${idx}`}
                              className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors"
                            >
                              <td className="px-3 py-2 text-center text-gray-400 font-medium">
                                {idx + 1}
                              </td>
                              <td className="px-3 py-2 font-semibold text-text-default max-w-[150px] truncate">
                                {getColValue(row, "representativeWork") || "—"}
                              </td>
                              <td className="px-3 py-2 text-gray-600 dark:text-gray-300 max-w-[140px] truncate">
                                {getColValue(row, "purpose") || "—"}
                              </td>
                              <td className="px-3 py-2 text-gray-600 dark:text-gray-300 max-w-[130px] truncate">
                                {getColValue(row, "hwBefore") || "No information available"}
                              </td>
                              <td className="px-3 py-2 text-gray-600 dark:text-gray-300 max-w-[130px] truncate">
                                {getColValue(row, "hwAfter") || "No information available"}
                              </td>
                              <td className="px-3 py-2 text-text-subtlest max-w-[120px] truncate">
                                {getColValue(row, "swBefore") || "No information available"}
                              </td>
                              <td className="px-3 py-2 text-text-subtlest max-w-[120px] truncate">
                                {getColValue(row, "swAfter") || "No information available"}
                              </td>
                              <td className="px-3 py-2 text-center">
                                <span
                                  className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${
                                    row.priority === "중요" || row.priority === "Important"
                                      ? "bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 border border-blue-100"
                                      : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                                  }`}
                                >
                                  {row.priority || "Important"}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-center">
                                <span className="px-2 py-0.5 text-[10px] font-medium text-gray-600 bg-gray-50 dark:bg-gray-700 dark:text-gray-300 rounded-md border border-gray-100">
                                  {row.effectCategory || row.category || "integrity"}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-center">
                                <button
                                  type="button"
                                  title="Move to Not Applicable"
                                  onClick={() => {
                                    setApplicableRows(applicableRows.filter((_, i) => i !== idx));
                                    setNotApplicableRows([
                                      ...notApplicableRows,
                                      { ...row, nonImplReason: row.nonImplReason || "" },
                                    ]);
                                  }}
                                  className="w-6 h-6 rounded-md border border-red-200 bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center cursor-pointer transition-colors"
                                >
                                  <i className="fas fa-arrow-down text-[10px]" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Section 2: Not Applicable */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <i className="fas fa-times-circle text-red-500 text-sm" />
                  <h4 className="text-sm font-bold text-text-default">
                    {t("page.mp.notApplicable", "Not Applicable")}
                  </h4>
                  <span className="px-2.5 py-0.5 text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 rounded-full border border-red-100 dark:border-red-800/40">
                    {notApplicableRows.length} {t("app.cases", "cases")}
                  </span>
                </div>

                {/* Not Applicable Table */}
                <div className="border border-red-200 dark:border-red-800/40 rounded-2xl overflow-hidden border-l-4 border-l-red-500 bg-surface-default shadow-2xs">
                  {notApplicableRows.length === 0 ? (
                    <div className="py-8 flex flex-col items-center justify-center text-center">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-500 flex items-center justify-center text-base mb-2">
                        <i className="fas fa-check" />
                      </div>
                      <p className="text-xs font-bold text-gray-400 dark:text-gray-500">
                        {t("page.mp.noItemsNotApplied", "No items not applied")}
                      </p>
                    </div>
                  ) : (
                    <div className="max-h-56 overflow-y-auto custom-scrollbar">
                      <table
                        className="w-full text-left text-xs"
                        style={{ borderCollapse: "separate", borderSpacing: 0 }}
                      >
                        <thead className="sticky top-0 bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 uppercase text-[10px] font-bold tracking-wider z-20 border-b border-red-200 dark:border-red-800 shadow-2xs">
                          <tr>
                            <th className="bg-red-100 dark:bg-red-950 px-3 py-2.5 w-8 text-center">
                              #
                            </th>
                            <th className="bg-red-100 dark:bg-red-950 px-3 py-2.5">
                              {t("field.repWork", "REPRESENTATIVE WORK NAME")}
                            </th>
                            <th className="bg-red-100 dark:bg-red-950 px-3 py-2.5">
                              {t("field.purpose", "PURPOSE OF THE WORK")}
                            </th>
                            <th className="bg-red-100 dark:bg-red-950 px-3 py-2.5">
                              {t("field.hwBefore", "BEFORE CHANGING THE HARDWARE")}
                            </th>
                            <th className="bg-red-100 dark:bg-red-950 px-3 py-2.5">
                              {t("field.hwAfter", "AFTER CHANGING THE HARDWARE")}
                            </th>
                            <th className="bg-red-100 dark:bg-red-950 px-3 py-2.5">
                              {t("field.swBefore", "BEFORE SOFTWARE CHANGE")}
                            </th>
                            <th className="bg-red-100 dark:bg-red-950 px-3 py-2.5">
                              {t("field.swAfter", "AFTER THE SOFTWARE CHANGE")}
                            </th>
                            <th className="bg-red-100 dark:bg-red-950 px-3 py-2.5 w-20 text-center">
                              {t("field.priority", "IMPORTANCE")}
                            </th>
                            <th className="bg-red-100 dark:bg-red-950 px-3 py-2.5 w-20 text-center">
                              {t("field.category", "EFFECT")}
                            </th>
                            <th className="bg-red-100 dark:bg-red-950 px-3 py-2.5">
                              {t("field.nonImplReason", "REASONS FOR NON-IMPLEMENTATION")}
                            </th>
                            <th className="bg-red-100 dark:bg-red-950 px-3 py-2.5 w-12 text-center"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                          {notApplicableRows.map((row, idx) => (
                            <tr
                              key={`not-${idx}`}
                              className="hover:bg-red-50/30 dark:hover:bg-red-900/10 transition-colors"
                            >
                              <td className="px-3 py-2 text-center text-gray-400 font-medium">
                                {idx + 1}
                              </td>
                              <td className="px-3 py-2 font-semibold text-text-default max-w-[130px] truncate">
                                {getColValue(row, "representativeWork") || "—"}
                              </td>
                              <td className="px-3 py-2 text-gray-600 dark:text-gray-300 max-w-[120px] truncate">
                                {getColValue(row, "purpose") || "—"}
                              </td>
                              <td className="px-3 py-2 text-gray-600 dark:text-gray-300 max-w-[110px] truncate">
                                {getColValue(row, "hwBefore") || "No information available"}
                              </td>
                              <td className="px-3 py-2 text-gray-600 dark:text-gray-300 max-w-[110px] truncate">
                                {getColValue(row, "hwAfter") || "No information available"}
                              </td>
                              <td className="px-3 py-2 text-text-subtlest max-w-[100px] truncate">
                                {getColValue(row, "swBefore") || "No information available"}
                              </td>
                              <td className="px-3 py-2 text-text-subtlest max-w-[100px] truncate">
                                {getColValue(row, "swAfter") || "No information available"}
                              </td>
                              <td className="px-3 py-2 text-center">
                                <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                                  {row.priority || "Normal"}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-center">
                                <span className="px-2 py-0.5 text-[10px] font-medium text-gray-600 bg-gray-50 dark:bg-gray-700 dark:text-gray-300 rounded-md border border-gray-100">
                                  {row.effectCategory || row.category || "integrity"}
                                </span>
                              </td>
                              <td className="px-3 py-2">
                                <textarea
                                  rows={2}
                                  placeholder="Importance Average"
                                  value={row.nonImplReason || "Importance Average"}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setNotApplicableRows(
                                      notApplicableRows.map((r, i) =>
                                        i === idx ? { ...r, nonImplReason: val } : r,
                                      ),
                                    );
                                  }}
                                  className="w-full min-w-[180px] p-2 text-xs border border-red-300 dark:border-red-700/60 rounded-xl bg-white dark:bg-gray-700 text-red-600 dark:text-red-400 font-semibold focus:outline-none focus:ring-1 focus:ring-red-400 shadow-2xs resize-y"
                                />
                              </td>
                              <td className="px-3 py-2 text-center">
                                <button
                                  type="button"
                                  title="Restore to Applicable"
                                  onClick={() => {
                                    setNotApplicableRows(
                                      notApplicableRows.filter((_, i) => i !== idx),
                                    );
                                    setApplicableRows([...applicableRows, row]);
                                  }}
                                  className="w-6 h-6 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 flex items-center justify-center cursor-pointer transition-colors"
                                >
                                  <i className="fas fa-arrow-up text-[10px]" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-4 mt-4 border-t border-gray-100 dark:border-gray-700 shrink-0">
              <button
                type="button"
                className="text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 transition-colors cursor-pointer"
                onClick={() => setShowSaveModal(false)}
              >
                {t("app.cancellation", "cancellation")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSaveModal(false);
                  handleSaveAll();
                }}
                className="bg-[#1745c2] hover:bg-[#1239a5] text-white font-bold text-xs px-8 py-3 rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition-all"
              >
                <i className="fas fa-save text-xs" />
                <span>{t("app.save", "Save")}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      <FilterToast
        isVisible={operationStatus.isVisible}
        status={operationStatus.status}
        message={operationStatus.message}
        autoClose={operationStatus.autoClose}
        onClose={() =>
          setOperationStatus({ isVisible: false, status: "loading", message: "", autoClose: true })
        }
      />
    </>
  );
}
