import { useEffect, useState, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { pocEndPoints } from "../axios/endPoints.js";
import { APIcallGet, APIcallPost } from "../axios/apiCall.js";
import { getUserInfo } from "../utils/cookieUtils.js";
import { useToast } from "./ToastContext.jsx";
import { useI18n } from "../i18n.jsx";

// Standard Master Data column sequence fallback
const DEFAULT_PREVIEW_COLUMNS = [
  { key: "site", label: "Site", labelKr: "법인", required: true },
  { key: "process", label: "Process", labelKr: "공정", required: true },
  { key: "maintGroup", label: "Maintenance Part", labelKr: "보전파트", required: true },
  { key: "equipmentCode", label: "Equipment Code", labelKr: "설비코드", required: true },
  { key: "equipmentName", label: "Equipment Name", labelKr: "설비명", required: true },
  { key: "woCode", label: "W/O Code", labelKr: "W/O코드", required: false },
  { key: "report", label: "Report", labelKr: "보고서 원문", required: false },
  { key: "bom", label: "BOM", labelKr: "BOM", required: false },
  { key: "sparePart", label: "Sparepart", labelKr: "자재목록", required: false },
  { key: "workedOn", label: "Work Date", labelKr: "작업완료일", required: false },
  { key: "work", label: "Improvement Work", labelKr: "개선 작업", required: false },
  { key: "purpose", label: "Work Purpose", labelKr: "작업목적", required: false },
  { key: "situation", label: "Problem Symptom", labelKr: "문제 현상", required: false },
  { key: "cause", label: "Problem Cause", labelKr: "문제 원인", required: false },
  { key: "hwAsWas", label: "HW Before", labelKr: "HW 변경 전", required: false },
  { key: "hwAsIs", label: "HW After", labelKr: "HW 변경 후", required: false },
  { key: "swAsWas", label: "SW Before", labelKr: "SW 변경 전", required: false },
  { key: "swAsIs", label: "SW After", labelKr: "SW 변경 후", required: false },
  { key: "representativeWork", label: "Rep Work Name", labelKr: "대표 작업명", required: true },
  { key: "priority", label: "Priority", labelKr: "중요도", required: true },
  { key: "category", label: "Effect Type", labelKr: "효과 유형", required: true },
  { key: "woType", label: "Wotype", labelKr: "작업타입", required: false },
];

const COLUMN_I18N_MAP = {
  equipmentCode: { en: "Equipment Code", ko: "설비코드" },
  equipment_code: { en: "Equipment Code", ko: "설비코드" },
  eqcode: { en: "Equipment Code", ko: "설비코드" },
  wOCode: { en: "W/O Code", ko: "W/O코드" },
  woCode: { en: "W/O Code", ko: "W/O코드" },
  wo_code: { en: "W/O Code", ko: "W/O코드" },
  process: { en: "Process", ko: "공정" },
  equipmentName: { en: "Equipment Name", ko: "설비명" },
  equipment_name: { en: "Equipment Name", ko: "설비명" },
  eqname: { en: "Equipment Name", ko: "설비명" },
  eqType: { en: "Maintenance Part", ko: "보전파트" },
  maintGroup: { en: "Maintenance Part", ko: "보전파트" },
  maintenance_part: { en: "Maintenance Part", ko: "보전파트" },
  workDate: { en: "Work Date", ko: "작업완료일" },
  workedOn: { en: "Work Date", ko: "작업완료일" },
  work_date: { en: "Work Date", ko: "작업완료일" },
  workedDate: { en: "Work Date", ko: "작업완료일" },
  site: { en: "Site", ko: "법인" },
  bom: { en: "BOM", ko: "BOM" },
  sparePart: { en: "Sparepart", ko: "자재목록" },
  sparepart: { en: "Sparepart", ko: "자재목록" },
  spare_part: { en: "Sparepart", ko: "자재목록" },
  woType: { en: "Wotype", ko: "작업타입" },
  wo_type: { en: "Wotype", ko: "작업타입" },
  representativeWork: { en: "Rep Work Name", ko: "대표 작업명" },
  representative_work_name: { en: "Rep Work Name", ko: "대표 작업명" },
  rep_name: { en: "Rep Work Name", ko: "대표 작업명" },
  report: { en: "Report", ko: "보고서 원문" },
  report_content: { en: "Report", ko: "보고서 원문" },
  work: { en: "Improvement Work", ko: "개선 작업" },
  purpose: { en: "Work Purpose", ko: "작업목적" },
  situation: { en: "Problem Symptom", ko: "문제 현상" },
  cause: { en: "Problem Cause", ko: "문제 원인" },
  hwAsWas: { en: "HW Before", ko: "HW 변경 전" },
  hwAsIs: { en: "HW After", ko: "HW 변경 후" },
  swAsWas: { en: "SW Before", ko: "SW 변경 전" },
  swAsIs: { en: "SW After", ko: "SW 변경 후" },
  priority: { en: "Priority", ko: "중요도" },
  category: { en: "Effect Type", ko: "효과 유형" },
};

function formatColumnHeader(col, language = "en") {
  if (!col) return "";
  const rawLabel = typeof col === "string" ? col : (col.label || col.key || "");
  const colKey = typeof col === "object" ? col.key : col;

  // 1. If rawLabel has format "Korean (English)" or "English (Korean)"
  const parenMatch = String(rawLabel).match(/^([^(]+)\s*\(([^)]+)\)$/);
  if (parenMatch) {
    const part1 = parenMatch[1].trim();
    const part2 = parenMatch[2].trim();
    const hasKorean1 = /[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/.test(part1);
    const hasKorean2 = /[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/.test(part2);

    let koText = part1;
    let enText = part2;
    if (hasKorean2 && !hasKorean1) {
      koText = part2;
      enText = part1;
    } else if (!hasKorean1 && !hasKorean2) {
      return language === "ko" ? (part1 || part2) : (part2 || part1);
    }

    return language === "ko" ? koText : enText;
  }

  // 2. Check COLUMN_I18N_MAP by colKey
  if (colKey && COLUMN_I18N_MAP[colKey]) {
    return language === "ko" ? COLUMN_I18N_MAP[colKey].ko : COLUMN_I18N_MAP[colKey].en;
  }

  // 3. Check by lowercase colKey
  const lowerKey = String(colKey || "").toLowerCase();
  for (const [k, v] of Object.entries(COLUMN_I18N_MAP)) {
    if (k.toLowerCase() === lowerKey) {
      return language === "ko" ? v.ko : v.en;
    }
  }

  // 4. Check if col has explicit labelKr or labelEn
  if (language === "ko" && col.labelKr) return col.labelKr;
  if (language === "en" && col.labelEn) return col.labelEn;

  return rawLabel;
}

function excelSerialToDate(serial) {
  if (!serial && serial !== 0) return "";
  if (typeof serial === "string") {
    const trimmed = serial.trim();
    if (!trimmed) return "";
    if (trimmed.includes("T")) return trimmed.split("T")[0];
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
    const num = Number(trimmed);
    if (isNaN(num)) return trimmed;
    serial = num;
  }
  if (typeof serial === "number" && !isNaN(serial) && serial > 0) {
    const utcDays = Math.floor(serial - 25569);
    const utcValue = utcDays * 86400;
    const dateInfo = new Date(utcValue * 1000);
    const year = dateInfo.getUTCFullYear();
    const month = String(dateInfo.getUTCMonth() + 1).padStart(2, "0");
    const day = String(dateInfo.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return String(serial);
}

function getFormattedDateString(raw) {
  if (!raw) return "";
  const dateStr = excelSerialToDate(raw);
  if (!dateStr) return "";
  return dateStr.slice(0, 10);
}

function formatValidDateIso(rawDate) {
  if (!rawDate || String(rawDate).startsWith("0000") || String(rawDate).startsWith("0001")) {
    return new Date().toISOString();
  }
  const p = new Date(rawDate);
  if (isNaN(p.getTime()) || p.getFullYear() < 2000) {
    return new Date().toISOString();
  }
  return p.toISOString();
}

function getPreviewCellValue(row, key) {
  if (!row) return "";
  const lowerKey = String(key || "").toLowerCase();
  if (
    lowerKey === "workedon" ||
    lowerKey === "workdate" ||
    lowerKey === "work_date" ||
    lowerKey === "workeddate" ||
    lowerKey === "worked_date" ||
    key === "작업완료일" ||
    key === "작업일자" ||
    (typeof key === "string" && key.includes("작업완료일"))
  ) {
    const raw =
      row.workDate ??
      row.workedOn ??
      row.work_date ??
      row.workedDate ??
      row.worked_date ??
      row["작업완료일"] ??
      row["작업일자"] ??
      "";
    return getFormattedDateString(raw) || String(raw || "");
  }
  if (lowerKey === "wocode" || lowerKey === "wo_code" || key === "W/O코드") {
    return row.woCode ?? row.wOCode ?? row.wo_code ?? row["W/O코드"] ?? "";
  }
  if (lowerKey === "wotype" || lowerKey === "wo_type" || key === "W/O타입") {
    return row.woType ?? row.Wotype ?? row.wotype ?? row.wo_type ?? row.woTypeName ?? "";
  }
  if (lowerKey === "maintgroup" || lowerKey === "eqtype" || key === "보전파트") {
    return row.maintGroup ?? row.eqType ?? row.maintenance_part ?? row["보전파트"] ?? "";
  }
  if (lowerKey === "equipmentcode" || lowerKey === "eqcode" || lowerKey === "equipment_code" || key === "설비코드") {
    return row.equipmentCode ?? row.equipment_code ?? row.Eqcode ?? row.eqcode ?? row["설비코드"] ?? "";
  }
  if (lowerKey === "equipmentname" || lowerKey === "eqname" || lowerKey === "equipment_name" || key === "설비명") {
    return row.equipmentName ?? row.equipment_name ?? row.Eqname ?? row.eqname ?? row["설비명"] ?? "";
  }
  if (lowerKey === "representativework" || lowerKey === "rep_name" || key === "대표 작업명") {
    return row.representativeWork ?? row.rep_name ?? row.representative_work_name ?? row["대표 작업명"] ?? "";
  }
  if (lowerKey === "sparepart" || lowerKey === "spare_part" || key === "자재목록") {
    return row.sparePart ?? row.sparepart ?? row["자재목록"] ?? "";
  }
  return row[key] ?? "";
}

function mapExportedRowToChangeData(row) {
  const currentUserName = getUserInfo()?.name || "Chirati Harish";
  const maintVal = row.maintenance_part || row.maintGroup || row.eqType || row["보전파트"] || "";
  const woTypeVal = row.Wotype || row.wotype || row.woType || row.wo_type || row["W/O타입"] || "";
  const woCodeVal = row.wOCode || row.woCode || row.wo_code || row["W/O코드"] || row["작업지시서 코드"] || "";
  const rawWorkDate =
    row.workDate ||
    row.work_date ||
    row.workedOn ||
    row.workedDate ||
    row.worked_date ||
    row["작업완료일"] ||
    row["작업일자"] ||
    "";
  const workedDate = getFormattedDateString(rawWorkDate) || rawWorkDate;
  const sparePartVal = row.sparepart || row.sparePart || row["자재목록"] || row["예비 부품"] || "";

  return {
    ...row,
    id: 0,
    site: row.site || "",
    process: row.process || "",
    maintGroup: maintVal,
    equipmentCode:
      row.equipment_code ||
      row.equipmentCode ||
      row.Eqcode ||
      row.eqcode ||
      row.eq_code ||
      row["설비코드"] ||
      "",
    equipmentName:
      row.equipment_name ||
      row.equipmentName ||
      row.Eqname ||
      row.eqname ||
      row.eq_name ||
      row["설비명"] ||
      "",
    woCode: woCodeVal,
    wOCode: woCodeVal,
    wo_code: woCodeVal,
    report: row.report || row.report_content || row.reportContent || row["Report내용"] || row["보고서"] || "",
    bom: row.bom || row.BOM || "",
    sparePart: sparePartVal,
    "자재목록": sparePartVal,
    workedOn: workedDate,
    workDate: workedDate,
    work_date: workedDate,
    workedDate: workedDate,
    work: row.improvements || row.work || row.work_description || row["개선 작업"] || row["작업"] || "",
    purpose: row.task_purpose || row.purpose || row["작업 목적"] || "",
    situation: row.problem_phenomenon || row.situation || row["문제 현상"] || row["상황"] || "",
    cause: row.problem_cause || row.cause || row["문제 원인"] || row["원인"] || "",
    hwAsWas: row.hw_before || row.hwAsWas || row["HW 변경 전"] || row["기존 하드웨어"] || "",
    hwAsIs: row.hw_after || row.hwAsIs || row["HW 변경 후"] || row["현 하드웨어"] || "",
    swAsWas: row.sw_before || row.swAsWas || row["SW 변경 전"] || row["기존 소프트웨어"] || "",
    swAsIs: row.sw_after || row.swAsIs || row["SW 변경 후"] || row["현 소프트웨어"] || "",
    representativeWork: row.rep_name || row.representativeWork || row["대표 작업명"] || row["대표 작업"] || "",
    priority: row.importance || row.priority || row["중요도"] || row["우선순위"] || "",
    category: row.effect_type || row.category || row["효과 유형"] || row["구분"] || "",
    woType: woTypeVal,
    woTypeId: 0,
    eqType: maintVal,
    eqTypeId: 0,
    representativeColor: "",
    processId: 0,
    categoryId: 0,
    priorityId: 0,
    siteId: 0,
    maintenanceId: 0,
    equipmentId: 0,
    createdBy: currentUserName,
    is_voc: false,
    isVoc: false,
    Wotype: woTypeVal,
    wo_type: woTypeVal,
    woTypeName: woTypeVal,
  };
}

export default function JobPreviewModal({
  job,
  onClose,
  isEditAndDeleteOptionIsRequired: propIsRequired,
}) {
  const isEditAndDeleteOptionIsRequired =
    propIsRequired !== undefined
      ? Boolean(propIsRequired)
      : (() => {
          const envVal =
            import.meta.env.VITE_IS_EDIT_AND_DELETE_OPTION_IS_REQUIRED_FOR_JOB_PREVIEW_MODAL ??
            "false";
          return (
            String(envVal).trim().replace(/^['"]|['"]$/g, "").toLowerCase() === "true"
          );
        })();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [totalRows, setTotalRows] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editingCell, setEditingCell] = useState(null); // { rowIdx, key }
  const [cellValue, setCellValue] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [masterColumns, setMasterColumns] = useState(null);
  const [apiColumns, setApiColumns] = useState(null);
  const [downloadingExport, setDownloadingExport] = useState(false);
  const [duplicateAlert, setDuplicateAlert] = useState(null);
  const [duplicateRowsCount, setDuplicateRowsCount] = useState(0);

  const navigate = useNavigate();
  const { pushToast } = useToast();
  const { language, t } = useI18n();

  // Fetch Master Data column sequence from API
  useEffect(() => {
    APIcallGet(`${pocEndPoints.CHANGE_DATA_COLUMNS}/1`, {}, (responseData, status) => {
      if (status === 200 && responseData) {
        const cols = Array.isArray(responseData)
          ? responseData
          : Array.isArray(responseData?.data)
          ? responseData.data
          : null;
        if (cols && cols.length > 0) {
          const sorted = [...cols].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
          setMasterColumns(sorted);
        }
      }
    });
  }, []);

  const previewColumns = useMemo(() => {
    if (masterColumns && masterColumns.length > 0) {
      const mapped = masterColumns
        .map((mc) => {
          const key = mc.jsonKey || mc.excelColumnName;
          const match = DEFAULT_PREVIEW_COLUMNS.find((c) => {
            const ck = c.key.toLowerCase();
            const k = (key || "").toLowerCase();
            if (ck === k) return true;
            if (
              ck === "workedon" &&
              (k === "workdate" ||
                k === "work_date" ||
                k === "workeddate" ||
                k === "worked_date" ||
                k === "작업완료일" ||
                k === "작업일자")
            ) {
              return true;
            }
            if (ck === "wocode" && (k === "wo_code" || k === "작업지시서 코드")) return true;
            if (ck === "wotype" && (k === "wo_type" || k === "w/o타입")) return true;
            if (ck === "maintgroup" && (k === "eqtype" || k === "maintenance_part" || k === "보전파트")) return true;
            if (ck === "sparepart" && (k === "spare_part" || k === "자재목록")) return true;
            if (ck === "representativework" && (k === "rep_name" || k === "representative_work_name" || k === "대표 작업명")) return true;
            return false;
          });
          return {
            key: match ? match.key : key,
            label: match ? match.label : (mc.columnNameKr || mc.columnName || key),
            labelKr: match?.labelKr || mc.columnNameKr || key,
            labelEn: match?.label || mc.columnName || key,
            required: mc.isMandatory !== undefined ? Boolean(mc.isMandatory) : (match ? Boolean(match.required) : false),
          };
        })
        .filter(Boolean);
      if (mapped.length > 0) return mapped;
    }
    if (apiColumns && apiColumns.length > 0) {
      return apiColumns;
    }
    return DEFAULT_PREVIEW_COLUMNS;
  }, [masterColumns, apiColumns]);

  // Initial fetch: limit=50&offset=0
  useEffect(() => {
    let isMounted = true;
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        setError(null);
        setRows([]);
        setOffset(0);
        setHasMore(true);

        const baseUrl =
          pocEndPoints.AI_PIPELINE_GET_JOB_EXPORTS ||
          "http://107.108.32.188:8001/api/exports/json";
        const apiUrl = `${baseUrl}?limit=50&offset=0&job_id=${job.id}`;

        const response = await fetch(apiUrl, {
          headers: { accept: "application/json" },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch job export data (status: ${response.status})`);
        }

        const data = await response.json();
        if (isMounted) {
          if (Array.isArray(data?.column_keys) && data.column_keys.length > 0) {
            const colsFromApi = data.column_keys.map((k, i) => {
              const labelFromData = Array.isArray(data?.columns) ? data.columns[i] : k;
              const match = DEFAULT_PREVIEW_COLUMNS.find((c) => {
                const ck = c.key.toLowerCase();
                const lk = (k || "").toLowerCase();
                return (
                  ck === lk ||
                  (ck === "workedon" &&
                    (lk === "workdate" || lk === "work_date" || lk === "workeddate"))
                );
              });
              return {
                key: k,
                label: labelFromData || match?.label || k,
                labelKr: match?.labelKr,
                labelEn: match?.label,
                required: match ? Boolean(match.required) : false,
              };
            });
            setApiColumns(colsFromApi);
          }
          const rawRows = Array.isArray(data)
            ? data
            : Array.isArray(data?.rows)
            ? data.rows
            : Array.isArray(data?.data)
            ? data.data
            : [];
          const mappedRows = rawRows.map(mapExportedRowToChangeData);
          setRows(mappedRows);
          setOffset(50);
          setHasMore(rawRows.length === 50);
          if (data?.total != null) {
            setTotalRows(data.total);
          }
        }
      } catch (err) {
        console.error("Job export fetch error:", err);
        if (isMounted) setError(err.message || "Failed to load job export data.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    if (job?.id) {
      fetchInitialData();
    }
  }, [job]);

  // Load next 50 records on scroll
  const fetchMoreJobExportData = async () => {
    if (loadingMore || loading || !hasMore || !job?.id) return;
    try {
      setLoadingMore(true);
      const baseUrl =
        pocEndPoints.AI_PIPELINE_GET_JOB_EXPORTS ||
        "http://107.108.32.188:8001/api/exports/json";
      const apiUrl = `${baseUrl}?limit=50&offset=${offset}&job_id=${job.id}`;

      const response = await fetch(apiUrl, {
        headers: { accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch more job export data (status: ${response.status})`);
      }

      const data = await response.json();
      const rawRows = Array.isArray(data)
        ? data
        : Array.isArray(data?.rows)
        ? data.rows
        : Array.isArray(data?.data)
        ? data.data
        : [];
      const mappedRows = rawRows.map(mapExportedRowToChangeData);

      setRows((prev) => [...prev, ...mappedRows]);
      setOffset((prev) => prev + 50);
      setHasMore(rawRows.length === 50);
      if (data?.total != null) {
        setTotalRows(data.total);
      }
    } catch (err) {
      console.error("Job export scroll fetch error:", err);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleTableScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 40) {
      if (hasMore && !loadingMore && !loading) {
        fetchMoreJobExportData();
      }
    }
  };

  const handleDownloadExport = async () => {
    if (!job?.id || downloadingExport) return;
    try {
      setDownloadingExport(true);
      const aiServer = (
        import.meta.env.VITE_APP_AI_POC_PIPELINE_SERVER || "http://107.108.32.188:8001"
      ).replace(/\/+$/, "");
      const downloadUrl = `${aiServer}/api/exports/${job.id}`;

      const response = await fetch(downloadUrl);
      if (!response.ok) {
        throw new Error(`Failed to download export file (status: ${response.status})`);
      }

      let filename = `job_${job.id}_export.xlsx`;
      const disposition = response.headers.get("Content-Disposition");
      if (disposition && disposition.includes("filename=")) {
        const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (match && match[1]) {
          filename = match[1].replace(/['"]/g, "").trim();
        }
      } else if (job?.fileName || job?.files) {
        const origName = Array.isArray(job?.files) ? job.files[0] : (job.fileName || job.files);
        if (origName && typeof origName === "string") {
          filename = origName.endsWith(".xlsx") || origName.endsWith(".csv")
            ? origName
            : `${origName}.xlsx`;
        }
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      pushToast(t("toast.exportSuccess", "Export file downloaded successfully."), "success");
    } catch (err) {
      console.error("Export download error:", err);
      pushToast(err.message || t("toast.exportFailed", "Failed to download export file."), "error");
    } finally {
      setDownloadingExport(false);
    }
  };

  const handleCellDoubleClick = (rowIdx, key, val) => {
    if (!isEditAndDeleteOptionIsRequired) return;
    setEditingCell({ rowIdx, key });
    setCellValue(String(val ?? ""));
  };

  // Close editing cell on click outside
  useEffect(() => {
    if (!editingCell) return;
    const handleClickOutside = (e) => {
      if (e.target.closest(".editing-cell-container")) return;
      setEditingCell(null);
    };
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [editingCell]);

  const handleCellSave = (rowIdx, key, overrideVal) => {
    if (!isEditAndDeleteOptionIsRequired) return;
    const valToSave = overrideVal !== undefined ? overrideVal : cellValue;
    setRows((prev) => {
      const next = [...prev];
      if (!next[rowIdx]) return prev;
      const updatedRow = { ...next[rowIdx], [key]: valToSave };
      const lowerKey = String(key).toLowerCase();
      if (lowerKey === "wocode" || lowerKey === "wo_code") {
        updatedRow.woCode = valToSave;
        updatedRow.wOCode = valToSave;
        updatedRow.wo_code = valToSave;
      } else if (lowerKey === "wotype" || lowerKey === "wo_type") {
        updatedRow.woType = valToSave;
        updatedRow.Wotype = valToSave;
        updatedRow.wo_type = valToSave;
        updatedRow.woTypeName = valToSave;
      } else if (lowerKey === "maintgroup" || lowerKey === "eqtype") {
        updatedRow.maintGroup = valToSave;
        updatedRow.eqType = valToSave;
      } else if (lowerKey === "sparepart" || key === "자재목록") {
        updatedRow.sparePart = valToSave;
        updatedRow["자재목록"] = valToSave;
      } else if (lowerKey === "equipmentcode" || lowerKey === "eqcode" || lowerKey === "equipment_code") {
        updatedRow.equipmentCode = valToSave;
        updatedRow.equipment_code = valToSave;
        updatedRow.Eqcode = valToSave;
      } else if (lowerKey === "equipmentname" || lowerKey === "eqname" || lowerKey === "equipment_name") {
        updatedRow.equipmentName = valToSave;
        updatedRow.equipment_name = valToSave;
        updatedRow.Eqname = valToSave;
      } else if (lowerKey === "representativework" || lowerKey === "rep_name") {
        updatedRow.representativeWork = valToSave;
        updatedRow.representative_work_name = valToSave;
        updatedRow.rep_name = valToSave;
      } else if (
        lowerKey === "workedon" ||
        lowerKey === "workdate" ||
        lowerKey === "work_date" ||
        lowerKey === "workeddate" ||
        lowerKey === "worked_date" ||
        key === "작업완료일" ||
        key === "작업일자"
      ) {
        const formatted = getFormattedDateString(valToSave) || valToSave;
        updatedRow.workedOn = formatted;
        updatedRow.workDate = formatted;
        updatedRow.work_date = formatted;
        updatedRow.workedDate = formatted;
      }

      next[rowIdx] = updatedRow;
      return next;
    });
    setEditingCell(null);
  };

  const handleDeleteRow = (rowIdx) => {
    if (!isEditAndDeleteOptionIsRequired) return;
    setRows((prev) => {
      const next = prev.filter((_, idx) => idx !== rowIdx);
      const remainingDups = next.filter((r) => r.is_duplicate).length;
      setDuplicateRowsCount(remainingDups);
      if (remainingDups === 0) {
        setDuplicateAlert(null);
        if (filterType === "duplicate") setFilterType("all");
      }
      return next;
    });
  };

  const handleRemoveAllDuplicates = () => {
    if (!isEditAndDeleteOptionIsRequired) return;
    setRows((prev) => prev.filter((r) => !r.is_duplicate));
    setDuplicateRowsCount(0);
    setDuplicateAlert(null);
    setFilterType("all");
    pushToast(t("toast.duplicatesRemoved", "All duplicate records have been removed."), "info");
  };

  const missingMandatoryCount = useMemo(() => {
    return rows.filter((r) =>
      previewColumns.some((col) => {
        const val = getPreviewCellValue(r, col.key);
        return col.required && (!val || String(val).trim() === "");
      }),
    ).length;
  }, [rows, previewColumns]);

  const filteredRows = useMemo(() => {
    if (filterType === "duplicate") {
      return rows.filter((r) => r.is_duplicate);
    }
    if (filterType === "missing") {
      return rows.filter((r) =>
        previewColumns.some((col) => {
          const val = getPreviewCellValue(r, col.key);
          return col.required && (!val || String(val).trim() === "");
        }),
      );
    }
    return rows;
  }, [rows, filterType, previewColumns]);

  const handleSaveAll = async () => {
    if (!rows || rows.length === 0) {
      pushToast(t("toast.noRecordsExport", "저장할 데이터가 없습니다."), "error");
      return;
    }

    setSaving(true);

    const payload = {
      changeDataList: rows.map((r) => {
        const rawDate = r.workDate || r.workedOn || r.work_date || "";
        const isoDate = formatValidDateIso(rawDate);
        return {
          ...r,
          workDate: isoDate,
          workedOn: r.workedOn || r.workDate || isoDate.slice(0, 10),
        };
      }),
      id: 0,
    };

    try {
      // 1. Initial Save API
      const saveResponse = await new Promise((resolve) => {
        APIcallPost(pocEndPoints.SAVE_DATA_CHANGES, payload, {}, (responseData, status) => {
          resolve({ responseData, status });
        });
      });

      // Duplicate detection directly from API response
      const resData = saveResponse.responseData;
      const is409 = saveResponse.status === 409 || resData?.statusCode === 409;
      const dupList = Array.isArray(resData?.data)
        ? resData.data.filter((d) => d?.is_duplicate === true)
        : [];

      if (is409 || dupList.length > 0) {
        setSaving(false);
        const updated = rows.map((r) => {
          const isDup = dupList.some(
            (d) =>
              (d.equipment_code && d.equipment_code === (r.equipmentCode || r.equipment_code)) &&
              (d.wo_code && d.wo_code === (r.woCode || r.wo_code)),
          ) || (dupList.length === rows.length && dupList[rows.indexOf(r)]?.is_duplicate);
          return { ...r, is_duplicate: isDup };
        });

        const count = updated.filter((r) => r.is_duplicate).length || dupList.length;
        setRows(updated);
        setDuplicateRowsCount(count);
        setFilterType("duplicate");
        const msg = resData?.message || `${count} duplicate record(s) found. Please review.`;
        setDuplicateAlert(msg);
        pushToast(msg, "error");
        return;
      }

      if (saveResponse.status !== 200 && saveResponse.status !== 201) {
        setSaving(false);
        const errMsg =
          saveResponse.responseData?.message ||
          (typeof saveResponse.responseData === "string" ? saveResponse.responseData : null) ||
          t("toast.saveError", "데이터 저장에 실패했습니다.");
        pushToast(errMsg, "error");
        return;
      }

      // 2. On success save API, call the cursor and changes sync pipeline
      try {
        // Step 2a: New AI_POC_API call -> getCursor() from api/ChangeData/GetCursor
        const cursorResponse = await new Promise((resolve) => {
          APIcallGet(pocEndPoints.GET_CURSOR, {}, (data, status) => {
            resolve({ data, status });
          });
        });

        let cursorData = null;
        if (cursorResponse.status === 200 || cursorResponse.status === 201) {
          const raw = cursorResponse.data;
          if (typeof raw === "string") {
            cursorData = raw.trim() || null;
          } else if (raw && typeof raw === "object") {
            cursorData = raw.cursor ?? raw.data ?? raw.value ?? null;
            if (typeof cursorData === "string") {
              cursorData = cursorData.trim() || null;
            }
          }
        }

        // Step 2b: Call FAST API exports/changes (if data is null don't pass since)
        const baseChangesUrl =
          pocEndPoints.AI_PIPELINE_GET_CHANGES ||
          "http://107.108.32.188:8001/api/exports/changes";
        const changesUrl = new URL(baseChangesUrl);

        if (cursorData && cursorData !== "null" && cursorData !== "undefined") {
          changesUrl.searchParams.set("since", cursorData);
        }
        changesUrl.searchParams.set("limit", "500");
        changesUrl.searchParams.set("offset", "0");

        const fastApiRes = await fetch(changesUrl.toString(), {
          method: "GET",
          headers: {
            accept: "application/json",
          },
        });

        if (fastApiRes.ok) {
          const fastApiData = await fastApiRes.json();

          // Step 2c: Extract rows from FastAPI response. If response rows is null or empty, don't call SaveReviewedChangedData
          const rawRows = fastApiData?.rows;
          if (rawRows && Array.isArray(rawRows) && rawRows.length > 0) {
            const changeDataList = rawRows.map((r) => mapExportedRowToChangeData(r));

            const reviewedPayload = {
              changeDataList: changeDataList.map((r) => {
                const rawDate = r.workDate || r.workedOn || r.work_date || "";
                const isoDate = formatValidDateIso(rawDate);
                return {
                  ...r,
                  workDate: isoDate,
                  workedOn: r.workedOn || r.workDate || isoDate.slice(0, 10),
                };
              }),
              id: 0,
            };

            // Send to api/ChangeData/SaveReviewedChangedData
            const reviewedResponse = await new Promise((resolve) => {
              APIcallPost(
                pocEndPoints.SAVE_REVIEWED_CHANGED_DATA,
                reviewedPayload,
                {},
                (reviewedRes, status) => {
                  resolve({ reviewedRes, status });
                },
              );
            });

            const isReviewedSuccess =
              (reviewedResponse.status === 200 || reviewedResponse.status === 201) &&
              reviewedResponse.reviewedRes?.statusCode !== 400 &&
              (reviewedResponse.reviewedRes?.statusCode == null ||
                reviewedResponse.reviewedRes?.statusCode === 200 ||
                reviewedResponse.reviewedRes?.statusCode === 201);

            // Step 2d: If the response from SaveReviewedChangedData is 200 then only call Save Cursor else don't call
            if (isReviewedSuccess) {
              const newCursor =
                fastApiData?.cursor ??
                fastApiData?.next_cursor ??
                fastApiData?.nextCursor ??
                fastApiData?.cursor_id ??
                cursorData ??
                "";

              const cursorPayload = {
                cursor: String(newCursor || ""),
              };

              await new Promise((resolve) => {
                APIcallPost(
                  pocEndPoints.SAVE_CURSOR,
                  cursorPayload,
                  {},
                  (saveCursorRes, status) => {
                    resolve({ saveCursorRes, status });
                  },
                );
              });
            } else {
              console.warn(
                "SaveReviewedChangedData did not return 200 (status: " +
                  reviewedResponse.status +
                  ", code: " +
                  reviewedResponse.reviewedRes?.statusCode +
                  "). SaveCursor was not called.",
                reviewedResponse.reviewedRes,
              );
            }
          } else {
            console.log(
              "No rows to review (rows is null or empty). Skipping SaveReviewedChangedData.",
              fastApiData,
            );
          }
        } else {
          console.error("FastAPI changes export error:", fastApiRes.status, fastApiRes.statusText);
        }
      } catch (pipelineErr) {
        console.error("Cursor & changes sync error:", pipelineErr);
      }

      setSaving(false);
      pushToast(
        t("toast.saveSuccess", "데이터가 성공적으로 저장되었습니다."),
        "success",
      );
      window.dispatchEvent(new Event("refreshChangeHistoryData"));
      onClose();
      navigate("/data-management/change-history-data");
    } catch (err) {
      console.error("Save error:", err);
      setSaving(false);
      pushToast(t("toast.saveError", "데이터 저장에 실패했습니다."), "error");
    }
  };

  const isFullyLoaded = totalRows == null ? !hasMore : rows.length >= totalRows || !hasMore;
  const isSaveDisabled = saving || loading || rows.length === 0 || !isFullyLoaded;

  const saveTooltip = !isFullyLoaded
    ? `Please scroll down to load all records before saving (${rows.length}/${totalRows != null ? totalRows : rows.length} loaded)`
    : saving
    ? "Saving data in progress..."
    : loading
    ? "Loading preview data..."
    : rows.length === 0
    ? "No rows to save"
    : `Save all ${rows.length} records`;

  return createPortal(
    <div className="modal-overlay fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen z-[10000] flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div
        className="modal-content relative flex flex-col p-0 overflow-hidden shadow-2xl z-[10001]"
        style={{ width: "min(96vw, 1600px)", maxWidth: "96vw", maxHeight: "88vh" }}
      >
        {/* Saving Overlay */}
        {saving && (
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
          className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{
            borderBottom: "1px solid var(--color-border-base, #e5e7eb)",
            background: "var(--color-surface-raised, #f9fafb)",
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl text-lg font-bold"
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
                {t("preview.title", "Upload Data Preview")}
              </h2>
              <p
                className="text-xs mt-0.5"
                style={{ color: "var(--color-text-subtle, #6b7280)" }}
              >
                Loaded <span className="font-semibold text-text-default">{rows.length}</span> of{" "}
                <span className="font-semibold text-text-default">
                  {totalRows != null ? totalRows : rows.length}
                </span>{" "}
                rows · {previewColumns.length + (isEditAndDeleteOptionIsRequired ? 1 : 0)} columns
                {isEditAndDeleteOptionIsRequired &&
                  (language === "ko"
                    ? " · 셀을 더블 클릭하여 수정하세요"
                    : " · double click on the field to edit")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Filters Segmented Control */}
            <div className="toggle-group text-xs flex items-center bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setFilterType("all")}
                className={`toggle-btn px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  filterType === "all"
                    ? "bg-white dark:bg-gray-700 text-teal-600 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {t("preview.filterAll", "All")} ({rows.length}{totalRows != null && totalRows !== rows.length ? ` / ${totalRows}` : ""})
              </button>
              {duplicateRowsCount > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterType("duplicate")}
                  className={`toggle-btn px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    filterType === "duplicate"
                      ? "bg-white dark:bg-gray-700 text-red-600 shadow-sm"
                      : "text-red-500 hover:text-red-700"
                  }`}
                >
                  {t("preview.filterDuplicate", "Duplicates")} ({duplicateRowsCount})
                </button>
              )}
              <button
                type="button"
                onClick={() => setFilterType("missing")}
                className={`toggle-btn px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  filterType === "missing"
                    ? "bg-white dark:bg-gray-700 text-orange-600 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {t("preview.filterMissing", "Missing Required")} ({missingMandatoryCount})
              </button>
            </div>

            {/* Download Export Button */}
            {job?.id != null && (
              <button
                type="button"
                onClick={handleDownloadExport}
                disabled={downloadingExport}
                className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 font-semibold text-xs px-3 py-1.5 rounded-xl shadow-2xs flex items-center gap-1.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                title={`Download export for Job #${job.id}`}
              >
                <i
                  className={`fas ${
                    downloadingExport ? "fa-spinner fa-spin text-teal-600" : "fa-download text-teal-600"
                  } text-xs`}
                />
                <span>
                  {downloadingExport
                    ? t("app.downloading", "Downloading...")
                    : t("app.download", "Download")}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              aria-label="Close"
            >
              <i className="fas fa-times text-sm" />
            </button>
          </div>
        </div>

        {/* Duplicate Alert Banner */}
        {duplicateAlert && (
          <div className="mx-6 mt-3 p-3 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center justify-between gap-3 animate-fade-in shadow-xs">
            <div className="flex items-center gap-2 font-medium">
              <i className="fas fa-exclamation-circle text-base shrink-0 text-red-600" />
              <span>{duplicateAlert}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {isEditAndDeleteOptionIsRequired && (
                <button
                  type="button"
                  onClick={handleRemoveAllDuplicates}
                  className="btn-base bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                >
                  <i className="fas fa-trash-alt text-xs" />
                  <span>Remove All Duplicates ({duplicateRowsCount})</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setDuplicateAlert(null)}
                className="text-red-400 hover:text-red-600 dark:hover:text-red-200 p-1 cursor-pointer"
                title="Dismiss"
              >
                <i className="fas fa-times" />
              </button>
            </div>
          </div>
        )}

        {/* Body (Table Container) */}
        <div
          className="overflow-auto bg-surface-default max-h-[calc(88vh-140px)]"
          onScroll={handleTableScroll}
        >
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-text-subtle">
              <i className="fas fa-spinner fa-spin text-3xl text-teal-600 mb-3" />
              <p className="text-sm font-medium">Loading preview data...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 text-red-600">
              <i className="fas fa-exclamation-triangle text-3xl mb-3" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-text-subtle">
              <i className="fas fa-inbox text-4xl opacity-30 mb-2" />
              <p className="text-sm">No data available for preview.</p>
            </div>
          ) : (
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-gray-50 dark:bg-gray-800/80 sticky top-0 z-10 border-b border-border-base">
                <tr className="font-semibold text-text-subtle whitespace-nowrap">
                  <th className="px-4 py-3 w-12 text-center">#</th>
                  {isEditAndDeleteOptionIsRequired && (
                    <th className="px-3 py-3 w-16 text-center">
                      {t("preview.edit", "Action")}
                    </th>
                  )}
                  {previewColumns.map((col) => (
                    <th key={col.key} className="px-4 py-3 min-w-[140px]">
                      {formatColumnHeader(col, language)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-base">
                {filteredRows.map((r, rIdx) => {
                  const actualRowIdx = rows.indexOf(r);
                  const targetRowIdx = actualRowIdx !== -1 ? actualRowIdx : rIdx;
                  const isDup = Boolean(r.is_duplicate);

                  return (
                    <tr
                      key={targetRowIdx}
                      className={`transition-colors ${
                        isDup
                          ? "bg-red-50/90 dark:bg-red-950/60 border-l-4 border-l-red-600"
                          : "hover:bg-gray-50/80 dark:hover:bg-gray-800/60"
                      }`}
                    >
                      <td className="px-4 py-3 text-center text-text-subtle font-mono">
                        {isDup ? (
                          <span className="inline-flex items-center gap-1 font-bold text-red-600 dark:text-red-400">
                            <span>{targetRowIdx + 1}</span>
                            <span className="px-1 py-0.2 rounded bg-red-200 dark:bg-red-900 text-red-800 dark:text-red-100 text-[9px] uppercase font-bold">
                              DUP
                            </span>
                          </span>
                        ) : (
                          targetRowIdx + 1
                        )}
                      </td>
                      {isEditAndDeleteOptionIsRequired && (
                        <td className="px-3 py-3 text-center">
                          <button
                            type="button"
                            className={`p-1 rounded transition-colors ${
                              isDup
                                ? "bg-red-100 dark:bg-red-900/60 text-red-600 dark:text-red-300 hover:bg-red-600 hover:text-white"
                                : "text-gray-400 hover:text-red-600"
                            }`}
                            title={isDup ? "Delete duplicate row" : "Delete row"}
                            onClick={() => handleDeleteRow(targetRowIdx)}
                          >
                            <i className="fas fa-trash-alt text-xs" />
                          </button>
                        </td>
                      )}
                      {previewColumns.map((col) => {
                        const val = getPreviewCellValue(r, col.key);
                        const isEditing =
                          editingCell?.rowIdx === targetRowIdx && editingCell?.key === col.key;
                        const isMissing =
                          col.required && (!val || String(val).trim() === "");

                        return (
                          <td
                            key={col.key}
                            className={`px-4 py-3 whitespace-nowrap max-w-[220px] transition-colors ${
                              isEditAndDeleteOptionIsRequired ? "cursor-pointer" : "cursor-default"
                            } ${
                              isEditing ? "overflow-visible relative" : "truncate overflow-hidden"
                            } ${
                              isDup
                                ? "bg-red-100/80 dark:bg-red-900/50 text-red-800 dark:text-red-200 border-b border-red-200 dark:border-red-900 font-semibold"
                                : isMissing
                                ? "bg-red-50/60 dark:bg-red-950/40 text-red-700 dark:text-red-300 font-medium"
                                : isEditAndDeleteOptionIsRequired
                                ? "hover:bg-teal-50/50 dark:hover:bg-teal-950/30"
                                : ""
                            }`}
                            onDoubleClick={
                              isEditAndDeleteOptionIsRequired
                                ? () => handleCellDoubleClick(targetRowIdx, col.key, val)
                                : undefined
                            }
                            title={isDup ? `[Duplicate Record] ${String(val)}` : String(val)}
                          >
                          {isEditing ? (
                            <div className="relative editing-cell-container" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="text"
                                className="input-base text-xs py-0.5 px-1.5 w-full bg-white dark:bg-gray-800 text-text-default border border-blue-500 rounded focus:outline-hidden focus:ring-1 focus:ring-blue-500 shadow-2xs"
                                value={cellValue}
                                autoFocus
                                onChange={(e) => setCellValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleCellSave(targetRowIdx, col.key, cellValue);
                                  }
                                  if (e.key === "Escape") {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setEditingCell(null);
                                  }
                                }}
                              />
                              <div
                                style={{
                                  position: "absolute",
                                  right: "0px",
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
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCellSave(targetRowIdx, col.key, cellValue);
                                  }}
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
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingCell(null);
                                  }}
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
                            </div>
                          ) : (
                            <span>{String(val || "")}</span>
                          )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {loadingMore && (
            <div className="py-2.5 text-center text-xs text-teal-600 dark:text-teal-400 bg-gray-50/80 dark:bg-gray-800/80 border-t border-border-base flex items-center justify-center gap-2">
              <i className="fas fa-spinner fa-spin text-sm" />
              <span>Loading next 50 records...</span>
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
            {isEditAndDeleteOptionIsRequired && (
              <p className="text-xs text-text-subtle flex items-center gap-1.5">
                <i className="fas fa-info-circle text-gray-400" />
                <span>
                  {language === "ko"
                    ? "셀을 더블 클릭하여 수정한 후, 저장 버튼을 클릭하세요."
                    : "Double click on the field to edit, then click Save."}
                </span>
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="btn-base btn-secondary flex items-center gap-1.5 text-xs px-4 py-2 cursor-pointer"
            >
              <i className="fas fa-times" />
              <span>{t("common.cancel", "Cancel")}</span>
            </button>
            <div title={saveTooltip} className="inline-block">
              <button
                type="button"
                onClick={handleSaveAll}
                disabled={isSaveDisabled}
                title={saveTooltip}
                className={`btn-base btn-primary min-w-[140px] justify-center flex items-center gap-1.5 text-xs px-5 py-2 ${
                  isSaveDisabled
                    ? "opacity-60 cursor-not-allowed pointer-events-none"
                    : "cursor-pointer"
                }`}
              >
                {saving ? (
                  <>
                    <i className="fas fa-spinner fa-spin" />
                    <span>{t("common.saving", "Saving...")}</span>
                  </>
                ) : (
                  <>
                    <i className="fas fa-check" />
                    <span>
                      {language === "ko"
                        ? `저장 (${rows.length} / ${totalRows != null ? totalRows : rows.length}행)`
                        : `Save (${rows.length} of ${totalRows != null ? totalRows : rows.length} rows)`}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
