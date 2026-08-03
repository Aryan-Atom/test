import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { APIcallGet, APIcallPost } from "../axios/apiCall";
import { pocEndPoints } from "../axios/endPoints";
import { useI18n } from "../i18n.jsx";
import { isStaticDataMode } from "../utils/staticDataMode.js";
import { X_AXIS_MODE, getCellStyle, getDateModeItemStyle } from "../utils/matrixCellStyle.js";
import { changeFilterDataAndTableData } from "./static-data/ChangeHistoryData.js";

// ─────────────────────────────────────────────────────────────────────────────
// TableSkeleton
// ─────────────────────────────────────────────────────────────────────────────
function TableSkeleton({ columns = [], equipmentRows = [], mode = "date", t }) {
  const rowsCount = equipmentRows.length > 0 ? equipmentRows.length : 8;
  const displayCols = columns.length > 0 ? columns : Array.from({ length: 6 }).map((_, i) => `Col ${i + 1}`);

  return (
    <div className="overflow-auto flex-1 min-h-0">
      <table className="w-full min-w-max text-sm" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
        <thead>
          <tr className="border-b border-border-base bg-surface-strong">
            <th
              className="sticky left-0 z-25 bg-surface-strong px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-text-subtle"
              style={{ width: "100px", position: "sticky", left: 0 }}
            >
              {t("field.site", "SITE")}
            </th>
            <th
              className="sticky z-25 bg-surface-strong px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-text-subtle"
              style={{ width: "120px", position: "sticky", left: "100px" }}
            >
              {t("field.equipmentCode", "EQUIPMENT CODE")}
            </th>
            <th
              className="sticky z-25 bg-surface-strong px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-text-subtle"
              style={{ width: "180px", position: "sticky", left: "220px" }}
            >
              {t("field.equipmentName", "EQUIPMENT NAME")}
            </th>
            {displayCols.map((col) => (
              <th
                key={col}
                className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-text-subtle relative group"
                style={{ width: "160px" }}
              >
                {col}
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
                  <td key={col} className="px-4 py-3">
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
    selectedValue === "전체" || !selectedValue
      ? t("app.all", "전체")
      : selectedValue;

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
          background: disabled ? "var(--surface-strong, #f8f9fb)" : "var(--surface-default, #ffffff)",
          border: "1px solid var(--border-base, #e6e9ef)",
          borderRadius: "10px",
        }}
      >
        <span className="truncate text-xs font-semibold pr-2">{displayLabel}</span>
        <i className={`fas fa-chevron-down text-[10px] text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div
          className="absolute left-0 top-full mt-1.5 z-50 w-64 rounded-2xl bg-white dark:bg-gray-800 p-2 shadow-xl border border-gray-100 dark:border-gray-700 animate-fade-in"
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
              placeholder={t("matrix.searchRepWork", "작업명 검색...")}
              className="w-full rounded-xl bg-gray-50 dark:bg-gray-700/60 pl-8 pr-7 py-1.5 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 border border-gray-200 dark:border-gray-600"
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
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
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
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
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
          marginTop: "0px"
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
            minWidth: "100%"
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
  return String(value ?? "").trim().toLowerCase();
}

function getColValue(row, col) {
  if (!row) return "";
  if (col === "representativeWork") {
    return row.representativeWork ?? row["대표작업명"] ?? row["대표 작업명"] ?? row["ëŒ€í‘œì ‘ì—…ëª…"] ?? row["ëŒ€í‘œ ì ‘ì—…ëª…"] ?? "";
  }
  if (col === "work") {
    return row.work ?? row.purpose ?? row["작업 목적"] ?? row["작업목적"] ?? "";
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
    return row.sparePart ?? row["자재명"] ?? "";
  }
  if (col === "hwAsWas") {
    return row.hwAsWas ?? row.hwBefore ?? row["HW 변경 전"] ?? "";
  }
  if (col === "hwAsIs") {
    return row.hwAsIs ?? row.hwAfter ?? row["HW 변경 후"] ?? "";
  }
  if (col === "swAsWas") {
    return row.swAsWas ?? row.swBefore ?? row["SW 변경 전"] ?? "";
  }
  if (col === "swAsIs") {
    return row.swAsIs ?? row.swAfter ?? row["SW 변경 후"] ?? "";
  }
  if (col === "priority") {
    return row.priority ?? row["중요도"] ?? row["ì¤‘ìš”ë „"] ?? "";
  }
  if (col === "category") {
    return row.category ?? row["효과 유형"] ?? row["효과유형"] ?? row["íš¨ê³¼ ìœ í˜•"] ?? row["íš¨ê³¼ìœ í˜•"] ?? "";
  }
  if (col === "wOCode") {
    return row.wOCode ?? row.woCode ?? row["W/O코드"] ?? "";
  }
  if (col === "workedOn") {
    return row.workedOn ?? row["작업완료일"] ?? "";
  }
  if (col === "process") {
    return row.process ?? row["공정"] ?? row["ê³µì •"] ?? "";
  }
  if (col === "maintGroup") {
    return row.maintGroup ?? row["보전파트"] ?? row["보전그룹"] ?? row["유지보수 그룹"] ?? row["유지보수그룹"] ?? row.equipment ?? row["ë³´ì „íŒŒíŠ¸"] ?? row["ë³´ì „ê·¸ë£¹"] ?? row["ìœ ì§€ë³´ìˆ˜ ê·¸ë£¹"] ?? "";
  }
  if (col === "site") {
    return row.site ?? row["법인"] ?? row["사이트"] ?? "";
  }
  if (col === "equipmentCode") {
    return row.equipmentCode ?? row["설비코드"] ?? "";
  }
  if (col === "equipmentName") {
    return row.equipmentName ?? row["설비명"] ?? "";
  }
  return row[col] ?? "";
}

export default function Matrix({ data, onOpenDetail, onUpload, searchText }) {
  const { t } = useI18n();
  const [mode, setMode] = useState("date");
  const [filterData, setFilterData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [selectedProcess, setSelectedProcess] = useState("전체");
  const [selectedMaintenance, setSelectedMaintenance] = useState("전체");
  const [selectedSite, setSelectedSite] = useState("전체");
  const [selectedRepWork, setSelectedRepWork] = useState("전체");
  const [selectedPriorities, setSelectedPriorities] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });
  const [endDate, setEndDate] = useState(() => {
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
  const [asActiveTab, setAsActiveTab] = useState("unconfirmed");
  const [asSelectedEqCodes, setAsSelectedEqCodes] = useState(new Set());
  const [asStaging, setAsStaging] = useState({});

  const openApplyStatusModal = useCallback((repWork) => {
    setAsRepWork(repWork);
    setAsActiveTab("unconfirmed");
    setAsSelectedEqCodes(new Set());
    setAsStaging({});
    setShowApplyStatusModal(true);
  }, []);

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

  useEffect(() => {
    getFilterData();
  }, [getFilterData]);

  // Extract Cascade options dynamically from allRecords
  const processOptions = useMemo(() => {
    const raw = [...new Set(allRecords.map(r => getColValue(r, "process")).filter(Boolean))];
    const allowed = filterData?.process?.filter(p => p.isChangedData === true).map(p => p.processName) ?? [];
    if (filterData?.process) {
      return raw.filter(p => allowed.includes(p)).sort();
    }
    return raw.sort();
  }, [allRecords, filterData]);

  const maintenanceOptions = useMemo(() => {
    if (selectedProcess === "전체") return [];
    const raw = [...new Set(allRecords.filter(r => getColValue(r, "process") === selectedProcess).map(r => getColValue(r, "maintGroup")).filter(Boolean))];
    const allowed = filterData?.maintenance?.filter(m => m.isChangedData === true).map(m => m.maintenanceGroupName) ?? [];
    if (filterData?.maintenance) {
      return raw.filter(m => allowed.includes(m)).sort();
    }
    return raw.sort();
  }, [allRecords, selectedProcess, filterData]);

  const siteOptions = useMemo(() => {
    const raw = [...new Set(allRecords.filter(r => 
      (selectedProcess === "전체" || getColValue(r, "process") === selectedProcess) &&
      (selectedMaintenance === "전체" || getColValue(r, "maintGroup") === selectedMaintenance)
    ).map(r => getColValue(r, "site")).filter(Boolean))];
    const allowed = filterData?.site?.filter(s => s.isChangedData === true).map(s => s.siteName) ?? [];
    if (filterData?.site) {
      return raw.filter(s => allowed.includes(s)).sort();
    }
    return raw.sort();
  }, [allRecords, selectedProcess, selectedMaintenance, filterData]);

  const repWorkOptions = useMemo(() => {
    const reps = filterData?.representations ?? [];
    return [...new Set(reps.map(r => r.representativeWorkName).filter(Boolean))].sort();
  }, [filterData]);

  const priorityOptions = useMemo(() => {
    const rawList = [...new Set((filterData?.priority ?? []).map((p) => p.priorityName).filter(Boolean))];
    if (rawList.length === 0) {
      return ["중요", "일반"];
    }
    return rawList;
  }, [filterData]);

  const categoryOptions = useMemo(() => {
    const rawList = [...new Set((filterData?.category ?? []).map((c) => c.categoryName).filter(Boolean))];
    if (rawList.length === 0) {
      return ["생산성", "품질", "보전성", "기타"];
    }
    return rawList;
  }, [filterData]);

  // Cascade Option Handlers
  const handleProcessChange = (e) => {
    const proc = e.target.value;
    setSelectedProcess(proc);

    if (proc === "전체") {
      setSelectedMaintenance("전체");
      setSelectedSite("전체");
      setSelectedRepWork("전체");
    } else {
      const parts = [...new Set(allRecords.filter(r => getColValue(r, "process") === proc).map(r => getColValue(r, "maintGroup")).filter(Boolean))].sort();
      if (parts.length === 1) {
        setSelectedMaintenance(parts[0]);
        const sites = [...new Set(allRecords.filter(r => getColValue(r, "process") === proc && getColValue(r, "maintGroup") === parts[0]).map(r => getColValue(r, "site")).filter(Boolean))].sort();
        if (sites.length === 1) {
          setSelectedSite(sites[0]);
        } else {
          setSelectedSite("전체");
        }
      } else {
        setSelectedMaintenance("전체");
        setSelectedSite("전체");
      }
      setSelectedRepWork("전체");
    }
  };

  const handleMaintenanceChange = (e) => {
    const part = e.target.value;
    setSelectedMaintenance(part);

    if (part === "전체") {
      setSelectedSite("전체");
      setSelectedRepWork("전체");
    } else {
      const sites = [...new Set(allRecords.filter(r => 
        (selectedProcess === "전체" || getColValue(r, "process") === selectedProcess) &&
        getColValue(r, "maintGroup") === part
      ).map(r => getColValue(r, "site")).filter(Boolean))].sort();
      if (sites.length === 1) {
        setSelectedSite(sites[0]);
      } else {
        setSelectedSite("전체");
      }
      setSelectedRepWork("전체");
    }
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
    if (selectedProcess === "전체") {
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
    startDate,
    endDate,
    searchText,
  ]);

  // Determine X-axis headers (columns) and Y-axis rows (equipment)
  const { columns, equipmentRows } = useMemo(() => {
    if (filtered.length === 0) return { columns: [], equipmentRows: [] };

    // Unique equipment mapping
    const eqMap = new Map();
    filtered.forEach((item) => {
      const site = getColValue(item, "site") || getColValue(item, "법인") || "A1. Seoul";
      const scode = getColValue(item, "equipmentCode");
      const sname = getColValue(item, "equipmentName");
      const k = site + "|" + scode + "|" + sname;
      if (!eqMap.has(k)) {
        eqMap.set(k, { site, equipmentCode: scode, equipmentName: sname });
      }
    });
    const equipmentRows = [...eqMap.values()].sort((a, b) => a.equipmentName.localeCompare(b.equipmentName));

    // Columns (X axis values)
    let columns = [];
    if (mode === "date") {
      columns = [...new Set(filtered.map(d => getFormattedDateString(getColValue(d, "workedOn"))).filter(Boolean))].sort();
    } else {
      // Sort representative tasks by latest date in descending order
      const repLatest = {};
      filtered.forEach((item) => {
        const rep = getColValue(item, "representativeWork");
        const dt = getFormattedDateString(getColValue(item, "workedOn"));
        if (rep && dt) {
          if (!repLatest[rep] || dt > repLatest[rep]) {
            repLatest[rep] = dt;
          }
        }
      });
      columns = Object.entries(repLatest)
        .sort((a, b) => b[1].localeCompare(a[1]))
        .map((e) => e[0]);
    }

    return { columns, equipmentRows };
  }, [filtered, mode]);

  // Task Mode completion rates
  const { colCompletion } = useMemo(() => {
    if (filtered.length === 0 || mode !== "task") return { colCompletion: {} };

    const totalEqs = equipmentRows.length || 1;
    const colCompletion = {};
    columns.forEach((col) => {
      let count = 0;
      equipmentRows.forEach((eq) => {
        const hasTask = filtered.some(d => 
          getColValue(d, "equipmentCode") === eq.equipmentCode && 
          getColValue(d, "equipmentName") === eq.equipmentName && 
          getColValue(d, "representativeWork") === col
        );
        if (hasTask) count++;
      });
      colCompletion[col] = (count / totalEqs) * 100;
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
    
    const currentMaintRecords = allRecords.filter(r => 
      getColValue(r, "process") === selectedProcess && 
      getColValue(r, "maintGroup") === selectedMaintenance
    );
    
    let resolvedTaskName = taskName;
    let resolvedTasksList = [];

    if (taskName) {
      resolvedTaskName = taskName;
      resolvedTasksList = [];
    } else if (colKey) {
      const matchedTasks = [...new Set(currentMaintRecords.filter(r => {
        if (mode === "date") {
          return getFormattedDateString(getColValue(r, "workedOn")) === colKey;
        } else {
          return getColValue(r, "representativeWork") === colKey;
        }
      }).map(r => getColValue(r, "representativeWork")).filter(Boolean))];

      if (matchedTasks.length === 1) {
        resolvedTaskName = matchedTasks[0];
        resolvedTasksList = [];
      } else if (matchedTasks.length > 1) {
        resolvedTaskName = matchedTasks[0];
        resolvedTasksList = matchedTasks;
      } else {
        resolvedTaskName = "";
        resolvedTasksList = [];
      }
    } else {
      resolvedTaskName = "";
      resolvedTasksList = [];
    }

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
        (r) => getColValue(r, "representativeWork") === resolvedTaskName
      );
      if (matchedRecords.length > 0) {
        const firstWithPriority = matchedRecords.find(r => getColValue(r, "priority") || getColValue(r, "category")) || matchedRecords[0];
        existingPriority = getColValue(firstWithPriority, "priority");
        existingCategory = getColValue(firstWithPriority, "category");
      }
    }

    setNewRepresentativeWork("");
    setNewPriority(existingPriority);
    setNewCategory(existingCategory);
    setShowReplaceModal(true);
  };

  // ── Lateral Deployment Data Calculations & Action Handlers ──
  const asEquipmentData = useMemo(() => {
    if (!asRepWork || !equipmentRows) return { woApplied: [], unconfirmed: [], applied: [], rejected: [] };

    const woApplied = [];
    const unconfirmed = [];
    const applied = [];
    const rejected = [];

    equipmentRows.forEach((eq) => {
      const eqCode = eq.equipmentCode;
      const eqName = eq.equipmentName;
      const site = eq.site || eq.corporation || "A3. 부산";

      const matched = allRecords.filter(
        (r) =>
          getColValue(r, "equipmentCode") === eqCode &&
          getColValue(r, "representativeWork") === asRepWork
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
  }, [asRepWork, equipmentRows, allRecords, asStaging]);

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
      setShowApplyStatusModal(false);
      return;
    }

    setAllRecords((prevRecords) => {
      const updated = [...prevRecords];

      Object.entries(asStaging).forEach(([eqCode, newStatus]) => {
        const existingIdx = updated.findIndex(
          (r) =>
            getColValue(r, "equipmentCode") === eqCode &&
            getColValue(r, "representativeWork") === asRepWork
        );

        if (existingIdx >= 0) {
          updated[existingIdx] = {
            ...updated[existingIdx],
            apply_status: newStatus,
          };
        } else {
          const eqInfo = equipmentRows.find((eq) => eq.equipmentCode === eqCode);
          if (eqInfo) {
            const maxId = updated.reduce((max, r) => Math.max(max, Number(r.id) || 0), 0);
            const newRecord = {
              id: maxId + 1,
              process: selectedProcess !== "전체" ? selectedProcess : "02. 배칭",
              maintGroup: selectedMaintenance !== "전체" ? selectedMaintenance : "0202. Nano Mill",
              equipmentCode: eqInfo.equipmentCode,
              equipmentName: eqInfo.equipmentName,
              site: eqInfo.site || "A3. 부산",
              representativeWork: asRepWork,
              apply_status: newStatus,
              workedOn: new Date().toISOString().split("T")[0],
              priority: "일반",
              category: "보전성",
            };
            updated.push(newRecord);
          }
        }
      });

      return updated;
    });

    setShowApplyStatusModal(false);
    setAsStaging({});
    setAsSelectedEqCodes(new Set());
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

    const performUpdate = () => {
      const updated = allRecords.map((d) => {
        const isMatch = 
          getColValue(d, "process") === selectedProcess &&
          getColValue(d, "maintGroup") === selectedMaintenance &&
          getColValue(d, "representativeWork") === targetTask;

        if (isMatch) {
          const item = { ...d };
          if (newRepresentativeWork.trim()) {
            let updatedKey = false;
            if ("representativeWork" in item) { item.representativeWork = newRepresentativeWork.trim(); updatedKey = true; }
            if ("대표작업명" in item) { item["대표작업명"] = newRepresentativeWork.trim(); updatedKey = true; }
            if ("대표 작업명" in item) { item["대표 작업명"] = newRepresentativeWork.trim(); updatedKey = true; }
            if ("ëŒ€í‘œì ‘ì—…ëª…" in item) { item["ëŒ€í‘œì ‘ì—…ëª…"] = newRepresentativeWork.trim(); updatedKey = true; }
            if ("ëŒ€í‘œ ì ‘ì—…ëª…" in item) { item["ëŒ€í‘œ ì ‘ì—…ëª…"] = newRepresentativeWork.trim(); updatedKey = true; }
            if (!updatedKey) {
              item.representativeWork = newRepresentativeWork.trim();
            }
          }
          if (newPriority) {
            let updatedKey = false;
            if ("priority" in item) { item.priority = newPriority; updatedKey = true; }
            if ("중요도" in item) { item["중요도"] = newPriority; updatedKey = true; }
            if ("ì¤‘ìš”ë „" in item) { item["ì¤‘ìš”ë „"] = newPriority; updatedKey = true; }
            if (!updatedKey) {
              item.priority = newPriority;
            }
          }
          if (newCategory) {
            let updatedKey = false;
            if ("category" in item) { item.category = newCategory; updatedKey = true; }
            if ("효과 유형" in item) { item["효과 유형"] = newCategory; updatedKey = true; }
            if ("효과유형" in item) { item["효과유형"] = newCategory; updatedKey = true; }
            if ("íš¨ê³¼ ìœ í˜•" in item) { item["íš¨ê³¼ ìœ í˜•"] = newCategory; updatedKey = true; }
            if ("íš¨ê³¼ìœ í˜•" in item) { item["íš¨ê³¼ìœ í˜•"] = newCategory; updatedKey = true; }
            if (!updatedKey) {
              item.category = newCategory;
            }
          }
          return item;
        }
        return d;
      });

      setAllRecords(updated);

      const cleanRecords = updated.map((row) => {
        const clean = {};
        Object.keys(row).forEach((key) => {
          if (!key.startsWith("_")) {
            clean[key] = row[key];
          }
        });
        return {
          ...clean,
          id: clean.id ?? 0,
        };
      });

      const payload = {
        changeDataList: cleanRecords,
        id: changedDataId,
      };

      if (isStaticDataMode) {
        if (filterData?.representations && newRepresentativeWork.trim()) {
          const updatedReps = filterData.representations.map(rep => {
            if (normalizeName(rep.representativeWorkName) === normalizeName(targetTask)) {
              return { ...rep, representativeWorkName: newRepresentativeWork.trim() };
            }
            return rep;
          });
          setFilterData({ ...filterData, representations: updatedReps });
        }
        onUpload?.("change_rows", payload);
        setReplacing(false);
        setShowReplaceModal(false);
        return;
      }

      APIcallPost(pocEndPoints.SAVE_DATA_CHANGES, payload, {}, (responseData, status) => {
        setReplacing(false);
        if (status === 200) {
          setShowReplaceModal(false);
          onUpload?.("change_rows", payload);
          getFilterData();
        } else {
          alert(t("toast.saveError", "저장에 실패했습니다."));
        }
      });
    };

    if (newRepresentativeWork.trim() && !isStaticDataMode) {
      const representationItem = (filterData?.representations ?? []).find(
        (rep) => normalizeName(rep.representativeWorkName) === normalizeName(targetTask)
      );
      const repId = representationItem ? representationItem.id : null;

      if (repId !== null && repId !== undefined) {
        APIcallPost(
          pocEndPoints.UPDATE_REPRESENTATIVE_WORK,
          { id: repId, name: newRepresentativeWork.trim() },
          {},
          (repData, repStatus) => {
            if (repStatus === 200) {
              performUpdate();
            } else {
              setReplacing(false);
              alert(t("toast.saveError", "대표 작업명 수정에 실패했습니다."));
            }
          }
        );
      } else {
        performUpdate();
      }
    } else {
      performUpdate();
    }
  };

  const showLanding = selectedProcess === "전체";

  if (loading) {
    return (
      <section className="space-y-6">
        <div className="flex min-h-[240px] items-center justify-center text-text-subtle">
          <i className="fas fa-spinner fa-spin mr-2" /> {t("app.loadingData", "데이터를 불러오는 중...")}
        </div>
      </section>
    );
  }

  return (
    <section className="flex-1 flex flex-col min-h-0 space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-xl md:text-[22px] font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <i className="fas fa-th-large text-[#1745c2] text-xl md:text-[22px]" />
            <span>{t("page.matrix.title", "변경 매트릭스")}</span>
          </h1>
          <p className="mt-1 text-[13px] text-slate-500 font-normal">
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
            <label className="text-sm font-medium text-gray-600 whitespace-nowrap">{t("field.process", "공정")}</label>
            <select
              className="input-base"
              value={selectedProcess}
              onChange={handleProcessChange}
              style={{ width: "110px" }}
            >
              <option value="전체">{t("app.all", "전체")}</option>
              {processOptions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* 보전파트 */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600 whitespace-nowrap">{t("field.equipmentType", "Equipment Type")}</label>
            <select
              className="input-base"
              value={selectedMaintenance}
              onChange={handleMaintenanceChange}
              disabled={selectedProcess === "전체"}
              style={{ width: "130px" }}
            >
              <option value="전체">{t("app.all", "전체")}</option>
              {maintenanceOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* 법인 */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600 whitespace-nowrap">{t("field.site", "법인")}</label>
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
            <label className="text-sm font-medium text-gray-600 whitespace-nowrap">{t("field.repWork", "대표 작업명")}</label>
            <SearchableSelect
              options={repWorkOptions}
              selectedValue={selectedRepWork}
              onChange={setSelectedRepWork}
              disabled={selectedProcess === "전체"}
              t={t}
              minWidth="180px"
            />
            <span className="text-[10px] font-bold text-brand-60" style={{ color: "var(--brand-60, #0f62fe)" }}>
              {repWorkOptions.length ? `(${repWorkOptions.length}개)` : ""}
            </span>
          </div>

          {/* 중요도 */}
          <div className="flex items-center gap-2 flex-none" style={{ minWidth: "175px" }}>
            <label className="text-sm font-medium text-gray-600 whitespace-nowrap">
              {t("field.priority", "중요도")} <span className="text-red-500">*</span>
            </label>
            <MultiSelect
              options={priorityOptions.map((p) => ({ label: p, value: p }))}
              selectedValues={selectedPriorities}
              onChange={setSelectedPriorities}
              t={t}
              minWidth="96px"
            />
          </div>

          {/* 효과 유형 */}
          <div className="flex items-center gap-2 flex-none" style={{ minWidth: "190px" }}>
            <label className="text-sm font-medium text-gray-600 whitespace-nowrap">{t("field.category", "효과유형")}</label>
            <MultiSelect
              options={categoryOptions.map((c) => ({ label: c, value: c }))}
              selectedValues={selectedCategories}
              onChange={setSelectedCategories}
              t={t}
              minWidth="104px"
            />
          </div>

          {/* 기간 */}
          <div className="flex items-center gap-2 ml-auto">
            <label className="text-sm font-medium text-gray-600 whitespace-nowrap">{t("field.period", "기간")}</label>
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
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#ecf2ff] text-[#4f46e5] text-4xl mb-4">
              <i className="fas fa-history" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">{t("landing.selectProcessAndMaint")}</h3>
            <p className="text-sm text-gray-400 max-w-md mx-auto">
              {t("landing.selectProcessAndMaintMatrixDesc")}
            </p>
          </div>
        ) : isFiltering ? (
          <TableSkeleton
            columns={columns}
            equipmentRows={equipmentRows}
            mode={mode}
            t={t}
          />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 p-10 text-center text-text-subtle flex-1">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-10 text-brand-60 text-3xl" style={{ backgroundColor: "var(--brand-10, #eff6ff)", color: "var(--brand-60, #0f62fe)" }}>
              <i className="fas fa-layer-group" />
            </div>
            <h2 className="text-xl font-bold text-text-default">
              {t("matrix.noData", "해당 조건에 맞는 데이터가 없습니다.")}
            </h2>
            <p>{t("matrix.adjustFilter", "필터를 조정하거나 추가 데이터를 확인하세요.")}</p>
          </div>
        ) : (
          <div className="overflow-auto flex-1 min-h-0">
            <table className="w-full min-w-max text-sm" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
              <thead>
                <tr className="border-b border-border-base bg-surface-strong">
                  <th
                    className="sticky left-0 z-25 bg-surface-strong px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-text-subtle"
                    style={{ width: "100px", position: "sticky", left: 0 }}
                  >
                    {t("field.site", "SITE")}
                  </th>
                  <th
                    className="sticky z-25 bg-surface-strong px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-text-subtle"
                    style={{ width: "120px", position: "sticky", left: "100px" }}
                  >
                    {t("field.equipmentCode", "EQUIPMENT CODE")}
                  </th>
                  <th
                    className="sticky z-25 bg-surface-strong px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-text-subtle"
                    style={{ width: "180px", position: "sticky", left: "220px" }}
                  >
                    {t("field.equipmentName", "EQUIPMENT NAME")}
                  </th>
                  {columns.map((col) => {
                    if (mode === "date") {
                      return (
                        <th
                          key={col}
                          className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-text-subtle relative group"
                          style={{ width: "160px" }}
                        >
                          <div className="flex items-center justify-center gap-1">
                            <span>{col}</span>
                          </div>
                        </th>
                      );
                    } else {
                      const rate = colCompletion?.[col] ?? 0;
                      return (
                        <th
                          key={col}
                          className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-text-subtle relative group"
                          style={{ width: "200px", whiteSpace: "normal" }}
                        >
                          <div className="flex flex-col items-center justify-center">
                            <div className="flex items-center justify-center gap-1">
                              <span className="break-all">{col}</span>
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
                    key={`${eq.site}-${eq.equipmentCode}-${rowIdx}`}
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
                      {eq.equipmentCode}
                    </td>
                    <td
                      className="sticky z-20 bg-surface-default px-4 py-3 font-semibold text-text-default group-hover:bg-fill-active transition-colors"
                      style={{ position: "sticky", left: "220px" }}
                    >
                      {eq.equipmentName}
                    </td>
                    {columns.map((col) => {
                      const matched = filtered.filter(d => {
                        const isEquip =
                          getColValue(d, "equipmentCode") === eq.equipmentCode &&
                          getColValue(d, "equipmentName") === eq.equipmentName &&
                          (getColValue(d, "site") || getColValue(d, "법인") || "A1. Seoul") === eq.site;
                        if (!isEquip) return false;
                        if (mode === "date") {
                          return getFormattedDateString(getColValue(d, "workedOn")) === col;
                        } else {
                          return getColValue(d, "representativeWork") === col;
                        }
                      });

                      if (matched.length === 0) {
                        if (mode === "task") {
                          return (
                            <td key={col} className="px-3 py-2 align-middle text-center">
                              <div className="flex items-center justify-center min-h-[36px]">
                                <button
                                  type="button"
                                  className="w-6 h-6 rounded-full border border-dashed border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:text-blue-600 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 flex items-center justify-center text-xs font-bold transition-all cursor-pointer shadow-2xs"
                                  onClick={() => openApplyStatusModal(col)}
                                  title={t("page.matrix.lateralModalTitle", "횡전개 관리")}
                                >
                                  <i className="fas fa-plus" />
                                </button>
                              </div>
                            </td>
                          );
                        }
                        return <td key={col} className="px-4 py-3" />;
                      }

                      const displayValues = [...new Set(matched.map(d =>
                        mode === X_AXIS_MODE.DATE ? getColValue(d, "representativeWork") : getFormattedDateString(getColValue(d, "workedOn"))
                      ).filter(Boolean))].sort();

                      const cellStyle = getCellStyle(
                        matched,
                        mode,
                        (item) => getColValue(item, "priority"),
                      );

                      return (
                        <td key={col} className="px-3 py-2 align-middle">
                          <div
                            onClick={() => onOpenDetail?.(matched)}
                            className="matrix-cell p-2 rounded-lg cursor-pointer flex flex-col items-center justify-center text-center relative group transition-all duration-200 hover:scale-[1.04] hover:shadow-md hover:z-10"
                            style={{
                              backgroundColor: cellStyle.backgroundColor,
                              color: cellStyle.color,
                              fontSize: "11px",
                              fontWeight: 700,
                              lineHeight: "1.4",
                              minHeight: "36px",
                              whiteSpace: "pre-line",
                              wordBreak: "break-all"
                            }}
                          >
                            {mode === X_AXIS_MODE.DATE ? (
                              <div className="w-full flex flex-col gap-1">
                                {displayValues.map((val, idx) => {
                                  const representativeWorkItems = matched.filter(d =>
                                    getColValue(d, "representativeWork") === val
                                  );
                                  const itemStyle = getDateModeItemStyle(
                                    representativeWorkItems,
                                    (item) => getColValue(item, "priority"),
                                    (item) => getColValue(item, "representativeWork"),
                                  );

                                  return (
                                    <div
                                      key={idx}
                                      className={`w-full text-center ${itemStyle.className}`}
                                      style={{
                                        backgroundColor: itemStyle.backgroundColor,
                                        color: itemStyle.color,
                                        fontWeight: itemStyle.fontWeight,
                                      }}
                                    >
                                      {val}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div>
                                {displayValues.join("\n")}
                              </div>
                            )}
                            <span 
                              className="absolute top-[2px] right-[4px] text-[9px] opacity-0 group-hover:opacity-100 transition-all duration-200 text-text-subtle bg-white border border-[#e2e8f0] rounded-[4px] px-1 py-0.5 shadow-sm hover:text-[#4f46e5] hover:scale-105 active:scale-95 z-20 cursor-pointer"
                              onClick={(e) => {
                                  e.stopPropagation();
                                  const firstTask = getColValue(matched[0], "representativeWork");
                                  openReplaceModal(firstTask, null, matched[0]);
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
        <div
          className="modal-overlay fixed inset-0 z-[1000] flex items-center justify-center bg-[#0f172a]/40 backdrop-blur-sm animate-fade-in p-4"
          onClick={() => setShowReplaceModal(false)}
        >
          <div
            className="modal-content w-full max-w-[500px] rounded-[24px] bg-white dark:bg-gray-800 shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-100 dark:border-gray-700/80 bg-white dark:bg-gray-800 flex items-start justify-between">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400 text-lg shrink-0 mt-0.5">
                  <i className="fas fa-edit" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-gray-900 dark:text-white leading-tight">
                    {t("page.matrix.replaceModalTitle", "Representative Work Name Change")}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {t("page.matrix.replaceModalDesc", "Batch changes of representative task names, importance, and effect types")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowReplaceModal(false)}
                className="w-8 h-8 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500 transition-colors shrink-0"
              >
                <i className="fas fa-times text-sm" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 bg-white dark:bg-gray-800">
              {/* Job Name to Find */}
              <div>
                <label className="block text-xs font-bold text-gray-900 dark:text-white mb-2">
                  {t("page.matrix.jobNameFind", "Job Name to Find")}
                </label>
                {replaceTargetTasksList.length > 1 ? (
                  <div>
                    <select
                      className="w-full bg-gray-100/80 dark:bg-gray-700/80 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-sm text-gray-800 dark:text-gray-200 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                      value={replaceTargetTask}
                      onChange={(e) => {
                        const nextTask = e.target.value;
                        setReplaceTargetTask(nextTask);
                        if (nextTask) {
                          const currentMaintRecords = allRecords.filter(
                            (r) =>
                              getColValue(r, "process") === selectedProcess &&
                              getColValue(r, "maintGroup") === selectedMaintenance
                          );

                          let foundRecord = null;
                          if (clickedRecord) {
                            const eqCode = getColValue(clickedRecord, "equipmentCode");
                            const eqName = getColValue(clickedRecord, "equipmentName");
                            foundRecord = allRecords.find(
                              (r) =>
                                getColValue(r, "equipmentCode") === eqCode &&
                                getColValue(r, "equipmentName") === eqName &&
                                getColValue(r, "representativeWork") === nextTask
                            );
                          }

                          if (foundRecord) {
                            setNewPriority(getColValue(foundRecord, "priority"));
                            setNewCategory(getColValue(foundRecord, "category"));
                          } else {
                            const matchedRecords = currentMaintRecords.filter(
                              (r) => getColValue(r, "representativeWork") === nextTask
                            );
                            if (matchedRecords.length > 0) {
                              const firstWithVal =
                                matchedRecords.find(
                                  (r) => getColValue(r, "priority") || getColValue(r, "category")
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
                      {replaceTargetTasksList.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-amber-600 mt-1.5 flex items-center gap-1">
                      <i className="fas fa-info-circle text-xs" />
                      {t("page.matrix.multipleTasksNotice", "해당 셀에 2개 이상의 대표 작업명이 있습니다. 변경할 작업명을 선택하세요.")}
                    </p>
                  </div>
                ) : (
                  <div className="w-full bg-gray-100/80 dark:bg-gray-700/80 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-sm text-gray-800 dark:text-gray-200 font-medium">
                    {replaceTargetTask || "-"}
                  </div>
                )}
              </div>

              {/* CHANGES Group Container */}
              <div className="p-4 rounded-2xl bg-gray-50/80 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-700/60 space-y-4">
                <div className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  {t("page.matrix.changesGroup", "CHANGES")}
                </div>

                {/* New Representative Work Name */}
                <div>
                  <label className="block text-xs font-bold text-gray-900 dark:text-white mb-1.5">
                    {t("page.matrix.newRepWorkName", "New Representative Work Name")}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      list="replaceSuggestions"
                      className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 pr-10 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      placeholder={t("page.matrix.replaceAfterPlaceholder", "Search or enter directly...")}
                      value={newRepresentativeWork}
                      onChange={(e) => setNewRepresentativeWork(e.target.value)}
                    />
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-xs">
                      <i className="fas fa-chevron-down" />
                    </div>
                    <datalist id="replaceSuggestions">
                      {repWorkOptions.map((opt) => (
                        <option key={opt} value={opt} />
                      ))}
                    </datalist>
                  </div>
                </div>

                {/* Importance & Types of Effects (2 Cols) */}
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-gray-900 dark:text-white mb-1.5">
                      {t("page.matrix.importance", "Importance")}
                    </label>
                    <select
                      className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                      value={newPriority}
                      onChange={(e) => setNewPriority(e.target.value)}
                    >
                      <option value="">{t("page.matrix.noChange", "No changes")}</option>
                      <option value="중요">{t("priority.high", "High")}</option>
                      <option value="일반">{t("priority.normal", "Normal")}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-900 dark:text-white mb-1.5">
                      {t("page.matrix.typesOfEffects", "Types of effects")}
                    </label>
                    <select
                      className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                    >
                      <option value="">{t("page.matrix.noChange", "No changes")}</option>
                      <option value="생산성">{t("category.productivity", "Productivity")}</option>
                      <option value="품질">{t("category.quality", "Quality")}</option>
                      <option value="보전성">{t("category.maintenance", "Maintenance")}</option>
                      <option value="기타">{t("category.etc", "Etc")}</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-gray-100 dark:border-gray-700/80 bg-white dark:bg-gray-800 flex justify-between items-center">
              <button
                type="button"
                onClick={() => setShowReplaceModal(false)}
                className="text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors px-2 py-1 cursor-pointer"
              >
                {t("page.matrix.cancellation", "cancellation")}
              </button>

              <button
                type="button"
                onClick={executeReplace}
                disabled={replacing}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-6 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
          className="modal-overlay fixed inset-0 z-[1000] flex items-center justify-center bg-[#0f172a]/40 backdrop-blur-sm animate-fade-in p-4"
          onClick={() => setShowApplyStatusModal(false)}
        >
          <div
            className="modal-content w-full max-w-[660px] rounded-[20px] bg-white dark:bg-gray-800 shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-700 flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-start justify-between">
              <div>
                <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400 text-sm">
                    <i className="fas fa-tasks" />
                  </span>
                  <span>"{asRepWork}" {t("page.matrix.lateralModalTitle", "횡전개 관리")}</span>
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 pl-9">
                  {asRepWork}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowApplyStatusModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
              >
                <i className="fas fa-times text-lg" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Stat Summary Cards (4 Cards) */}
              <div className="grid grid-cols-4 gap-3">
                {/* WO Applied */}
                <div className="p-3.5 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-950/40 text-center">
                  <div className="text-2xl font-extrabold text-blue-700 dark:text-blue-300">
                    {asEquipmentData.woApplied.length}
                  </div>
                  <div className="text-xs font-semibold text-blue-800/80 dark:text-blue-300/80 mt-0.5">
                    {t("page.matrix.woApplied", "WO 적용")}
                  </div>
                </div>

                {/* Before Confirmation */}
                <div className="p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/60 dark:bg-indigo-950/40 text-center">
                  <div className="text-2xl font-extrabold text-indigo-700 dark:text-indigo-300">
                    {asEquipmentData.unconfirmed.length}
                  </div>
                  <div className="text-xs font-semibold text-indigo-800/80 dark:text-indigo-300/80 mt-0.5">
                    {t("page.matrix.beforeConfirmation", "수평전개 검토전")}
                  </div>
                </div>

                {/* Applied */}
                <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/40 text-center">
                  <div className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-300">
                    {asEquipmentData.applied.length}
                  </div>
                  <div className="text-xs font-semibold text-emerald-800/80 dark:text-emerald-300/80 mt-0.5">
                    {t("page.matrix.application", "적용")}
                  </div>
                </div>

                {/* Not Applied */}
                <div className="p-3.5 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50/60 dark:bg-rose-950/40 text-center">
                  <div className="text-2xl font-extrabold text-rose-700 dark:text-rose-300">
                    {asEquipmentData.rejected.length}
                  </div>
                  <div className="text-xs font-semibold text-rose-800/80 dark:text-rose-300/80 mt-0.5">
                    {t("page.matrix.notApplied", "미적용")}
                  </div>
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5 p-1 bg-gray-100 dark:bg-gray-700/60 rounded-xl">
                <button
                  type="button"
                  onClick={() => setAsActiveTab("wo_applied")}
                  className={`flex-1 py-2 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                    asActiveTab === "wo_applied"
                      ? "bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-xs"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
                  }`}
                >
                  📝 {t("page.matrix.woApplied", "WO 적용")} ({asEquipmentData.woApplied.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAsActiveTab("unconfirmed")}
                  className={`flex-1 py-2 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                    asActiveTab === "unconfirmed"
                      ? "bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-xs"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
                  }`}
                >
                  🔍 {t("page.matrix.beforeConfirmation", "수평전개 검토전")} ({asEquipmentData.unconfirmed.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAsActiveTab("applied")}
                  className={`flex-1 py-2 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                    asActiveTab === "applied"
                      ? "bg-white dark:bg-gray-800 text-emerald-600 dark:text-emerald-400 shadow-xs"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
                  }`}
                >
                  ✅ {t("page.matrix.application", "적용")} ({asEquipmentData.applied.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAsActiveTab("rejected")}
                  className={`flex-1 py-2 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                    asActiveTab === "rejected"
                      ? "bg-white dark:bg-gray-800 text-rose-600 dark:text-rose-400 shadow-xs"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
                  }`}
                >
                  ❌ {t("page.matrix.notApplied", "미적용")} ({asEquipmentData.rejected.length})
                </button>
              </div>

              {/* Equipment Items List */}
              <div className="max-h-[300px] min-h-[160px] overflow-y-auto space-y-2 p-2 bg-gray-50/50 dark:bg-gray-900/40 rounded-xl border border-gray-200 dark:border-gray-700">
                {currentTabItems.length === 0 ? (
                  <div className="py-10 text-center text-gray-400 text-xs">
                    <i className="fas fa-inbox text-2xl mb-2 block opacity-40" />
                    해당 항목의 설비가 없습니다.
                  </div>
                ) : (
                  currentTabItems.map((item) => {
                    const isChecked = asSelectedEqCodes.has(item.equipmentCode);
                    return (
                      <div
                        key={item.equipmentCode}
                        onClick={() => handleToggleSelectEq(item.equipmentCode)}
                        className={`flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-xl border transition-all cursor-pointer ${
                          isChecked
                            ? "border-blue-500 ring-1 ring-blue-500/20 bg-blue-50/20 dark:bg-blue-900/20"
                            : "border-gray-200 dark:border-gray-700 hover:border-blue-300"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-gray-900 dark:text-white text-sm truncate">
                            {item.equipmentName}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                            {item.site} · {item.equipmentCode}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Bottom Sub-actions Bar */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-gray-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={currentTabItems.length > 0 && asSelectedEqCodes.size === currentTabItems.length}
                    onChange={handleToggleSelectAllEq}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span>{t("page.matrix.overall", "Overall")}</span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleApplyStatusAction("applied")}
                    disabled={asSelectedEqCodes.size === 0}
                    className="px-3.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                  >
                    <i className="fas fa-arrow-right text-[10px]" />
                    {t("page.matrix.application", "Application")}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyStatusAction("rejected")}
                    disabled={asSelectedEqCodes.size === 0}
                    className="px-3.5 py-1.5 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-lg text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                  >
                    <i className="fas fa-arrow-right text-[10px]" />
                    {t("page.matrix.notApplied", "Not applied")}
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/80">
              <button
                type="button"
                onClick={() => setShowApplyStatusModal(false)}
                className="btn-base btn-ghost text-xs px-5 py-2"
              >
                {t("app.close", "Close")}
              </button>
              <button
                type="button"
                onClick={handleSaveApplyStatus}
                className="btn-base bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-6 py-2 rounded-lg shadow-xs flex items-center gap-1.5"
              >
                <i className="fas fa-save" />
                {t("app.save", "Save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
