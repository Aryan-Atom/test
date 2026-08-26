import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { pocEndPoints } from "../axios/endPoints.js";
import { APIcallGet, APIcallPost } from "../axios/apiCall.js";
import { getUserInfo } from "../utils/cookieUtils.js";
import { useToast } from "./ToastContext.jsx";
import { useI18n } from "../i18n.jsx";

// Standard Master Data column sequence fallback
const DEFAULT_PREVIEW_COLUMNS = [
  { key: "site", label: "Site", required: true },
  { key: "process", label: "Process", required: true },
  { key: "maintGroup", label: "Maintenance Part", required: true },
  { key: "equipmentCode", label: "Eqcode", required: true },
  { key: "equipmentName", label: "Eqname", required: true },
  { key: "woCode", label: "W/Ocode", required: false },
  { key: "report", label: "report content", required: false },
  { key: "bom", label: "BOM", required: false },
  { key: "sparePart", label: "Sparepart", required: false },
  { key: "workedOn", label: "Work Date", required: false },
  { key: "work", label: "Improvement Work", required: false },
  { key: "purpose", label: "Work Purpose", required: false },
  { key: "situation", label: "Problem Symptom", required: false },
  { key: "cause", label: "Problem Cause", required: false },
  { key: "hwAsWas", label: "HW Before", required: false },
  { key: "hwAsIs", label: "HW After", required: false },
  { key: "swAsWas", label: "SW Before", required: false },
  { key: "swAsIs", label: "SW After", required: false },
  { key: "representativeWork", label: "Rep Work Name", required: true },
  { key: "priority", label: "Priority", required: true },
  { key: "category", label: "Effect Type", required: true },
  { key: "woType", label: "Wotype", required: false },
];

function mapExportedRowToChangeData(row) {
  const currentUserName = getUserInfo()?.name || "Chirati Harish";
  const maintVal = row.maintenance_part || row.maintGroup || row.eqType || row["보전파트"] || "";
  const woTypeVal = row.Wotype || row.wotype || row.woType || row.wo_type || row["W/O타입"] || "";
  const woCodeVal = row.wOCode || row.woCode || row.wo_code || row["W/O코드"] || row["작업지시서 코드"] || "";
  const workedDate = row.work_date || row.workedOn || row["작업완료일"] || row["작업일자"] || "";
  const sparePartVal = row.sparepart || row.sparePart || row["자재목록"] || row["예비 부품"] || "";

  return {
    id: 0,
    site: row.site || "",
    process: row.process || "",
    maintGroup: maintVal,
    equipmentCode: row.equipment_code || row.equipmentCode || "",
    equipmentName: row.equipment_name || row.equipmentName || "",
    woCode: woCodeVal,
    wOCode: woCodeVal,
    wo_code: woCodeVal,
    report: row.report || row.report_content || row.reportContent || row["Report내용"] || row["보고서"] || "",
    bom: row.bom || row.BOM || "",
    sparePart: sparePartVal,
    "자재목록": sparePartVal,
    workedOn: workedDate,
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

export default function JobPreviewModal({ job, onClose }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editingCell, setEditingCell] = useState(null); // { rowIdx, key }
  const [cellValue, setCellValue] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [masterColumns, setMasterColumns] = useState(null);

  const navigate = useNavigate();
  const { pushToast } = useToast();
  const { t } = useI18n();

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
          const match = DEFAULT_PREVIEW_COLUMNS.find(
            (c) => c.key.toLowerCase() === key?.toLowerCase(),
          );
          return {
            key: match ? match.key : key,
            label: match ? match.label : (mc.columnNameKr || mc.columnName || key),
            required: mc.isMandatory !== undefined ? Boolean(mc.isMandatory) : (match ? Boolean(match.required) : false),
          };
        })
        .filter(Boolean);
      if (mapped.length > 0) return mapped;
    }
    return DEFAULT_PREVIEW_COLUMNS;
  }, [masterColumns]);

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
          const rawRows = Array.isArray(data)
            ? data
            : Array.isArray(data?.rows)
            ? data.rows
            : Array.isArray(data?.data)
            ? data.data
            : [];
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
        const updatedRow = { ...next[rowIdx], [key]: cellValue };
        const lowerKey = String(key).toLowerCase();
        if (lowerKey === "wocode") {
          updatedRow.woCode = cellValue;
          updatedRow.wOCode = cellValue;
          updatedRow.wo_code = cellValue;
        } else if (lowerKey === "wotype") {
          updatedRow.woType = cellValue;
          updatedRow.Wotype = cellValue;
          updatedRow.wo_type = cellValue;
          updatedRow.woTypeName = cellValue;
        } else if (lowerKey === "maintgroup" || lowerKey === "eqtype") {
          updatedRow.maintGroup = cellValue;
          updatedRow.eqType = cellValue;
        } else if (lowerKey === "sparepart" || key === "자재목록") {
          updatedRow.sparePart = cellValue;
          updatedRow["자재목록"] = cellValue;
        }

        next[rowIdx] = updatedRow;
        return next;
      });
      setEditingCell(null);
    }
  };

  const handleDeleteRow = (rowIdx) => {
    setRows((prev) => prev.filter((_, idx) => idx !== rowIdx));
  };

  const missingMandatoryCount = useMemo(() => {
    return rows.filter((r) =>
      previewColumns.some(
        (col) => col.required && (!r[col.key] || String(r[col.key]).trim() === ""),
      ),
    ).length;
  }, [rows, previewColumns]);

  const filteredRows = useMemo(() => {
    if (filterType === "missing") {
      return rows.filter((r) =>
        previewColumns.some(
          (col) => col.required && (!r[col.key] || String(r[col.key]).trim() === ""),
        ),
      );
    }
    return rows;
  }, [rows, filterType, previewColumns]);

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
        window.dispatchEvent(new Event("refreshChangeHistoryData"));
        onClose();
        navigate("/data-management/change-history-data");
      } else {
        pushToast(t("toast.saveError", "데이터 저장에 실패했습니다."), "error");
      }
    });
  };

  return (
    <div className="modal-overlay">
      <div
        className="modal-content flex flex-col p-0 overflow-hidden shadow-2xl"
        style={{ width: "min(96vw, 1600px)", maxWidth: "96vw", maxHeight: "88vh" }}
      >
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
                Upload Data Preview
              </h2>
              <p
                className="text-xs mt-0.5"
                style={{ color: "var(--color-text-subtle, #6b7280)" }}
              >
                Total <span className="font-semibold">{rows.length}rows</span> ·{" "}
                {previewColumns.length + 1}columns · double click on the field to edit
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
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
                All ({rows.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterType("missing")}
                className={`toggle-btn px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  filterType === "missing"
                    ? "bg-white dark:bg-gray-700 text-orange-600 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Missing Required ({missingMandatoryCount})
              </button>
            </div>

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

        {/* Body (Table Container) */}
        <div className="overflow-auto bg-surface-default max-h-[calc(88vh-140px)]">
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
                  <th className="px-3 py-3 w-16 text-center">Action</th>
                  {previewColumns.map((col) => (
                    <th key={col.key} className="px-4 py-3 min-w-[140px]">
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
                    <td className="px-4 py-3 text-center text-text-subtle font-mono">
                      {rIdx + 1}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <button
                        type="button"
                        className="text-gray-400 hover:text-red-600 p-1 rounded transition-colors"
                        title="Delete row"
                        onClick={() => handleDeleteRow(rIdx)}
                      >
                        <i className="fas fa-trash-alt text-xs" />
                      </button>
                    </td>
                    {previewColumns.map((col) => {
                      const val = r[col.key] ?? "";
                      const isEditing =
                        editingCell?.rowIdx === rIdx && editingCell?.key === col.key;
                      const isMissing =
                        col.required && (!val || String(val).trim() === "");

                      return (
                        <td
                          key={col.key}
                          className={`px-4 py-3 whitespace-nowrap max-w-[220px] truncate cursor-pointer transition-colors ${
                            isMissing
                              ? "bg-red-50/60 dark:bg-red-950/40 text-red-700 dark:text-red-300 font-medium"
                              : "hover:bg-teal-50/50 dark:hover:bg-teal-950/30"
                          }`}
                          onDoubleClick={() => handleCellDoubleClick(rIdx, col.key, val)}
                          title={String(val)}
                        >
                          {isEditing ? (
                            <input
                              type="text"
                              className="input-base text-xs py-0.5 px-1.5 w-full"
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
                            <span>{String(val || "")}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
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
          <p className="text-xs text-text-subtle flex items-center gap-1.5">
            <i className="fas fa-info-circle text-gray-400" />
            <span>
              Double click on the field to edit, then click the Save button to save the entire data.
            </span>
          </p>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="btn-base btn-secondary flex items-center gap-1.5 text-xs px-4 py-2"
            >
              <i className="fas fa-times" />
              <span>Cancel</span>
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={saving || loading || rows.length === 0}
              className="btn-base btn-primary min-w-[130px] justify-center flex items-center gap-1.5 text-xs px-5 py-2"
            >
              {saving ? (
                <>
                  <i className="fas fa-spinner fa-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <i className="fas fa-check" />
                  <span>Save ({rows.length} rows)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
