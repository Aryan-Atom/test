import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import Modal from "../components/Modal.jsx";
import { pocEndPoints } from "../axios/endPoints.js";
import { APIcallGet, APIcallPost } from "../axios/apiCall.js";
import { useI18n } from "../i18n.jsx";
import * as XLSX from "xlsx";

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

// FIX: Added missing required API fields — report, equipmentCode, equipmentName
// `work` maps to Purpose, `report` is a new required field (보고서/점검 보고)
const EMPTY_ROW = {
  representativeWork: "",
  work: "", // → Purpose
  report: "", // → Report (NEW — required by API)
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
  equipmentCode: "-", // → EquipmentCode (NEW — required by API)
  equipmentName: " Common", // → EquipmentName (NEW — required by API)
  // filter linkage — filled from selected dropdowns
  process: "",
  maintGroup: "",
  site: "",
};

// ─────────────────────────────────────────────────────────────────────────────
// Unique composite row key
// ─────────────────────────────────────────────────────────────────────────────
function rowKey(row, index) {
  return `${index}__${row.id ?? ""}__${row.equipmentCode ?? ""}__${row.representativeWork ?? row.work ?? ""}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// SelectSkeleton — shimmer while dropdown options load
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
// TableSkeleton — shimmer rows while data loads
// ─────────────────────────────────────────────────────────────────────────────
function TableSkeleton({ rows = 6, t }) {
  return (
    <div className="overflow-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="table-header">
          <tr>
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

// ─────────────────────────────────────────────────────────────────────────────
// Priority badge colours
// ─────────────────────────────────────────────────────────────────────────────
function PriorityBadge({ value }) {
  const colors = {
    중요: { bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
    일반: { bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" },
  };
  const style = colors[value] ?? { bg: "#f3f4f6", color: "#6b7280", border: "#e5e7eb" };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "9999px",
        fontSize: "11px",
        fontWeight: 600,
        background: style.bg,
        color: style.color,
        border: `1px solid ${style.border}`,
        whiteSpace: "nowrap",
      }}
    >
      {value ?? "—"}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section divider used inside the modal
// ─────────────────────────────────────────────────────────────────────────────
function ModalSection({ title }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        marginTop: "4px",
        marginBottom: "-4px",
      }}
    >
      <span
        style={{
          fontSize: "11px",
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--color-text-subtle, #6b7280)",
          whiteSpace: "nowrap",
        }}
      >
        {title}
      </span>
      <div style={{ flex: 1, height: "1px", background: "var(--color-border-base, #e5e7eb)" }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main MPList component
// ─────────────────────────────────────────────────────────────────────────────
const DETAIL_FIELDS = [
  { labelKey: "field.repWork", keys: ["representativeWork", "대표 작업명", "대표작업명"] },
  { labelKey: "field.equipmentCode", keys: ["equipmentCode", "설비코드"] },
  { labelKey: "field.woCode", keys: ["wOCode", "W/O코드"] },
  { labelKey: "field.process", keys: ["process", "공정"] },
  { labelKey: "field.equipmentName", keys: ["equipmentName", "설비명"] },
  { labelKey: "field.maintenance", keys: ["maintGroup", "보전파트", "보전그룹"] },
  { labelKey: "field.site", keys: ["site", "법인", "사이트"] },
  { labelKey: "field.work", keys: ["work", "작업 목적", "작업목적"] },
  { labelKey: "field.situation", keys: ["situation", "문제 현상"] },
  { labelKey: "field.cause", keys: ["cause", "문제 원인"] },
  { labelKey: "field.bom", keys: ["bom", "BOM"] },
  { labelKey: "field.sparePart", keys: ["sparePart", "자재명"] },
  { labelKey: "field.hwBefore", keys: ["hwAsWas", "HW 변경 전"] },
  { labelKey: "field.hwAfter", keys: ["hwAsIs", "HW 변경 후"] },
  { labelKey: "field.swBefore", keys: ["swAsWas", "SW 변경 전"] },
  { labelKey: "field.swAfter", keys: ["swAsIs", "SW 변경 후"] },
  { labelKey: "field.report", keys: ["report", "Report내용", "보고서"] },
  { labelKey: "field.workedOn", keys: ["workedOn", "작업완료일"], type: "date" },
  { labelKey: "field.priority", keys: ["priority", "중요도"] },
  { labelKey: "field.category", keys: ["category", "효과 유형"] },
];

function getDetailValue(row, keys) {
  for (const key of keys) {
    const value = row?.[key];
    if (value == null) continue;
    const text = String(value).trim();
    if (text && text.toLowerCase() !== "nan") return value;
  }
  return "";
}

function MPDetailDrawer({ row, onClose, formatWorkedOn, t }) {
  if (!row) return null;

  const woCode = getDetailValue(row, ["wOCode", "W/O코드"]);
  const equipmentName = getDetailValue(row, ["equipmentName", "설비명"]);
  const equipmentCode = getDetailValue(row, ["equipmentCode", "설비코드"]);

  return (
    <aside className="mp-detail-drawer" aria-label={t("drawer.title")}>
      <div className="mp-detail-drawer-header">
        <div>
          <h2 className="text-lg font-bold text-text-default">{t("drawer.title")}</h2>
          <p className="mt-0.5 text-xs font-semibold text-text-subtlest">
            {t("field.woCode")}: {woCode || "N/A"} {equipmentName ? `| ${t("field.equipmentName")}: ${equipmentName}` : ""}
            {equipmentCode ? ` (${equipmentCode})` : ""}
          </p>
        </div>
        <button type="button" onClick={onClose} className="mp-detail-close" aria-label={t("app.close")}>
          <i className="fas fa-times" />
        </button>
      </div>

      <div className="mp-detail-drawer-body">
        <div className="mp-detail-card">
          <div className="mp-detail-card-title">{t("detail.record")}</div>
          <dl className="mp-detail-grid">
            {DETAIL_FIELDS.map((field) => {
              const rawValue = getDetailValue(row, field.keys);
              const value = field.type === "date" ? formatWorkedOn(rawValue) : rawValue;
              return (
                <div className="mp-detail-row" key={field.labelKey}>
                  <dt>{t(field.labelKey)}</dt>
                  <dd>{value || "—"}</dd>
                </div>
              );
            })}
          </dl>
        </div>
      </div>
    </aside>
  );
}

export default function MPList({ onAddRow, onExport, searchText }) {
  const { t } = useI18n();
  // ── Filter state ──────────────────────────────────────────────────────────
  const [selectedProcessId, setSelectedProcessId] = useState(null);
  const [selectedSiteId, setSelectedSiteId] = useState(null);
  const [selectedMaintenanceId, setSelectedMaintenanceId] = useState(null);
  const [selectedRepWorkId, setSelectedRepWorkId] = useState(null);
  const [selectedPriority, setSelectedPriority] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // ── API data ──────────────────────────────────────────────────────────────
  const [filterPayload, setFilterPayload] = useState(null);
  const [filterError, setFilterError] = useState(null);
  const [apiRows, setApiRows] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);

  // ── Local (unsaved) rows ──────────────────────────────────────────────────
  const [pendingRows, setPendingRows] = useState([]);
  const [savingAll, setSavingAll] = useState(false);

  // ── Modal ─────────────────────────────────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [newRow, setNewRow] = useState(EMPTY_ROW);
  const [modalError, setModalError] = useState("");
  const [selectedDetail, setSelectedDetail] = useState(null);

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

  const repWorkList = useMemo(() => {
    const all = filterPayload?.representations ?? [];
    if (!selectedProcessId && !selectedMaintenanceId) return all;
    return all.filter((r) => {
      const matchProc = !selectedProcessId || r.processId === selectedProcessId;
      const matchMaint = !selectedMaintenanceId || r.maintenanceGroupId === selectedMaintenanceId;
      return matchProc && matchMaint;
    });
  }, [filterPayload, selectedProcessId, selectedMaintenanceId]);

  const priorityList = useMemo(
    () => [...new Set((filterPayload?.priority ?? []).map((p) => p.priorityName).filter(Boolean))],
    [filterPayload],
  );

  const categoryList = useMemo(
    () => [...new Set((filterPayload?.category ?? []).map((c) => c.categoryName).filter(Boolean))],
    [filterPayload],
  );

  // ── Cascade reset handlers ────────────────────────────────────────────────
  const handleProcessChange = (e) => {
    const val = e.target.value;
    setSelectedProcessId(val === "" ? null : Number(val));
    setSelectedSiteId(null);
    setSelectedMaintenanceId(null);
    setSelectedRepWorkId(null);
  };

  const handleSiteChange = (e) => {
    const val = e.target.value;
    setSelectedSiteId(val === "" ? null : Number(val));
  };

  const handleMaintenanceChange = (e) => {
    const val = e.target.value;
    setSelectedMaintenanceId(val === "" ? null : Number(val));
    setSelectedRepWorkId(null);
  };

  const handleRepWorkChange = (e) => {
    const val = e.target.value;
    setSelectedRepWorkId(val === "" ? null : Number(val));
  };

  // Auto-select first item effects
  useEffect(() => {
    if (siteList.length > 0 && selectedProcessId !== null) setSelectedSiteId(siteList[0].id);
  }, [siteList]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (maintenanceList.length > 0 && selectedProcessId !== null)
      setSelectedMaintenanceId(maintenanceList[0].id);
  }, [maintenanceList]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (repWorkList.length > 0 && (selectedProcessId !== null || selectedMaintenanceId !== null))
      setSelectedRepWorkId(repWorkList[0].id);
  }, [repWorkList]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch filter options + changedDataJson rows ───────────────────────────
  const fetchData = useCallback(() => {
    setDataLoading(true);

    APIcallGet(`${pocEndPoints?.GET_FILTER_DATA}`, {}, (responseData, status) => {
      try {
        if (status === 200 && responseData) {
          const payload = responseData?.data || responseData;
          setFilterPayload(payload);
          setFilterError(null);

          const allRecords = [];
          if (Array.isArray(payload?.changedDataJson)) {
            payload.changedDataJson.forEach((item) => {
              try {
                if (item.content) {
                  const parsed =
                    typeof item.content === "string" ? JSON.parse(item.content) : item.content;
                  if (Array.isArray(parsed)) {
                    allRecords.push(...parsed.map((r) => ({ ...r, _sourceId: item.id })));
                  }
                }
              } catch (e) {
                console.warn("[MPList] Failed to parse changedDataJson content:", e);
              }
            });
            allRecords.sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
          }
          setApiRows(allRecords);
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
          setApiRows([]);
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
        setApiRows([]);
      } finally {
        setDataLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Merge pending + API rows ──────────────────────────────────────────────
  const allRows = useMemo(() => [...pendingRows, ...apiRows], [pendingRows, apiRows]);

  // ── Filtered rows ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const selProcess = processList.find((p) => p.id === selectedProcessId);
    const selSite = (filterPayload?.site ?? []).find((s) => s.id === selectedSiteId);
    const selMaint = (filterPayload?.maintenance ?? []).find((m) => m.id === selectedMaintenanceId);
    const selRepWork = (filterPayload?.representations ?? []).find(
      (r) => r.id === selectedRepWorkId,
    );

    return allRows.filter((item) => {
      const matchProc =
        !selectedProcessId || (item.process ?? item.공정) === (selProcess?.processName ?? "");
      const matchSite = !selectedSiteId || (item.site ?? item.사이트) === (selSite?.siteName ?? "");
      const matchMaint =
        !selectedMaintenanceId ||
        (item.maintGroup ?? item.보전그룹) === (selMaint?.maintenanceGroupName ?? "");
      const matchRep =
        !selectedRepWorkId ||
        (item.representativeWork ?? item.대표작업명) === (selRepWork?.representativeWorkName ?? "");
      const matchPri = !selectedPriority || item.priority === selectedPriority;
      const matchCat = !selectedCategory || item.category === selectedCategory;

      let matchDate = true;
      if (dateFrom || dateTo) {
        const raw = item.workedOn ?? item.작업완료일;
        let d = null;
        if (raw) {
          if (!isNaN(Number(raw))) {
            d = new Date(new Date(1899, 11, 30).getTime() + Number(raw) * 86400000);
          } else {
            d = new Date(raw);
          }
        }
        if (d && !isNaN(d)) {
          const iso = d.toISOString().slice(0, 10);
          if (dateFrom && iso < dateFrom) matchDate = false;
          if (dateTo && iso > dateTo) matchDate = false;
        } else {
          matchDate = false;
        }
      }

      const text = Object.values(item)
        .map((v) => String(v ?? ""))
        .join(" ")
        .toLowerCase();
      const matchSearch = searchText ? text.includes(searchText.toLowerCase()) : true;

      return (
        matchProc &&
        matchSite &&
        matchMaint &&
        matchRep &&
        matchPri &&
        matchCat &&
        matchDate &&
        matchSearch
      );
    });
  }, [
    allRows,
    processList,
    filterPayload,
    selectedProcessId,
    selectedSiteId,
    selectedMaintenanceId,
    selectedRepWorkId,
    selectedPriority,
    selectedCategory,
    dateFrom,
    dateTo,
    searchText,
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

  // ── Modal add: push to pendingRows ────────────────────────────────────────
  const handleModalAdd = () => {
    // Validate the 9 fields from the mockup form
    if (
      !newRow.representativeWork ||
      !newRow.work ||
      !newRow.situation ||
      !newRow.cause ||
      !newRow.hwAsWas ||
      !newRow.hwAsIs ||
      !newRow.swAsWas ||
      !newRow.swAsIs ||
      !newRow.workedOn
    ) {
      setModalError(
        t("page.mp.requiredError"),
      );
      return;
    }
    setModalError("");

    const selProcess = processList.find((p) => p.id === selectedProcessId);
    const selMaint = (filterPayload?.maintenance ?? []).find((m) => m.id === selectedMaintenanceId);
    const selSite = (filterPayload?.site ?? []).find((s) => s.id === selectedSiteId);

    const enrichedRow = {
      ...newRow,
      id: 0,
      _pending: true,
      _localId: Date.now(),
      process: selProcess?.processName ?? newRow.process,
      maintGroup: selMaint?.maintenanceGroupName ?? newRow.maintGroup,
      site: selSite?.siteName ?? newRow.site,
    };

    setPendingRows((prev) => [enrichedRow, ...prev]);
    setNewRow(EMPTY_ROW);
    setShowModal(false);

    setOperationStatus({
      isVisible: true,
      status: "success",
      message: `${t("page.mp.addRow")} ${t("app.add")}. ${t("page.mp.saveHint")}`,
      autoClose: true,
    });

    onAddRow?.(enrichedRow);
  };

  // ── Save all pending rows ─────────────────────────────────────────────────
  const handleSaveAll = useCallback(() => {
    if (pendingRows.length === 0) {
      setOperationStatus({
        isVisible: true,
        status: "error",
        message: t("toast.noNewRows", "저장할 새 행이 없습니다."),
        autoClose: true,
      });
      return;
    }

    setSavingAll(true);
    setOperationStatus({
      isVisible: true,
      status: "loading",
      message: t("toast.saving", "저장 중입니다..."),
      autoClose: false,
    });

    // FIX: strip internal-only keys (_pending, _localId, _sourceId) before POST
    const changeDataList = pendingRows.map(({ _pending, _localId, _sourceId, ...rest }) => ({
      ...rest,
      id: rest.id ?? 0,
    }));

    const payload = { changeDataList, id: 0 };

    APIcallPost(pocEndPoints?.SAVE_DATA_CHANGES, payload, {}, (responseData, status) => {
      setSavingAll(false);
      if (status === 200) {
        setPendingRows([]);
        fetchData();
        setOperationStatus({
          isVisible: true,
          status: "success",
          message: `${changeDataList.length} ${t("toast.rowsSavedSuccess", "개 행이 성공적으로 저장되었습니다.")}`,
          autoClose: true,
        });
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
  }, [pendingRows, fetchData, t]);

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
          out[columnLabel(col, t)] = row[col] ?? "";
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

  const setField = (key, val) => setNewRow((prev) => ({ ...prev, [key]: val }));
  const openDetailDrawer = (row, index) => {
    setSelectedDetail({ row, key: rowKey(row, index) });
  };
  const closeDetailDrawer = () => setSelectedDetail(null);

  useEffect(() => {
    if (!selectedDetail) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") closeDetailDrawer();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedDetail]);

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
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(-10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .mp-row-pending { background: #f0fdf4 !important; border-left: 3px solid #16a34a; }
        .mp-row-clickable { cursor: pointer; }
        .mp-row-selected { background: var(--fill-active, #ddeaff) !important; }
        .mp-detail-drawer {
          position: fixed;
          top: 0;
          right: 0;
          z-index: 60;
          display: flex;
          height: 100vh;
          width: min(480px, 100vw);
          flex-direction: column;
          border-left: 1px solid var(--border-base, #e6e9ef);
          background: var(--surface-default, #ffffff);
          box-shadow: -18px 0 36px rgba(17, 24, 39, 0.12);
          animation: mpDrawerIn 0.28s ease;
        }
        @keyframes mpDrawerIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .mp-detail-drawer-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          border-bottom: 1px solid var(--border-base, #e6e9ef);
          padding: 24px 20px 20px;
        }
        .mp-detail-close {
          display: inline-flex;
          height: 34px;
          width: 34px;
          flex: 0 0 auto;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          color: var(--text-subtlest, #7e8a9e);
          transition: background 0.18s ease, color 0.18s ease;
        }
        .mp-detail-close:hover {
          background: var(--surface-stronger, #f1f3f6);
          color: var(--text-default, #111827);
        }
        .mp-detail-drawer-body {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
        }
        .mp-detail-card {
          border: 1px solid var(--border-base, #e6e9ef);
          border-radius: 8px;
          background: var(--surface-default, #ffffff);
          padding: 16px 18px;
        }
        .mp-detail-card-title {
          margin-bottom: 14px;
          border-bottom: 1px solid var(--border-base, #e6e9ef);
          padding-bottom: 10px;
          color: var(--text-brand, #0f62fe);
          font-size: 12px;
          font-weight: 800;
        }
        .mp-detail-grid {
          display: grid;
          gap: 9px 0;
        }
        .mp-detail-row {
          display: grid;
          grid-template-columns: 128px minmax(0, 1fr);
          gap: 14px;
          font-size: 13px;
          line-height: 1.35;
        }
        .mp-detail-row dt {
          color: var(--text-subtlest, #7e8a9e);
          font-weight: 800;
          text-align: right;
          white-space: nowrap;
        }
        .mp-detail-row dd {
          margin: 0;
          color: var(--text-default, #111827);
          word-break: break-word;
        }
        @media (max-width: 640px) {
          .mp-detail-drawer { width: 100vw; }
          .mp-detail-row { grid-template-columns: 108px minmax(0, 1fr); }
        }
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
      `}</style>

      <section className="mp-page">
        {/* ── Page header ── */}
        <header className="mp-page-header flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="mp-page-title">{t("page.mp.title")}</h1>
            <p className="mp-page-subtitle">
              {t("page.mp.desc")}
              {pendingRows.length > 0 && (
                <span style={{ color: "#16a34a", fontWeight: 600, marginLeft: "8px" }}>
                  {t("page.mp.pending")} {pendingRows.length}{t("app.rows")} — {t("page.mp.saveHint")}
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
                setNewRow(EMPTY_ROW);
                setModalError("");
                setShowModal(true);
              }}
            >
              <i className="fas fa-plus mr-1.5" />{t("page.mp.addRow")}
            </button>

            <button
              type="button"
              className="btn-base"
              style={{
                background: "#16a34a",
                color: "#fff",
                border: "none",
                cursor: pendingRows.length > 0 ? "pointer" : "not-allowed",
                opacity: pendingRows.length > 0 ? 1 : 0.65,
                boxShadow: pendingRows.length > 0 ? "0 10px 24px rgba(22, 163, 74, 0.2)" : "none",
              }}
              onClick={handleSaveAll}
              disabled={pendingRows.length === 0 || savingAll}
              title={
                pendingRows.length === 0 ? t("app.noData") : `${pendingRows.length}${t("app.rows")} ${t("app.save")}`
              }
            >
              {savingAll ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-1.5" />
                  {t("app.saving")}
                </>
              ) : (
                <>
                  <i className="fas fa-save mr-1.5" />
                  {t("page.mp.saveButton")}{pendingRows.length > 0 ? ` (${pendingRows.length}${t("app.rows")})` : ""}
                </>
              )}
            </button>

            <button type="button" className="btn-base btn-primary" onClick={handleExport}>
              <i className="fas fa-file-export mr-1.5" />
              {t("app.exportCsv")}
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
            <label>{t("field.process")}</label>
            {filterLoading ? (
              <SelectSkeleton width="110px" />
            ) : (
              <select
                className="input-base"
                value={selectedProcessId ?? ""}
                onChange={handleProcessChange}
                style={{ width: "110px" }}
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

          {/* Maintenance Filter */}
          <div className="mp-filter-item">
            <label>{t("field.maintenance")}</label>
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
                <option value="">{t("app.all")}</option>
                {maintenanceList.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.maintenanceGroupName}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Hidden Site Filter to preserve logic/bindings */}
          <div className="hidden">
            {filterLoading ? (
              <SelectSkeleton />
            ) : (
              <select
                value={selectedSiteId ?? ""}
                onChange={handleSiteChange}
                disabled={siteList.length === 0}
              >
                <option value="">{t("app.all")}</option>
                {siteList.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.siteName}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Representative Work Filter with count badge */}
          <div className="mp-filter-item">
            <label>{t("field.repWork")}</label>
            {filterLoading ? (
              <SelectSkeleton width="180px" />
            ) : (
              <select
                className="input-base"
                value={selectedRepWorkId ?? ""}
                onChange={handleRepWorkChange}
                disabled={repWorkList.length === 0}
                style={{ width: "180px" }}
              >
                <option value="">{t("app.all")}</option>
                {repWorkList.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.representativeWorkName}
                  </option>
                ))}
              </select>
            )}
            {!dataLoading && (
              <span
                style={{
                  color: "var(--primary, #4f46e5)",
                  fontSize: "12px",
                  fontWeight: "bold",
                  marginLeft: "2px",
                }}
              >
                ({filtered.length}{lang === "ko" ? "개" : " rows"})
              </span>
            )}
          </div>

          {/* Priority Filter */}
          <div className="mp-filter-item">
            <label>
              {t("field.priority")}{" "}
              <span className="text-red-500">*</span>
            </label>
            {filterLoading ? (
              <SelectSkeleton width="120px" />
            ) : (
              <select
                className="input-base"
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
                style={{ width: "120px" }}
              >
                <option value="">{t("app.all")}</option>
                {priorityList.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Category Filter */}
          <div className="mp-filter-item">
            <label>{t("field.category")}</label>
            {filterLoading ? (
              <SelectSkeleton width="140px" />
            ) : (
              <select
                className="input-base"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                style={{ width: "140px" }}
              >
                <option value="">{t("app.all")}</option>
                {categoryList.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Period Filter */}
          <div className="mp-filter-item ml-auto">
            <label>{t("field.period")}</label>
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

        {/* ── Data table ── */}
        <div className="card mp-table-card overflow-hidden">
          {dataLoading ? (
            <TableSkeleton rows={6} t={t} />
          ) : filtered.length === 0 ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 p-10 text-center text-text-subtle">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-10 text-brand-60 text-3xl">
                <i className="fas fa-clipboard-list" />
              </div>
              <h2 className="text-xl font-bold text-text-default">{t("page.mp.emptyTitle")}</h2>
              <p>{t("page.mp.emptyDesc")}</p>
            </div>
          ) : (
            <div className="mp-table-scroll overflow-auto">
              <table
                className="min-w-full text-left text-sm"
                style={{ tableLayout: "fixed", width: "100%" }}
              >
                <colgroup>
                  <col style={{ width: "13%" }} />
                  <col style={{ width: "9%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "6%" }} />
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "6%" }} />
                  <col style={{ width: "6%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "9%" }} />
                </colgroup>
                <thead className="table-header" style={{ position: "sticky", top: 0, zIndex: 1 }}>
                  <tr>
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
                  {filtered.map((row, index) => {
                    const isPending = !!row._pending;
                    const detailKey = rowKey(row, index);
                    const isSelected = selectedDetail?.key === detailKey;
                    return (
                      <tr
                        key={detailKey}
                        role="button"
                        tabIndex={0}
                        aria-selected={isSelected}
                        onClick={() => openDetailDrawer(row, index)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openDetailDrawer(row, index);
                          }
                        }}
                        className={`mp-row-clickable border-t border-border-base hover:bg-fill-active${isPending ? " mp-row-pending" : ""}${isSelected ? " mp-row-selected" : ""}`}
                      >
                        {TABLE_COLUMNS.map((col) => {
                          if (col === "priority") {
                            return (
                              <td key={col} className="px-3 py-2.5">
                                <PriorityBadge value={row[col]} />
                              </td>
                            );
                          }
                          if (col === "workedOn") {
                            return (
                              <td
                                key={col}
                                className="px-3 py-2.5 text-text-subtle whitespace-nowrap text-xs"
                              >
                                {formatWorkedOn(row[col])}
                              </td>
                            );
                          }
                          return (
                            <td
                              key={col}
                              className="px-3 py-2.5 text-text-subtle text-xs"
                              style={{
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                maxWidth: "180px",
                              }}
                              title={String(row[col] ?? "")}
                            >
                              {row[col] == null || row[col] === "" ? "—" : String(row[col])}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <MPDetailDrawer
        row={selectedDetail?.row}
        onClose={closeDetailDrawer}
        formatWorkedOn={formatWorkedOn}
        t={t}
      />

      {/* ── Add row modal ── */}
      <Modal
        open={showModal}
        title={t("page.mp.modalTitle")}
        description={t("page.mp.modalDesc")}
        onClose={() => setShowModal(false)}
        headerBg="var(--accent-soft, #ecfeff)"
        titleIcon={
          <i
            className="fas fa-plus-circle mr-2"
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
            {t("page.mp.addButton", "추가하기")}
          </button>
        }
      >
        <div className="space-y-3">
          {modalError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              <i className="fas fa-exclamation-circle mr-1.5" />
              {modalError}
            </div>
          )}

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
              {filterLoading ? (
                <SelectSkeleton />
              ) : (
                <select
                  className="input-base w-full mt-1"
                  value={newRow.representativeWork}
                  onChange={(e) => setField("representativeWork", e.target.value)}
                >
                  <option value="">{t("app.all", "전체")}</option>
                  {repWorkList.map((item) => (
                    <option key={item.id} value={item.representativeWorkName}>
                      {item.representativeWorkName}
                    </option>
                  ))}
                </select>
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
              />
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
              />
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
              />
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
              />
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
              />
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
              />
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
              />
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
              />
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
