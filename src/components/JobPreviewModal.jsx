import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { pocEndPoints } from "../axios/endPoints.js";
import { APIcallPost } from "../axios/apiCall.js";
import { getUserInfo } from "../utils/cookieUtils.js";
import { useToast } from "./ToastContext.jsx";
import { useI18n } from "../i18n.jsx";

const PREVIEW_COLUMNS = [
  { key: "equipmentCode", label: "설비코드 (Equipment Code)", required: true },
  { key: "equipmentName", label: "설비명 (Equipment Name)", required: true },
  { key: "process", label: "공정 (Process)", required: true },
  { key: "site", label: "법인 (Site)", required: true },
  { key: "maintGroup", label: "보전파트 (Maintenance Part)", required: true },
  { key: "workedOn", label: "작업완료일 (Work Date)", required: true },
  { key: "woCode", label: "W/O코드 (W/O Code)" },
  { key: "representativeWork", label: "대표 작업명 (Rep Work Name)", required: true },
  { key: "work", label: "개선 작업 (Improvement Work)" },
  { key: "purpose", label: "작업목적 (Work Purpose)", required: true },
  { key: "situation", label: "문제 현상 (Problem Symptom)", required: true },
  { key: "cause", label: "문제 원인 (Problem Cause)", required: true },
  { key: "hwAsWas", label: "HW 변경 전 (HW Before)", required: true },
  { key: "hwAsIs", label: "HW 변경 후 (HW After)", required: true },
  { key: "swAsWas", label: "SW 변경 전 (SW Before)", required: true },
  { key: "swAsIs", label: "SW 변경 후 (SW After)", required: true },
  { key: "priority", label: "중요도 (Priority)" },
  { key: "category", label: "효과 유형 (Effect Type)" },
  { key: "woType", label: "작업타입 (Wotype)" },
  { key: "bom", label: "BOM" },
  { key: "sparePart", label: "자재목록 (Sparepart)" },
];

function mapExportedRowToChangeData(row) {
  const currentUserName = getUserInfo()?.name || "Chirati Harish";
  const maintVal = row.maintenance_part || row.maintGroup || row.eqType || "";
  const woTypeVal = row.wotype || row.woType || row.wo_type || "";
  const workedDate = row.work_date || row.workedOn || "";

  return {
    id: 0,
    site: row.site || "",
    process: row.process || "",
    maintGroup: maintVal,
    equipmentCode: row.equipment_code || row.equipmentCode || "",
    equipmentName: row.equipment_name || row.equipmentName || "",
    woCode: row.wo_code || row.woCode || "",
    wOCode: row.wo_code || row.woCode || "",
    wo_code: row.wo_code || row.woCode || "",
    report: row.report || row.report_content || row.reportContent || "",
    bom: row.bom || "",
    sparePart: row.sparepart || row.sparePart || "",
    workedOn: workedDate,
    work: row.improvements || row.work || "",
    purpose: row.task_purpose || row.purpose || "",
    situation: row.problem_phenomenon || row.situation || "",
    cause: row.problem_cause || row.cause || "",
    hwAsWas: row.hw_before || row.hwAsWas || "",
    hwAsIs: row.hw_after || row.hwAsIs || "",
    swAsWas: row.sw_before || row.swAsWas || "",
    swAsIs: row.sw_after || row.swAsIs || "",
    representativeWork: row.rep_name || row.representativeWork || "",
    priority: row.importance || row.priority || "",
    category: row.effect_type || row.category || "",
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

export default function JobPreviewModal({ job, onClose }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editingCell, setEditingCell] = useState(null); // { rowIdx, key }
  const [cellValue, setCellValue] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [searchText, setSearchText] = useState("");

  const navigate = useNavigate();
  const { pushToast } = useToast();
  const { t } = useI18n();

  useEffect(() => {
    let isMounted = true;
    const fetchJobExportData = async () => {
      try {
        setLoading(true);
        const baseUrl =
          pocEndPoints.AI_PIPELINE_GET_JOB_EXPORTS ||
          "http://107.108.32.188:8001/api/exports/json";
        const apiUrl = `${baseUrl}?limit=1000&offset=0&job_id=${job.id}`;

        const response = await fetch(apiUrl, {
          headers: { accept: "application/json" },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch job export data (status: ${response.status})`);
        }

        const data = await response.json();
        if (isMounted) {
          const rawRows = data?.rows || [];
          const mappedRows = rawRows.map(mapExportedRowToChangeData);
          setRows(mappedRows);
        }
      } catch (err) {
        console.error("Job export fetch error:", err);
        if (isMounted) setError(err.message || "Failed to load job export data.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    if (job?.id) {
      fetchJobExportData();
    }
  }, [job]);

  const handleCellDoubleClick = (rowIdx, key, val) => {
    setEditingCell({ rowIdx, key });
    setCellValue(String(val ?? ""));
  };

  const handleCellSave = (rowIdx, key) => {
    if (editingCell) {
      setRows((prev) => {
        const next = [...prev];
        next[rowIdx] = { ...next[rowIdx], [key]: cellValue };
        return next;
      });
      setEditingCell(null);
    }
  };

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const matchesSearch =
        !searchText.trim() ||
        Object.values(r).some((v) =>
          String(v || "")
            .toLowerCase()
            .includes(searchText.toLowerCase()),
        );
      return matchesSearch;
    });
  }, [rows, searchText]);

  const handleSaveAll = () => {
    if (!rows || rows.length === 0) {
      pushToast(t("toast.noRecordsExport", "저장할 데이터가 없습니다."), "error");
      return;
    }

    setSaving(true);

    const payload = {
      changeDataList: rows,
      id: 0,
    };

    APIcallPost(pocEndPoints.SAVE_DATA_CHANGES, payload, {}, (responseData, status) => {
      setSaving(false);
      if (status === 200 || status === 201) {
        pushToast(
          t("toast.saveSuccess", "데이터가 성공적으로 저장되었습니다."),
          "success",
        );
        onClose();
        navigate("/data-management/change-history-data");
      } else {
        pushToast(t("toast.saveError", "데이터 저장에 실패했습니다."), "error");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="card w-full max-w-6xl h-[88vh] flex flex-col min-h-0 overflow-hidden shadow-2xl space-y-0">
        {/* Header */}
        <div className="p-4 border-b border-border-base flex items-center justify-between bg-surface-default">
          <div>
            <h3 className="font-bold text-base md:text-lg text-text-default flex items-center gap-2">
              <i className="fas fa-file-excel text-teal-600" />
              <span>{t("preview.title", "업로드 데이터 미리보기")} (Job #{job?.id})</span>
            </h3>
            <p className="text-xs text-text-subtle mt-0.5">
              {t("preview.total", "총")} <strong className="text-teal-600">{rows.length}</strong> {t("preview.row", "행")} · {t("preview.tip", "셀을 더블 클릭하여 수정한 후, 저장 버튼으로 전체 데이터를 저장하세요")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1.5 rounded-lg text-sm"
              onClick={onClose}
            >
              <i className="fas fa-times" />
            </button>
          </div>
        </div>

        {/* Search & Action Bar */}
        <div className="p-3 border-b border-border-base bg-gray-50/50 dark:bg-gray-800/40 flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-64">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
            <input
              type="text"
              className="input-base pl-8 py-1.5 text-xs w-full"
              placeholder="Search preview data..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-secondary text-xs px-4 py-1.5"
              onClick={onClose}
              disabled={saving}
            >
              {t("app.cancel", "취소")}
            </button>
            <button
              type="button"
              className="btn-primary text-xs px-5 py-1.5 flex items-center gap-1.5"
              onClick={handleSaveAll}
              disabled={saving || loading || rows.length === 0}
            >
              {saving ? (
                <>
                  <i className="fas fa-spinner fa-spin" />
                  <span>{t("app.saving", "저장 중...")}</span>
                </>
              ) : (
                <>
                  <i className="fas fa-save" />
                  <span>
                    {t("app.saveBtn", "저장하기")} ({rows.length}{t("app.rows", "건")})
                  </span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-text-subtle">
              <i className="fas fa-spinner fa-spin text-3xl text-teal-600 mb-3" />
              <p className="text-sm font-medium">{t("app.loadingData", "데이터를 불러오는 중...")}</p>
            </div>
          ) : error ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-red-600">
              <i className="fas fa-exclamation-triangle text-3xl mb-3" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-text-subtle">
              <i className="fas fa-inbox text-3xl mb-2" />
              <p className="text-sm">{t("preview.noData", "미리보기할 데이터가 없습니다.")}</p>
            </div>
          ) : (
            <div className="table-wrapper flex-1 overflow-auto">
              <table className="table-base w-full text-xs text-left">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-800 border-b border-border-base sticky top-0 z-10 font-semibold text-text-subtle whitespace-nowrap">
                    <th className="px-3 py-2 text-center w-12">#</th>
                    {PREVIEW_COLUMNS.map((col) => (
                      <th key={col.key} className="px-3 py-2">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-base">
                  {filteredRows.map((r, rIdx) => (
                    <tr
                      key={rIdx}
                      className="hover:bg-gray-50/80 dark:hover:bg-gray-800/60 transition-colors"
                    >
                      <td className="px-3 py-2 text-center text-text-subtle font-mono">
                        {rIdx + 1}
                      </td>
                      {PREVIEW_COLUMNS.map((col) => {
                        const val = r[col.key] ?? "";
                        const isEditing =
                          editingCell?.rowIdx === rIdx && editingCell?.key === col.key;

                        return (
                          <td
                            key={col.key}
                            className="px-3 py-2 whitespace-nowrap max-w-[200px] truncate cursor-pointer hover:bg-teal-50/50 dark:hover:bg-teal-950/30"
                            onDoubleClick={() => handleCellDoubleClick(rIdx, col.key, val)}
                            title={String(val)}
                          >
                            {isEditing ? (
                              <input
                                type="text"
                                className="input-base text-xs py-0.5 px-1 w-full"
                                value={cellValue}
                                autoFocus
                                onChange={(e) => setCellValue(e.target.value)}
                                onBlur={() => handleCellSave(rIdx, col.key)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleCellSave(rIdx, col.key);
                                  if (e.key === "Escape") setEditingCell(null);
                                }}
                              />
                            ) : (
                              <span>{String(val || "-")}</span>
                            )}
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
      </div>
    </div>
  );
}
