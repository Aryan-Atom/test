import React, { useState } from "react";
import { useI18n } from "../i18n.jsx";
import { APIcallPost } from "../axios/apiCall.js";
import { pocEndPoints } from "../axios/endPoints.js";
import { isStaticDataMode } from "../utils/staticDataMode.js";

const MATRIX_DETAIL_FIELDS = [
  {
    labelKey: "field.repWork",
    defaultLabel: "대표 작업명",
    keys: ["representativeWork", "representativeWorkName", "rep_work", "work_name", "workName"],
  },
  { labelKey: "field.equipmentCode", defaultLabel: "설비코드", keys: ["equipmentCode", "equipment_code", "equipmentId"] },
  { labelKey: "field.woCode", defaultLabel: "W/O코드", keys: ["wOCode", "woCode", "wo_code", "w/ocode"] },
  { labelKey: "field.process", defaultLabel: "공정", keys: ["process", "processName", "process_name"] },
  { labelKey: "field.equipmentName", defaultLabel: "설비명", keys: ["equipmentName", "equipment_name"] },
  {
    labelKey: "field.maintenance",
    defaultLabel: "보전파트",
    keys: ["maintGroup", "maintenanceType", "equipmentType", "equipmentTypeName", "equipment"],
  },
  { labelKey: "field.improvement", defaultLabel: "개선 작업", keys: ["work", "improvement", "work_description"] },
  { labelKey: "field.workPurpose", defaultLabel: "작업목적", keys: ["purpose", "workPurpose", "work_purpose"] },
  { labelKey: "field.situation", defaultLabel: "문제 현상", keys: ["situation", "problem", "problemSymptom"] },
  { labelKey: "field.cause", defaultLabel: "문제 원인", keys: ["cause", "problemCause"] },
  { labelKey: "field.bom", defaultLabel: "BOM", keys: ["bom", "BOM"] },
  { labelKey: "field.sparePart", defaultLabel: "자재명", keys: ["sparePart", "sparepart", "spare_part", "materialName"] },
  { labelKey: "field.hwBefore", defaultLabel: "HW 변경 전", keys: ["hwAsWas", "hwBefore", "hw_was", "hwWas"] },
  { labelKey: "field.hwAfter", defaultLabel: "HW 변경 후", keys: ["hwAsIs", "hwAfter", "hw_is", "hwIs"] },
  { labelKey: "field.swBefore", defaultLabel: "SW 변경 전", keys: ["swAsWas", "swBefore", "sw_was", "swWas"] },
  { labelKey: "field.swAfter", defaultLabel: "SW 변경 후", keys: ["swAsIs", "swAfter", "sw_is", "swIs"] },
  { labelKey: "field.report", defaultLabel: "Report내용", keys: ["report", "report_content", "reportContent"] },
  { labelKey: "field.site", defaultLabel: "법인", keys: ["site", "siteName", "corporation"] },
  { labelKey: "field.workedOn", defaultLabel: "작업완료일", keys: ["workedOn", "work_date", "worked_date", "workDate"] },
  { labelKey: "field.priority", defaultLabel: "중요도", keys: ["priority", "priorityName"] },
  { labelKey: "field.category", defaultLabel: "효과 유형", keys: ["category", "categoryName", "effectType"] },
  { labelKey: "field.woType", defaultLabel: "WO유형", keys: ["woType", "woTypeName", "workOrderType", "work_order_type"] },
];

function firstValue(item, keys) {
  if (!item) return "";
  for (const key of keys) {
    const value = item?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return "";
}

function getFormattedDateString(raw) {
  if (!raw) return "";
  if (!isNaN(Number(raw))) {
    const d = new Date(new Date(1899, 11, 30).getTime() + Number(raw) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  const parsed = new Date(raw);
  if (parsed && !isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return String(raw).trim();
}

function getSingleCellRecord(matchedRecords) {
  if (!matchedRecords) return null;
  if (!Array.isArray(matchedRecords)) return matchedRecords;
  if (matchedRecords.length === 0) return null;

  // 1. Check w/o applied
  const woRec = matchedRecords.find((i) => {
    const s = String(i?.status || i?.apply_status || i?.effectiveStatus || i?.rawStatus || "").toLowerCase().trim();
    return s === "w/o applied" || s === "wo_applied" || s === "wo applied" || s.includes("w/o");
  });
  if (woRec) return woRec;

  // 2. Check applied
  const appliedRec = matchedRecords.find((i) => {
    const s = String(i?.status || i?.apply_status || i?.effectiveStatus || i?.rawStatus || "").toLowerCase().trim();
    return s === "applied" || s === "1" || s === "0";
  });
  if (appliedRec) return appliedRec;

  // 3. Check notApplied
  const notAppliedRec = matchedRecords.find((i) => {
    const s = String(i?.status || i?.apply_status || i?.effectiveStatus || i?.rawStatus || "").toLowerCase().trim();
    return s === "notapplied" || s === "not_applied" || s === "not applied" || s === "rejected" || s === "2";
  });
  if (notAppliedRec) return notAppliedRec;

  return matchedRecords[0];
}

export default function MatrixDrawer({ item, onClose, onOpenApplyStatus }) {
  const { t } = useI18n();

  const [previewImage, setPreviewImage] = useState(null);
  const [editingRecord, setEditingRecord] = useState(null);

  if (!item) return null;

  const isArray = Array.isArray(item);
  const itemList = isArray ? item : item ? [item] : [];
  if (itemList.length === 0) return null;
  const firstItem = itemList[0] || {};

  const repWorkVal = firstValue(firstItem, [
    "representativeWork",
    "representativeWorkName",
    "rep_work",
    "work_name",
    "workName",
  ]);
  const siteVal = firstValue(firstItem, ["site", "siteName", "corporation"]);
  const equipmentName = firstValue(firstItem, ["equipmentName", "equipment_name"]);
  const equipmentCode = firstValue(firstItem, ["equipmentCode", "equipment_code"]);
  const woCode = firstValue(firstItem, ["wOCode", "woCode", "wo_code"]);

  const getRecordDetails = (rec) => {
    return MATRIX_DETAIL_FIELDS.map((field) => {
      let val = firstValue(rec, field.keys);
      if (field.labelKey === "field.workedOn" && val) {
        val = getFormattedDateString(val);
      }
      if (val === "0001-01-01T00:00:00" || val === "0001-01-01" || val === "" || val === undefined || val === null) {
        val = "-";
      }
      return {
        labelKey: field.labelKey,
        defaultLabel: field.defaultLabel,
        value: val,
      };
    });
  };

  const getAttachments = (rec) => {
    if (rec.attachments && Array.isArray(rec.attachments) && rec.attachments.length > 0) {
      return rec.attachments;
    }
    if (rec.imageData || rec.imageUrl) {
      const src = rec.imageData
        ? rec.imageData.startsWith("data:")
          ? rec.imageData
          : `data:image/jpeg;base64,${rec.imageData}`
        : rec.imageUrl;
      if (src) {
        return [
          {
            id: rec.imageId || "att-1",
            name: rec.imageName || "attachment.jpg",
            url: src,
            category: rec.imageCategoryName || "기타",
          },
        ];
      }
    }
    return [];
  };

  const renderValue = (detail) => {
    const val = detail.value;
    if (val === undefined || val === null || val === "" || val === "-") return "-";

    const key = detail.labelKey;
    if (key === "field.priority") {
      if (val === "중요" || val === "High") {
        return <span className="px-2 py-0.5 text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 rounded">{val}</span>;
      }
      return <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 rounded">{val}</span>;
    }

    if (key === "field.category") {
      return <span className="px-2 py-0.5 text-xs font-medium bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300 border border-sky-200 dark:border-sky-800 rounded">{val}</span>;
    }

    if (key === "field.woType") {
      return <span className="px-2 py-0.5 text-xs font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded">{val}</span>;
    }

    return String(val);
  };

  return (
    <>
      <div className="fixed inset-0 z-[9000] bg-slate-900/10 dark:bg-black/30 pointer-events-auto" onClick={onClose}>
        <aside
          className="fixed top-0 right-0 h-screen w-full max-w-[500px] z-[9500] bg-white dark:bg-gray-850 shadow-2xl border-l border-gray-200 dark:border-gray-750 flex flex-col pointer-events-auto animate-fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-750 flex items-start justify-between bg-white dark:bg-gray-850">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {t("drawer.title", "상세 정보")}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium leading-relaxed">
                {itemList.length > 1
                  ? `작업건수 : 총 ${itemList.length}건 | ${siteVal ? `${siteVal} ` : ""}${equipmentName || ""}${
                      equipmentCode ? ` (${equipmentCode})` : ""
                    }`
                  : `${repWorkVal ? `작업명 : ${repWorkVal}` : ""}${
                      repWorkVal && (siteVal || equipmentName || equipmentCode) ? " | " : ""
                    }${siteVal ? `${siteVal} ` : ""}${equipmentName || ""}${
                      equipmentCode ? ` (${equipmentCode})` : ""
                    }`}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            >
              <i className="fas fa-times text-base" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
            {itemList.map((rec, idx) => {
              const details = getRecordDetails(rec);
              const atts = getAttachments(rec);
              const recRepWork =
                firstValue(rec, [
                  "representativeWork",
                  "representativeWorkName",
                  "rep_work",
                  "workName",
                ]) || repWorkVal;

              const recStatus = String(
                rec.status || rec.apply_status || rec.effectiveStatus || rec.rawStatus || "",
              )
                .toLowerCase()
                .trim();

              const isApplied = recStatus === "applied" || recStatus === "1" || recStatus === "0";
              const isWoApplied =
                recStatus === "w/o applied" || recStatus === "wo_applied" || recStatus.includes("w/o");
              const isNotApplied =
                recStatus === "notapplied" ||
                recStatus === "not_applied" ||
                recStatus === "rejected" ||
                recStatus === "2";

              return (
                <div
                  key={idx}
                  className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3.5 shadow-2xs"
                >
                  {/* Item Header Pill */}
                  <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700/70">
                    <span className="px-2 py-0.5 text-[11px] font-bold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                      {t("detail.record", "항목")} {idx + 1}
                    </span>
                    <div className="flex items-center gap-1.5 text-xs font-bold min-w-0">
                      {isWoApplied ? (
                        <span className="text-blue-600 dark:text-blue-400 flex items-center gap-1 shrink-0">
                          <i className="fas fa-check-square" />
                          <span>W/O 적용완료</span>
                        </span>
                      ) : isApplied ? (
                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 shrink-0">
                          <i className="fas fa-check-square" />
                          <span>적용 확인</span>
                        </span>
                      ) : isNotApplied ? (
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
                            <i className="fas fa-times text-xs" />
                            <span>미적용 확인</span>
                          </div>
                          {Boolean(rec.reason || rec.reject_reason || rec.rejectReason) && (
                            <div className="flex items-center gap-1 text-[11px] font-medium text-gray-600 dark:text-gray-400 bg-red-50/80 dark:bg-red-950/40 px-2 py-0.5 rounded border border-red-100 dark:border-red-900/40">
                              <i className="fas fa-comment-dots text-red-500 text-[10px]" />
                              <span>{rec.reason || rec.reject_reason || rec.rejectReason}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500 flex items-center gap-1 shrink-0">
                          <i className="far fa-square" />
                          <span>미확인</span>
                        </span>
                      )}
                      {recRepWork && (
                        <span className="text-gray-800 dark:text-gray-200 truncate max-w-[210px]">
                          {recRepWork}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 22 Field List */}
                  <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2 text-xs leading-snug">
                    {details.map((detail, index) => (
                      <React.Fragment key={`${detail.labelKey}-${index}`}>
                        <dt className="font-semibold text-gray-500 dark:text-gray-400 text-right whitespace-nowrap">
                          {t(detail.labelKey, detail.defaultLabel)}
                        </dt>
                        <dd className="text-gray-900 dark:text-gray-100 font-medium break-words pre-wrap">
                          {renderValue(detail)}
                        </dd>
                      </React.Fragment>
                    ))}
                  </dl>

                  {/* Attachments Section */}
                  <div className="pt-3 border-t border-gray-100 dark:border-gray-700/70 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <i className="fas fa-camera text-gray-400 text-xs" />
                      <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                        첨부사진 ({atts ? atts.length : 0}개)
                      </span>
                    </div>
                    {atts && atts.length > 0 && (
                      <div
                        className="w-12 h-12 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden cursor-pointer group shrink-0"
                        onClick={() => setPreviewImage(atts[0])}
                      >
                        <img
                          src={atts[0].url}
                          alt="Attachment Preview"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer Action Buttons Bar */}
          <div className="px-5 py-3.5 border-t border-gray-200 dark:border-gray-750 bg-white dark:bg-gray-850 shrink-0 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              {/* Button 1: Edit */}
              <button
                type="button"
                onClick={() => setEditingRecord({ ...firstItem })}
                className="px-3.5 py-2 text-xs font-bold text-[#1745c2] dark:text-blue-400 border border-[#1745c2] dark:border-blue-400 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <i className="fas fa-pen-to-square text-xs" />
                <span>{t("app.edit", "편집")}</span>
              </button>

              {/* Button 2: Toggle Status */}
              {(() => {
                const firstStatus = String(
                  firstItem.status || firstItem.apply_status || firstItem.effectiveStatus || firstItem.rawStatus || "",
                )
                  .toLowerCase()
                  .trim();
                const isAppliedStatus = firstStatus === "applied" || firstStatus === "1" || firstStatus === "0";
                const isNotAppliedStatus =
                  firstStatus === "notapplied" ||
                  firstStatus === "not_applied" ||
                  firstStatus === "rejected" ||
                  firstStatus === "2";

                if (isAppliedStatus) {
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        const ev = new CustomEvent("openChangeStatusReasonModal", {
                          detail: { item: firstItem, targetStatus: "rejected" },
                        });
                        window.dispatchEvent(ev);
                      }}
                      className="px-3.5 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 border border-rose-600 dark:border-rose-400 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all flex items-center gap-1.5 cursor-pointer truncate"
                    >
                      <i className="fas fa-arrow-right text-[10px]" />
                      <span>{t("page.matrix.toNotApplied", "미적용으로 변경")}</span>
                    </button>
                  );
                }

                if (isNotAppliedStatus) {
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        const ev = new CustomEvent("changeStatusDirectly", {
                          detail: { item: firstItem, targetStatus: "applied" },
                        });
                        window.dispatchEvent(ev);
                      }}
                      className="px-3.5 py-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-600 dark:border-emerald-400 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-all flex items-center gap-1.5 cursor-pointer truncate"
                    >
                      <i className="fas fa-arrow-right text-[10px]" />
                      <span>{t("page.matrix.toApplied", "적용으로 변경")}</span>
                    </button>
                  );
                }

                return null;
              })()}

              {/* Button 3: Lateral Deployment */}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onOpenApplyStatus) {
                    onOpenApplyStatus(firstItem);
                  } else {
                    const ev = new CustomEvent("openLateralDeploymentModal", {
                      detail: { repWork: repWorkVal, item: firstItem },
                    });
                    window.dispatchEvent(ev);
                  }
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-[#1745c2] hover:bg-[#1239a5] rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <i className="fas fa-clipboard-check text-xs" />
                <span>{t("page.matrix.lateralModalTitle", "횡전개 관리")}</span>
              </button>
            </div>

            {/* Bottom Line: Photos status */}
            <div className="pt-2 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-400 dark:text-gray-500 font-medium flex items-center gap-2">
              <i className="fas fa-camera text-gray-400 text-xs" />
              <span>
                {(() => {
                  const atts = getAttachments(firstItem);
                  return atts && atts.length > 0
                    ? `첨부사진 (${atts.length}개)`
                    : t("page.matrix.noPhotos", "첨부된 사진이 없습니다");
                })()}
              </span>
            </div>
          </div>
        </aside>
      </div>

      {/* Lightbox Image Preview */}
      {previewImage && (
        <div className="lightbox-overlay animate-fade-in" onClick={() => setPreviewImage(null)}>
          <div className="lightbox-panel animate-scale-up" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="modal-close-btn absolute top-3 right-3 z-10"
              onClick={() => setPreviewImage(null)}
            >
              <i className="fas fa-times text-xs" />
            </button>
            <div className="lightbox-image-wrap">
              <img
                src={previewImage.url}
                alt={previewImage.name}
                className="max-w-full max-h-[75vh] object-contain"
              />
            </div>
            <div className="lightbox-caption">{previewImage.name || "attachment.jpg"}</div>
          </div>
        </div>
      )}

      {/* Integrated Edit Modal */}
      {editingRecord && (
        <div
          className="fixed inset-0 z-[100000] bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setEditingRecord(null)}
        >
          <div
            className="modal-panel max-w-xl w-full bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 relative animate-scale-up space-y-4 border border-gray-200 dark:border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-[#1745c2] dark:text-blue-400 flex items-center justify-center">
                  <i className="fas fa-pen-square text-sm" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                    {t("modal.editItemTitle", "항목 편집")}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                <i className="fas fa-times text-sm" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-700 dark:text-gray-300 font-bold mb-1">
                  대표 작업명 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editingRecord.representativeWork || editingRecord.representativeWorkName || ""}
                  onChange={(e) =>
                    setEditingRecord({ ...editingRecord, representativeWork: e.target.value })
                  }
                  className="w-full p-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-gray-700 dark:text-gray-300 font-bold mb-1">작업 목적</label>
                <input
                  type="text"
                  value={editingRecord.purpose || editingRecord.work || ""}
                  onChange={(e) => setEditingRecord({ ...editingRecord, purpose: e.target.value })}
                  className="w-full p-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 dark:text-gray-300 font-bold mb-1">문제 현상</label>
                  <input
                    type="text"
                    value={editingRecord.situation || editingRecord.symptom || ""}
                    onChange={(e) =>
                      setEditingRecord({ ...editingRecord, situation: e.target.value })
                    }
                    className="w-full p-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 dark:text-gray-300 font-bold mb-1">문제 원인</label>
                  <input
                    type="text"
                    value={editingRecord.cause || ""}
                    onChange={(e) => setEditingRecord({ ...editingRecord, cause: e.target.value })}
                    className="w-full p-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-800"
              >
                {t("app.cancellation", "취소")}
              </button>
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                className="px-5 py-2 text-xs font-bold text-white bg-[#1745c2] hover:bg-[#1239a5] rounded-xl shadow-md"
              >
                {t("app.save", "저장")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
