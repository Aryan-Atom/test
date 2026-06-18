import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import Modal from "../components/Modal.jsx";
import { pocEndPoints } from "../axios/endPoints.js";
import { APIcallGet, APIcallPost } from "../axios/apiCall.js";
import { useI18n } from "../i18n.jsx";
import * as XLSX from "xlsx";
import { isStaticDataMode } from "../utils/staticDataMode.js";
import { changeFilterDataAndTableData } from "./static-data/ChangeHistoryData.js";

// Reusable MultiSelect Dropdown Component with Checkboxes
function MultiSelect({ options, selectedValues, onChange, placeholder, t }) {
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
        onClick={() => setIsOpen((prev) => !prev)}
        className="input-base flex w-full items-center justify-between text-left font-semibold text-text-default"
        style={{
          height: "38px",
          cursor: "pointer",
          background: "var(--surface-default, #ffffff)",
          border: "1px solid var(--border-base, #e6e9ef)",
          borderRadius: "10px",
          padding: "8px 14px",
          width: "100%",
          textAlign: "left",
          marginTop: "0px",
          fontSize: "13px"
        }}
      >
        <span className="truncate">{displayText}</span>
        <i
          className={`fas fa-chevron-down text-[10px] text-text-subtle transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
          style={{ marginLeft: "8px" }}
        />
      </button>

      {isOpen && (
        <div
          className="absolute left-0 right-0 z-[1000] mt-1 max-h-[220px] overflow-y-auto rounded-lg border border-border-base bg-surface-default py-1 shadow-lg"
          style={{
            borderColor: "var(--border-base, #e6e9ef)",
            backgroundColor: "var(--surface-default, #ffffff)"
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
                  onChange={() => handleToggleOption(opt.value)}
                  className="rounded border-border-base text-brand-60 focus:ring-brand-50"
                  style={{ accentColor: "var(--brand-60, #0f62fe)", cursor: "pointer" }}
                />
                <span className="truncate" style={{ fontSize: "13px" }}>{opt.label}</span>
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
  "representativeWork",
  "work",
  "situation",
  "cause",
  "bom",
  "sparePart",
  "hwAsWas",
  "hwAsIs",
  "swAsWas",
  "swAsIs",
  "priority",
  "category",
  "wOCode",
  "workedOn",
];

const COLUMN_LABELS = {
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
  priority: "중요도",
  category: "효과 유형",
  wOCode: "W/O코드",
  workedOn: "작업완료일",
};

const COLUMN_LABEL_KEYS = {
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
  priority: "field.priority",
  category: "field.category",
  wOCode: "field.woCode",
  workedOn: "field.workedOn",
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
    return row.representativeWork ?? row["대표작업명"] ?? row["대표 작업명"] ?? "";
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
    return row.priority ?? row["중요도"] ?? "";
  }
  if (col === "category") {
    return row.category ?? row["효과 유형"] ?? row["효과유형"] ?? "";
  }
  if (col === "wOCode") {
    return row.wOCode ?? row.woCode ?? row["W/O코드"] ?? "";
  }
  if (col === "workedOn") {
    return row.workedOn ?? row["작업완료일"] ?? "";
  }
  if (col === "process") {
    return row.process ?? row["공정"] ?? "";
  }
  if (col === "maintGroup") {
    return row.maintGroup ?? row["보전파트"] ?? row["보전그룹"] ?? "";
  }
  if (col === "site") {
    return row.site ?? row["법인"] ?? row["사이트"] ?? "";
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
    <div className="overflow-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="table-header">
          <tr>
            <th style={{ width: "3%" }}></th>
            {TABLE_COLUMNS.slice(0, 6).map((col) => (
              <th key={col} className="px-4 py-3 text-text-subtle whitespace-nowrap">
                {columnLabel(col, t)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i} className="border-t border-border-base">
              <td className="px-3 py-3"></td>
              {TABLE_COLUMNS.slice(0, 6).map((col) => (
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

export default function MPList({ onAddRow, onExport, searchText, onOpenDetail, drawerItem, onUpload }) {
  const { t, language } = useI18n();

  // ── Filter state ──────────────────────────────────────────────────────────
  const [selectedProcessId, setSelectedProcessId] = useState(null);
  const [selectedSiteId, setSelectedSiteId] = useState(null);
  const [selectedMaintenanceId, setSelectedMaintenanceId] = useState(null);
  const [selectedRepWorks, setSelectedRepWorks] = useState([]);
  const [selectedPriorities, setSelectedPriorities] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

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
  const processList = useMemo(() => filterPayload?.process ?? [], [filterPayload]);

  const siteList = useMemo(() => {
    const all = filterPayload?.site ?? [];
    if (!selectedProcessId) return all;
    return all.filter((s) => s.processId === selectedProcessId);
  }, [filterPayload, selectedProcessId]);

  const maintenanceList = useMemo(() => {
    const all = filterPayload?.maintenance ?? [];
    if (!selectedProcessId) return all;
    return all.filter((m) => m.processId === selectedProcessId);
  }, [filterPayload, selectedProcessId]);

  const repWorkOptions = useMemo(() => {
    const selProcessName = processList.find(p => p.id === selectedProcessId)?.processName;
    const selMaintName = (filterPayload?.maintenance ?? []).find(m => m.id === selectedMaintenanceId)?.maintenanceGroupName;

    const matched = allRecords.filter(r => {
      const matchProc = !selectedProcessId || getColValue(r, "process") === selProcessName;
      const matchMaint = !selectedMaintenanceId || getColValue(r, "maintGroup") === selMaintName;
      return matchProc && matchMaint;
    });

    const unique = [...new Set(matched.map(r => getColValue(r, "representativeWork")).filter(Boolean))].sort();
    return unique.map(u => ({ label: u, value: u }));
  }, [allRecords, selectedProcessId, selectedMaintenanceId, processList, filterPayload]);

  const priorityOptions = useMemo(() => {
    const rawList = [...new Set((filterPayload?.priority ?? []).map((p) => p.priorityName).filter(Boolean))];
    if (rawList.length === 0) {
      return [
        { label: "중요", value: "중요" },
        { label: "일반", value: "일반" }
      ];
    }
    return rawList.map(p => ({ label: p, value: p }));
  }, [filterPayload]);

  const categoryOptions = useMemo(() => {
    const rawList = [...new Set((filterPayload?.category ?? []).map((c) => c.categoryName).filter(Boolean))];
    if (rawList.length === 0) {
      return [
        { label: "생산성", value: "생산성" },
        { label: "품질", value: "품질" },
        { label: "보전성", value: "보전성" },
        { label: "기타", value: "기타" }
      ];
    }
    return rawList.map(c => ({ label: c, value: c }));
  }, [filterPayload]);

  // ── Cascade reset handlers ────────────────────────────────────────────────
  const handleProcessChange = (e) => {
    const val = e.target.value;
    setSelectedProcessId(val === "" ? null : Number(val));
    setSelectedSiteId(null);
    setSelectedMaintenanceId(null);
  };

  const handleMaintenanceChange = (e) => {
    const val = e.target.value;
    setSelectedMaintenanceId(val === "" ? null : Number(val));
  };

  // Auto-select first item effects
  useEffect(() => {
    if (siteList.length > 0 && selectedProcessId !== null) setSelectedSiteId(siteList[0].id);
  }, [siteList, selectedProcessId]);

  useEffect(() => {
    if (maintenanceList.length > 0 && selectedProcessId !== null)
      setSelectedMaintenanceId(maintenanceList[0].id);
  }, [maintenanceList, selectedProcessId]);

  useEffect(() => {
    setSelectedRepWorks([]);
  }, [selectedProcessId, selectedMaintenanceId]);

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

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Filtered & Grouped rows ───────────────────────────────────────────────
  const filtered = useMemo(() => {
    const selProcessName = processList.find((p) => p.id === selectedProcessId)?.processName;
    const selMaintName = (filterPayload?.maintenance ?? []).find((m) => m.id === selectedMaintenanceId)?.maintenanceGroupName;

    let preFiltered = allRecords.filter((item) => {
      const itemProc = getColValue(item, "process");
      const matchProc = !selectedProcessId || itemProc === selProcessName;

      const itemMaint = getColValue(item, "maintGroup");
      const matchMaint = !selectedMaintenanceId || itemMaint === selMaintName;

      const itemRepWork = getColValue(item, "representativeWork");
      const matchRep = selectedRepWorks.length === 0 || selectedRepWorks.includes(itemRepWork);

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

      return matchProc && matchMaint && matchRep && matchPri && matchCat && matchDate && matchSearch;
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
    selectedMaintenanceId,
    selectedRepWorks,
    selectedPriorities,
    selectedCategories,
    dateFrom,
    dateTo,
    searchText,
    processList,
    filterPayload,
  ]);

  // ── Format workedOn for display ───────────────────────────────────────────
  function formatWorkedOn(raw) {
    if (!raw) return "—";
    if (!isNaN(Number(raw))) {
      const d = new Date(new Date(1899, 11, 30).getTime() + Number(raw) * 86400000);
      return d.toISOString().slice(0, 10);
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

        const isTarget = matchProc && matchPart && (repWork ? matchRep : (r._localId === row._localId || r.id === row.id));

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

  // ── Delete a local row ─────────────────────────────────────────────────────
  const handleDeleteRow = (e, row) => {
    e.stopPropagation();
    if (window.confirm(t("app.confirmDelete", "선택한 행을 삭제하시겠습니까?"))) {
      setAllRecords((prev) => prev.filter((r) => {
        if (row._localId && r._localId) return r._localId !== row._localId;
        return r.id !== row.id;
      }));
      setIsDirty(true);
      setOperationStatus({
        isVisible: true,
        status: "success",
        message: t("toast.deleteSuccess", "행이 성공적으로 삭제되었습니다."),
        autoClose: true,
      });
    }
  };

  // ── Edit row on double click ───────────────────────────────────────────────
  const handleRowDoubleClick = (row) => {
    const woCode = getColValue(row, "wOCode");
    if (!woCode || woCode === "—" || woCode === "") {
      setNewRow({
        representativeWork: getColValue(row, "representativeWork"),
        work: row.work ?? row["작업 목적"] ?? row["작업목적"] ?? "",
        report: row.report ?? row["보고서"] ?? "",
        situation: getColValue(row, "situation"),
        cause: getColValue(row, "cause"),
        bom: row.bom ?? "",
        sparePart: row.sparePart ?? row["자재명"] ?? "",
        hwAsWas: row.hwAsWas ?? row["HW 변경 전"] ?? "",
        hwAsIs: row.hwAsIs ?? row["HW 변경 후"] ?? "",
        swAsWas: row.swAsWas ?? row["SW 변경 전"] ?? "",
        swAsIs: row.swAsIs ?? row["SW 변경 후"] ?? "",
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
    const fieldsToValidate = [
      "representativeWork",
      "work",
      "situation",
      "cause",
      "hwAsWas",
      "hwAsIs",
      "swAsWas",
      "swAsIs",
      "workedOn"
    ];
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
    const selMaint = (filterPayload?.maintenance ?? []).find((m) => m.id === selectedMaintenanceId);
    const selSite = (filterPayload?.site ?? []).find((s) => s.id === selectedSiteId);

    const procName = selProcess?.processName ?? newRow.process ?? "";
    const maintName = selMaint?.maintenanceGroupName ?? newRow.maintGroup ?? "";
    const siteName = selSite?.siteName ?? newRow.site ?? "";

    if (editingRowLocalId !== null) {
      // Edit Mode
      setAllRecords((prev) => {
        return prev.map((r) => {
          const isMatch = r._localId === editingRowLocalId || (r.id !== 0 && r.id === editingRowLocalId);
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
    } else {
      // Add Mode
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
        message: `${t("page.mp.addRow")} ${t("app.add")}. ${t("page.mp.saveHint")}`,
        autoClose: true,
      });
      onAddRow?.(enrichedRow);
    }

    setNewRow(EMPTY_ROW);
    setEditingRowLocalId(null);
    setShowModal(false);
    setIsDirty(true);
  };

  // ── Save all changes ──────────────────────────────────────────────────────
  const handleSaveAll = useCallback(() => {
    setSavingAll(true);
    setOperationStatus({
      isVisible: true,
      status: "loading",
      message: t("toast.saving", "저장 중입니다..."),
      autoClose: false,
    });

    const cleanRecords = allRecords.map((row) => {
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
      setSavingAll(false);
      setIsDirty(false);
      setOperationStatus({
        isVisible: true,
        status: "success",
        message: `${cleanRecords.length} ${t("toast.rowsSavedSuccess", "개 행이 성공적으로 저장되었습니다.")}`,
        autoClose: true,
      });
      onUpload?.("change_rows", payload);
      return;
    }

    APIcallPost(pocEndPoints?.SAVE_DATA_CHANGES, payload, {}, (responseData, status) => {
      setSavingAll(false);
      if (status === 200) {
        setIsDirty(false);
        fetchData();
        setOperationStatus({
          isVisible: true,
          status: "success",
          message: `${cleanRecords.length} ${t("toast.rowsSavedSuccess", "개 행이 성공적으로 저장되었습니다.")}`,
          autoClose: true,
        });
        onUpload?.("change_rows", payload);
      } else {
        console.error("저장 실패:", responseData);
        setOperationStatus({
          isVisible: true,
          status: "error",
          message: t("toast.saveError", "저장에 실패했습니다."),
          autoClose: true,
        });
      }
    });
  }, [allRecords, changedDataId, onUpload, fetchData, t]);

  // ── Export filtered view ──────────────────────────────────────────────────
  const handleExport = () => {
    if (filtered.length === 0) {
      setOperationStatus({
        isVisible: true,
        status: "error",
        message: t("toast.noRecordsExport", "내보낼 데이터가 없습니다."),
        autoClose: true,
      });
      return;
    }
    try {
      const exportData = filtered.map((row) => {
        const out = {};
        TABLE_COLUMNS.forEach((col) => {
          out[columnLabel(col, t)] = getColValue(row, col) ?? "";
        });
        return out;
      });
      const ws = XLSX.utils.json_to_sheet(exportData, {
        header: TABLE_COLUMNS.map((c) => columnLabel(c, t)),
      });
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

  const handleRowClick = (row) => {
    onOpenDetail?.(row);
  };

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
        .mp-page { color: var(--ref-text-primary, #0f172a); }
        .mp-page-header { margin-bottom: 20px; }
        .mp-page-title {
          color: var(--ref-text-primary, #0f172a);
          font-size: 28px;
          font-weight: 900;
          line-height: 1.15;
        }
        .mp-page-subtitle {
          margin-top: 8px;
          color: var(--ref-text-muted, #94a3b8);
          font-size: 14px;
          font-weight: 500;
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
          z-index: 50;
        }
        .mp-filter-item {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .mp-filter-item label {
          color: var(--ref-text-muted, #94a3b8);
          font-size: 13px;
          font-weight: 800;
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
          height: calc(100vh - 310px);
          min-height: 258px;
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
            <h1 className="mp-page-title">{t("page.mp.title", "MP List 조회")}</h1>
            <p className="mp-page-subtitle">
              {t("page.mp.desc", "보전파트별 대표 작업명을 최신순으로 조회합니다.")}
              {isDirty && (
                <span style={{ color: "#16a34a", fontWeight: 600, marginLeft: "8px" }}>
                  {t("page.mp.pending", "저장되지 않은 변경사항이 있습니다. 저장하기를 눌러주세요.")}
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="btn-base btn-secondary"
              onClick={() => {
                if (!selectedProcessId || !selectedMaintenanceId) {
                  setOperationStatus({
                    isVisible: true,
                    status: "warning",
                    message: `${t("field.process")} / ${t("field.maintenance")} ${t("app.search")}`,
                    autoClose: true,
                  });
                  return;
                }
                setNewRow({
                  ...EMPTY_ROW,
                  workedOn: new Date().toISOString().slice(0, 10)
                });
                setEditingRowLocalId(null);
                setModalError("");
                setErrors({});
                setShowModal(true);
              }}
            >
              <i className="fas fa-plus mr-1.5" />{t("page.mp.addRow", "행 추가")}
            </button>

            <button
              type="button"
              className="btn-base"
              style={{
                background: "#16a34a",
                color: "#fff",
                border: "none",
                cursor: isDirty ? "pointer" : "not-allowed",
                opacity: isDirty ? 1 : 0.65,
                boxShadow: isDirty ? "0 10px 24px rgba(22, 163, 74, 0.2)" : "none",
              }}
              onClick={handleSaveAll}
              disabled={!isDirty || savingAll}
              title={
                !isDirty ? t("app.noData", "저장할 변경사항이 없습니다.") : t("app.save", "저장")
              }
            >
              {savingAll ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-1.5" />
                  {t("app.saving", "저장 중...")}
                </>
              ) : (
                <>
                  <i className="fas fa-save mr-1.5" />
                  {t("page.mp.saveButton", "저장하기")}
                </>
              )}
            </button>

            <button type="button" className="btn-base btn-primary" onClick={handleExport}>
              <i className="fas fa-file-export mr-1.5" />
              {t("app.exportCsv", "CSV 내보내기")}
            </button>
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

          {/* Maintenance Filter */}
          <div className="mp-filter-item">
            <label>{t("field.maintenance", "보전파트")}</label>
            {filterLoading ? (
              <SelectSkeleton width="130px" />
            ) : (
              <select
                className="input-base"
                value={selectedMaintenanceId ?? ""}
                onChange={handleMaintenanceChange}
                disabled={maintenanceList.length === 0}
                style={{ width: "130px" }}
              >
                <option value="">{t("app.all", "전체")}</option>
                {maintenanceList.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.maintenanceGroupName}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Site Filter (Hidden site input as in index.html to match bindings) */}
          <div className="hidden">
            <select value={selectedSiteId ?? ""}>
              <option value="">{t("app.all")}</option>
              {siteList.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.siteName}
                </option>
              ))}
            </select>
          </div>

          {/* Representative Work Filter (Multi-select) */}
          <div className="mp-filter-item">
            <label>{t("field.repWork", "대표작업명")}</label>
            {filterLoading ? (
              <SelectSkeleton width="180px" />
            ) : (
              <div style={{ width: "180px" }}>
                <MultiSelect
                  options={repWorkOptions}
                  selectedValues={selectedRepWorks}
                  onChange={setSelectedRepWorks}
                  placeholder={t("app.all", "전체")}
                  t={t}
                />
              </div>
            )}
            {!filterLoading && (
              <span
                style={{
                  color: "var(--brand-60, #0f62fe)",
                  fontSize: "11px",
                  fontWeight: "bold",
                  marginLeft: "4px"
                }}
              >
                ({repWorkOptions.length}개)
              </span>
            )}
          </div>

          {/* Priority Filter (Multi-select) */}
          <div className="mp-filter-item">
            <label>
              {t("field.priority", "중요도")}{" "}
              <span className="text-red-500">*</span>
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
            </div>
          </div>
        </div>

        {/* ── Table or Empty Landing state ── */}
        <div className="card mp-table-card overflow-hidden">
            {dataLoading ? (
              <TableSkeleton rows={6} t={t} />
            ) : (
              <div className="mp-table-scroll overflow-auto">
                <table
                  className="min-w-full text-left text-sm"
                  style={{ tableLayout: "fixed", width: "100%", minWidth: "1280px" }}
                >
                  <colgroup>
                    <col style={{ width: "3%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "6%" }} />
                    <col style={{ width: "6%" }} />
                    <col style={{ width: "6%" }} />
                    <col style={{ width: "5%" }} />
                    <col style={{ width: "5%" }} />
                    <col style={{ width: "5%" }} />
                    <col style={{ width: "5%" }} />
                    <col style={{ width: "5%" }} />
                    <col style={{ width: "5%" }} />
                    <col style={{ width: "6%" }} />
                    <col style={{ width: "9%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "10%" }} />
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
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={15} className="text-center py-10 text-text-subtle text-sm">
                          {t("empty.noMatch", "조건에 맞는 데이터가 없습니다.")}
                        </td>
                      </tr>
                    ) : (
                      filtered.map((row, index) => {
                        const woCode = getColValue(row, "wOCode");
                        const isUser = !woCode || woCode === "—";
                        const isPending = !!row._pending;
                        const detailKey = rowKey(row, index);
                        const isSelected = isRowSelected(row, drawerItem);

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
                          className={`mp-row-clickable border-t border-border-base hover:bg-fill-active${isPending ? " mp-row-pending" : ""}${isUser ? " user-row" : ""}${isSelected ? " mp-row-selected" : ""}`}
                        >
                          <td className="text-center px-1 py-2">
                            {isUser && (
                              <button
                                type="button"
                                className="mp-del-btn"
                                onClick={(e) => handleDeleteRow(e, row)}
                                title={t("app.delete", "삭제")}
                              >
                                <i className="fas fa-trash-alt text-xs" />
                              </button>
                            )}
                          </td>
                          {TABLE_COLUMNS.map((col) => {
                            if (col === "priority") {
                              const val = getColValue(row, "priority") || "일반";
                              return (
                                <td key={col} className="px-3 py-2">
                                  <select
                                    className="mp-inline-select"
                                    value={val}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => handleInlineChange(row, "priority", e.target.value)}
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
                                    onChange={(e) => handleInlineChange(row, "category", e.target.value)}
                                  >
                                    <option value="생산성">{t("category.productivity", "생산성")}</option>
                                    <option value="품질">{t("category.quality", "품질")}</option>
                                    <option value="보전성">{t("category.maintenance", "보전성")}</option>
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
                                <td key={col} className="px-3 py-2 text-text-subtle whitespace-nowrap text-xs">
                                  {formatWorkedOn(getColValue(row, "workedOn"))}
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
                                    <span className="user-badge">
                                      {t("app.userRow", "사용자")}
                                    </span>
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
          </div>
      </section>

      {/* ── Add/Edit row modal ── */}
      <Modal
        open={showModal}
        title={editingRowLocalId !== null ? t("page.mp.modalEditTitle", "MP List 행 수정") : t("page.mp.modalTitle", "MP List 행 추가")}
        description={editingRowLocalId !== null ? t("page.mp.modalEditDesc", "항목 정보를 수정합니다.") : t("page.mp.modalDesc", "새로운 항목을 추가합니다. W/O코드는 자동으로 비워지며, 시스템 데이터와 구분됩니다.")}
        onClose={() => {
          setShowModal(false);
          setEditingRowLocalId(null);
          setErrors({});
        }}
        headerBg="var(--accent-soft, #ecfeff)"
        titleIcon={
          <i
            className={`fas ${editingRowLocalId !== null ? "fa-edit" : "fa-plus-circle"} mr-2`}
            style={{ color: "var(--accent, #06b6d4)" }}
          ></i>
        }
        maxWidth="640px"
        footer={
          <button
            type="button"
            className="btn-base btn-primary"
            onClick={handleModalAdd}
          >
            <i className="fas fa-check mr-1.5" />
            {editingRowLocalId !== null ? t("app.edit", "수정하기") : t("page.mp.addButton", "추가하기")}
          </button>
        }
      >
        <div className="space-y-3">
          {/* Grid 1: Process and Maintenance Part (read-only) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-text-subtle">
                {t("field.process", "공정")}
              </label>
              <input
                type="text"
                className="input-base w-full mt-1"
                value={
                  processList.find((p) => p.id === selectedProcessId)
                    ?.processName ?? ""
                }
                readOnly
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-text-subtle">
                {t("field.maintenance", "보전파트")}
              </label>
              <input
                type="text"
                className="input-base w-full mt-1"
                value={
                  (filterPayload?.maintenance ?? []).find(
                    (m) => m.id === selectedMaintenanceId
                  )?.maintenanceGroupName ?? ""
                }
                readOnly
              />
            </div>
          </div>

          {/* Grid 2: Representative Work and Work Purpose */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-text-subtle">
                {t("field.repWork", "대표작업명")}{" "}
                <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="input-base w-full mt-1"
                value={newRow.representativeWork}
                onChange={(e) => setField("representativeWork", e.target.value)}
                placeholder={t("placeholder.representativeWorkInput", "대표작업명 입력")}
                style={{
                  borderColor: errors.representativeWork ? "var(--color-text-danger, #dc2626)" : undefined,
                  borderWidth: errors.representativeWork ? "1.5px" : undefined
                }}
              />
              {errors.representativeWork && (
                <span className="mt-1 block text-[11px] font-semibold text-red-500 animate-fade-in">
                  <i className="fas fa-exclamation-circle mr-1" />
                  {errors.representativeWork}
                </span>
              )}
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-text-subtle">
                {t("field.work", "작업 목적")}{" "}
                <span className="text-red-500">*</span>
              </label>
              <input
                className="input-base w-full mt-1"
                value={newRow.work}
                onChange={(e) => setField("work", e.target.value)}
                placeholder={t(
                  "placeholder.workPurposeInput",
                  "작업 목적 입력"
                )}
                style={{
                  borderColor: errors.work ? "var(--color-text-danger, #dc2626)" : undefined,
                  borderWidth: errors.work ? "1.5px" : undefined
                }}
              />
              {errors.work && (
                <span className="mt-1 block text-[11px] font-semibold text-red-500 animate-fade-in">
                  <i className="fas fa-exclamation-circle mr-1" />
                  {errors.work}
                </span>
              )}
            </div>
          </div>

          {/* Grid 3: Problem Symptom and Problem Cause */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-text-subtle">
                {t("field.situation", "문제 현상")}{" "}
                <span className="text-red-500">*</span>
              </label>
              <input
                className="input-base w-full mt-1"
                value={newRow.situation}
                onChange={(e) => setField("situation", e.target.value)}
                placeholder={t(
                  "placeholder.situationInput",
                  "문제 현상 입력"
                )}
                style={{
                  borderColor: errors.situation ? "var(--color-text-danger, #dc2626)" : undefined,
                  borderWidth: errors.situation ? "1.5px" : undefined
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
              <label className="text-[10px] font-bold uppercase tracking-wider text-text-subtle">
                {t("field.cause", "문제 원인")}{" "}
                <span className="text-red-500">*</span>
              </label>
              <input
                className="input-base w-full mt-1"
                value={newRow.cause}
                onChange={(e) => setField("cause", e.target.value)}
                placeholder={t("placeholder.causeInput", "문제 원인 입력")}
                style={{
                  borderColor: errors.cause ? "var(--color-text-danger, #dc2626)" : undefined,
                  borderWidth: errors.cause ? "1.5px" : undefined
                }}
              />
              {errors.cause && (
                <span className="mt-1 block text-[11px] font-semibold text-red-500 animate-fade-in">
                  <i className="fas fa-exclamation-circle mr-1" />
                  {errors.cause}
                </span>
              )}
            </div>
          </div>

          {/* Grid 4: BOM and Spare Part */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-text-subtle">
                BOM
              </label>
              <textarea
                className="input-base w-full mt-1"
                value={newRow.bom}
                onChange={(e) => setField("bom", e.target.value)}
                rows={2}
                placeholder={t("placeholder.bomInput", "BOM 입력 (줄바꿈 가능)")}
                style={{ resize: "vertical" }}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-text-subtle">
                {t("field.sparePart", "자재명")}
              </label>
              <textarea
                className="input-base w-full mt-1"
                value={newRow.sparePart}
                onChange={(e) => setField("sparePart", e.target.value)}
                rows={2}
                placeholder={t(
                  "placeholder.sparePartInput",
                  "자재명 입력 (줄바꿈 가능)"
                )}
                style={{ resize: "vertical" }}
              />
            </div>
          </div>

          {/* Grid 5: HW Before and HW After */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-text-subtle">
                {t("field.hwBefore", "HW 변경 전")}{" "}
                <span className="text-red-500">*</span>
              </label>
              <input
                className="input-base w-full mt-1"
                value={newRow.hwAsWas}
                onChange={(e) => setField("hwAsWas", e.target.value)}
                placeholder={t("field.hwBefore", "HW 변경 전")}
                style={{
                  borderColor: errors.hwAsWas ? "var(--color-text-danger, #dc2626)" : undefined,
                  borderWidth: errors.hwAsWas ? "1.5px" : undefined
                }}
              />
              {errors.hwAsWas && (
                <span className="mt-1 block text-[11px] font-semibold text-red-500 animate-fade-in">
                  <i className="fas fa-exclamation-circle mr-1" />
                  {errors.hwAsWas}
                </span>
              )}
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-text-subtle">
                {t("field.hwAfter", "HW 변경 후")}{" "}
                <span className="text-red-500">*</span>
              </label>
              <input
                className="input-base w-full mt-1"
                value={newRow.hwAsIs}
                onChange={(e) => setField("hwAsIs", e.target.value)}
                placeholder={t("field.hwAfter", "HW 변경 후")}
                style={{
                  borderColor: errors.hwAsIs ? "var(--color-text-danger, #dc2626)" : undefined,
                  borderWidth: errors.hwAsIs ? "1.5px" : undefined
                }}
              />
              {errors.hwAsIs && (
                <span className="mt-1 block text-[11px] font-semibold text-red-500 animate-fade-in">
                  <i className="fas fa-exclamation-circle mr-1" />
                  {errors.hwAsIs}
                </span>
              )}
            </div>
          </div>

          {/* Grid 6: SW Before and SW After */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-text-subtle">
                {t("field.swBefore", "SW 변경 전")}{" "}
                <span className="text-red-500">*</span>
              </label>
              <input
                className="input-base w-full mt-1"
                value={newRow.swAsWas}
                onChange={(e) => setField("swAsWas", e.target.value)}
                placeholder={t("field.swBefore", "SW 변경 전")}
                style={{
                  borderColor: errors.swAsWas ? "var(--color-text-danger, #dc2626)" : undefined,
                  borderWidth: errors.swAsWas ? "1.5px" : undefined
                }}
              />
              {errors.swAsWas && (
                <span className="mt-1 block text-[11px] font-semibold text-red-500 animate-fade-in">
                  <i className="fas fa-exclamation-circle mr-1" />
                  {errors.swAsWas}
                </span>
              )}
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-text-subtle">
                {t("field.swAfter", "SW 변경 후")}{" "}
                <span className="text-red-500">*</span>
              </label>
              <input
                className="input-base w-full mt-1"
                value={newRow.swAsIs}
                onChange={(e) => setField("swAsIs", e.target.value)}
                placeholder={t("field.swAfter", "SW 변경 후")}
                style={{
                  borderColor: errors.swAsIs ? "var(--color-text-danger, #dc2626)" : undefined,
                  borderWidth: errors.swAsIs ? "1.5px" : undefined
                }}
              />
              {errors.swAsIs && (
                <span className="mt-1 block text-[11px] font-semibold text-red-500 animate-fade-in">
                  <i className="fas fa-exclamation-circle mr-1" />
                  {errors.swAsIs}
                </span>
              )}
            </div>
          </div>

          {/* Grid 7: Priority, Category, and Completion Date */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-text-subtle">
                {t("field.priority", "중요도")}{" "}
                <span className="text-red-500">*</span>
              </label>
              <select
                className="input-base w-full mt-1"
                value={newRow.priority}
                onChange={(e) => setField("priority", e.target.value)}
              >
                <option value="일반">{t("priority.normal", "일반")}</option>
                <option value="중요">{t("priority.high", "중요")}</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-text-subtle">
                {t("field.category", "효과 유형")}{" "}
                <span className="text-red-500">*</span>
              </label>
              <select
                className="input-base w-full mt-1"
                value={newRow.category}
                onChange={(e) => setField("category", e.target.value)}
              >
                <option value="기타">{t("category.etc", "기타")}</option>
                <option value="생산성">
                  {t("category.productivity", "생산성")}
                </option>
                <option value="품질">{t("category.quality", "품질")}</option>
                <option value="보전성">
                  {t("category.maintenance", "보전성")}
                </option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-text-subtle">
                {t("field.workedOn", "작업완료일")}{" "}
                <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                className="input-base w-full mt-1"
                value={newRow.workedOn}
                onChange={(e) => setField("workedOn", e.target.value)}
                style={{
                  borderColor: errors.workedOn ? "var(--color-text-danger, #dc2626)" : undefined,
                  borderWidth: errors.workedOn ? "1.5px" : undefined
                }}
              />
              {errors.workedOn && (
                <span className="mt-1 block text-[11px] font-semibold text-red-500 animate-fade-in">
                  <i className="fas fa-exclamation-circle mr-1" />
                  {errors.workedOn}
                </span>
              )}
            </div>
          </div>
        </div>
      </Modal>

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
