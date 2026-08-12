import React, { useState } from "react";
import { useI18n } from "../i18n.jsx";
import { APIcallPost } from "../axios/apiCall.js";
import { pocEndPoints } from "../axios/endPoints.js";
import { isStaticDataMode } from "../utils/staticDataMode.js";

const COLUMN_LABEL_KEYS = {
  process: "field.process",
  processName: "field.process",
  maintGroup: "field.maintenance",
  maintGroupName: "field.maintenance",
  maintenanceType: "field.maintenanceType",
  site: "field.site",
  siteName: "field.site",
  representativeWork: "field.repWork",
  representativeWorkName: "field.repWork",
  priority: "field.priority",
  priorityName: "field.priority",
  category: "field.category",
  categoryName: "field.category",
  work: "field.work",
  purpose: "field.work",
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
  hwAsWas: "field.hwBefore",
  hwAsIs: "field.hwAfter",
  swAsWas: "field.swBefore",
  swAsIs: "field.swAfter",
  woCode: "field.woCode",
  wOCode: "field.woCode",
  workedOn: "field.workedOn",
  improvement: "field.improvement",
  version: "field.version",
  specName: "field.specName",
  specValue: "field.specValue",
  specVersion: "field.specVersion",
  equipmentId: "field.equipmentId",
  registeredBy: "field.registeredBy",
  createdBy: "field.registeredBy",
  registeredAt: "field.registeredAt",
  createdAt: "field.registeredAt",
  creationDate: "field.registeredAt",
  editedBy: "field.editedBy",
  modifiedBy: "field.editedBy",
  editedAt: "field.editedAt",
  modifiedAt: "field.editedAt",
  modificationDate: "field.editedAt",
};

const CHANGE_DETAIL_FIELDS = [
  {
    labelKey: "field.repWork",
    keys: [
      "representativeWork",
      "representativeWorkName",
      "rep_work",
      "work_name",
      "workName",
    ],
  },
  { labelKey: "field.equipmentCode", keys: ["equipmentCode", "equipment_code", "equipmentId"] },
  {
    labelKey: "field.woCode",
    keys: ["wOCode", "woCode", "wo_code", "w/ocode"],
  },
  { labelKey: "field.process", keys: ["process", "processName", "process_name"] },
  { labelKey: "field.equipmentName", keys: ["equipmentName", "equipment_name"] },
  {
    labelKey: "field.maintenance",
    keys: ["maintGroup", "maintenanceType", "equipmentType", "equipmentTypeName", "equipment"],
  },
  { labelKey: "field.improvement", keys: ["work", "improvement", "work_description"] },
  { labelKey: "field.workPurpose", keys: ["purpose", "workPurpose", "work_purpose"] },
  { labelKey: "field.situation", keys: ["situation", "problem", "problemSymptom"] },
  { labelKey: "field.cause", keys: ["cause", "problemCause"] },
  { labelKey: "field.bom", keys: ["bom", "BOM"] },
  { labelKey: "field.sparePart", keys: ["sparePart", "sparepart", "spare_part", "materialName"] },
  { labelKey: "field.hwBefore", keys: ["hwAsWas", "hwBefore", "hw_was", "hwWas"] },
  { labelKey: "field.hwAfter", keys: ["hwAsIs", "hwAfter", "hw_is", "hwIs"] },
  { labelKey: "field.swBefore", keys: ["swAsWas", "swBefore", "sw_was", "swWas"] },
  { labelKey: "field.swAfter", keys: ["swAsIs", "swAfter", "sw_is", "swIs"] },
  { labelKey: "field.report", keys: ["report", "report_content", "reportContent"] },
  { labelKey: "field.site", keys: ["site", "siteName", "corporation"] },
  { labelKey: "field.workedOn", keys: ["workedOn", "work_date", "worked_date", "workDate"] },
  { labelKey: "field.priority", keys: ["priority", "priorityName"] },
  { labelKey: "field.category", keys: ["category", "categoryName", "effectType"] },
  { labelKey: "field.woType", keys: ["woType", "woTypeName", "workOrderType", "work_order_type"] },
];

const SPEC_DETAIL_FIELDS = [
  { labelKey: "field.process", keys: ["process", "processName"] },
  { labelKey: "field.site", keys: ["site", "siteName"] },
  { labelKey: "field.maintenanceType", keys: ["maintGroup", "maintenanceType"] },
  { labelKey: "field.equipmentCode", keys: ["equipmentCode"] },
  { labelKey: "field.equipmentName", keys: ["equipmentName"] },
  { labelKey: "field.version", keys: ["version"] },
  { labelKey: "field.specName", keys: ["specName"] },
  { labelKey: "field.specValue", keys: ["specValue"] },
];

const DEMO_SAMPLE_ATTACHMENT = {
  id: "demo-photo-1",
  name: "1000137952.jpg",
  url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80",
  category: "기타",
};

function firstValue(item, keys) {
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

function rowLooksLikeSpec(item) {
  return Boolean(firstValue(item, ["specName", "specValue", "version", "specVersion"]));
}

function getRecordDetails(item, t) {
  const isSpec = rowLooksLikeSpec(item);
  const rawFields = isSpec ? SPEC_DETAIL_FIELDS : CHANGE_DETAIL_FIELDS;

  const modifiedByVal = firstValue(item, [
    "modifiedBy",
    "modified_by",
    "editedBy",
    "edited_by",
    "updatedBy",
    "updated_by",
    "editor",
  ]);
  const modifiedAtVal = firstValue(item, [
    "modifiedOn",
    "modified_on",
    "modifiedAt",
    "modified_at",
    "editedAt",
    "edited_at",
    "updatedAt",
    "updated_at",
    "modificationDate",
  ]);

  const isValidValue = (val) => {
    if (val === undefined || val === null) return false;
    const str = String(val).trim();
    if (!str || str === "0" || str === "-" || str === "—" || str === "N/A" || str === "undefined" || str === "null") return false;
    if (str.startsWith("0001-01-01")) return false;
    return true;
  };

  const hasModifiedBy = isValidValue(modifiedByVal);
  const hasModifiedAt = isValidValue(modifiedAtVal);

  const lastByField = hasModifiedBy
    ? {
        labelKey: "field.editedBy",
        keys: ["modifiedBy", "modified_by", "editedBy", "edited_by", "updatedBy", "updated_by", "editor"],
      }
    : {
        labelKey: "field.registeredBy",
        keys: ["createdBy", "created_by", "registeredBy", "registered_by", "uploadedBy", "uploaded_by", "author", "registrant"],
      };

  const lastAtField = hasModifiedAt
    ? {
        labelKey: "field.editedAt",
        keys: [
          "modifiedOn",
          "modified_on",
          "modifiedAt",
          "modified_at",
          "editedAt",
          "edited_at",
          "updatedAt",
          "updated_at",
          "modificationDate",
        ],
      }
    : {
        labelKey: "field.registeredAt",
        keys: [
          "createdOn",
          "created_on",
          "createdAt",
          "created_at",
          "registeredAt",
          "registered_at",
          "creationDate",
          "registeredDate",
        ],
      };

  const baseFields = rawFields.filter(
    (f) =>
      f.labelKey !== "field.registeredBy" &&
      f.labelKey !== "field.registeredAt" &&
      f.labelKey !== "field.createdBy" &&
      f.labelKey !== "field.createdAt" &&
      f.labelKey !== "field.editedBy" &&
      f.labelKey !== "field.editedAt" &&
      f.labelKey !== "field.modifiedBy" &&
      f.labelKey !== "field.modifiedAt",
  );

  const orderedFields = [...baseFields, lastByField, lastAtField];

  const createdByVal =
    firstValue(item, [
      "createdBy",
      "created_by",
      "registeredBy",
      "registered_by",
      "uploadedBy",
      "uploaded_by",
      "author",
      "registrant",
    ]) || "admin";

  const createdAtVal =
    getFormattedDateString(
      firstValue(item, [
        "createdOn",
        "created_on",
        "createdAt",
        "created_at",
        "registeredAt",
        "registered_at",
        "creationDate",
        "registeredDate",
      ]),
    ) ||
    getFormattedDateString(firstValue(item, ["workedOn", "work_date"])) ||
    "2026-06-26";

  const formattedModifiedAt = getFormattedDateString(modifiedAtVal);

  const orderedDetails = orderedFields.map((field) => {
    let val = firstValue(item, field.keys);

    if (field.labelKey === "field.registeredBy" || field.labelKey === "field.createdBy") {
      if (!isValidValue(val)) val = createdByVal;
    }
    if (field.labelKey === "field.registeredAt" || field.labelKey === "field.createdAt") {
      if (!isValidValue(val)) val = createdAtVal;
      else val = getFormattedDateString(val);
    }
    if (field.labelKey === "field.editedBy" || field.labelKey === "field.modifiedBy") {
      if (!isValidValue(val)) val = modifiedByVal || createdByVal;
    }
    if (field.labelKey === "field.editedAt" || field.labelKey === "field.modifiedAt") {
      if (!isValidValue(val)) val = formattedModifiedAt || createdAtVal;
      else val = getFormattedDateString(val);
    }
    if (field.labelKey === "field.workedOn") {
      if (val) val = getFormattedDateString(val);
    }

    if (val === "0001-01-01T00:00:00" || val === "0001-01-01" || val === "" || val === undefined || val === null) {
      val = "—";
    }

    return {
      labelKey: field.labelKey,
      label: t(field.labelKey),
      value: val,
    };
  });

  return orderedDetails;
}

export default function Drawer({
  item,
  onClose,
  allowEdit = false,
  showEdit = false,
  showAttachments = true,
  showFooter = true,
  variant = "default",
}) {
  const { t } = useI18n();

  const [previewImage, setPreviewImage] = useState(null);
  const [editingRecord, setEditingRecord] = useState(null);
  const [activeTab, setActiveTab] = useState("others");
  const [attachmentsMap, setAttachmentsMap] = useState({});

  if (!item) return null;

  const isArray = Array.isArray(item);
  const firstItem = isArray ? item[0] : item;

  const woCode = firstValue(firstItem, [
    "wOCode",
    "woCode",
    "workOrderTypeName",
    "work_order_type_name",
  ]);
  const equipmentName = firstValue(firstItem, ["equipmentName", "equipment_name"]);
  const equipmentCode = firstValue(firstItem, ["equipmentCode", "equipment_code"]);

  const isChangeHistoryView = variant === "changeHistory" || (!showEdit && !showFooter);

  const getAttachments = (rec, idx = 0) => {
    const recKey = rec.id || rec.changeHistoryId || rec.wOCode || rec.woCode || `rec-${idx}`;
    if (attachmentsMap[recKey] !== undefined) {
      return attachmentsMap[recKey];
    }
    if (rec.attachments && Array.isArray(rec.attachments) && rec.attachments.length > 0) {
      return rec.attachments;
    }
    if (rec.imageData || rec.imageUrl || rec.imageName) {
      const src = rec.imageData
        ? rec.imageData.startsWith("data:")
          ? rec.imageData
          : `data:image/jpeg;base64,${rec.imageData}`
        : rec.imageUrl;
      if (src) {
        return [
          {
            id: rec.imageId || `att-${idx}`,
            name: rec.imageName || "attachment.jpg",
            url: src,
            category: rec.imageCategoryName || "기타",
          },
        ];
      }
    }
    if (rec.wOCode === "W009056401" || rec.woCode === "W009056401" || rec.samplePhoto) {
      return [DEMO_SAMPLE_ATTACHMENT];
    }
    return [];
  };

  const handleFileUpload = (e, recKey) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    files.forEach((file, i) => {
      const categoryLabel =
        activeTab === "problem"
          ? "문제 현상"
          : activeTab === "after"
            ? "개선 후"
            : activeTab === "equipment"
              ? "설비 참고"
              : "기타";

      const reader = new FileReader();
      reader.onload = (evt) => {
        const base64Str = evt.target.result;
        const newAtt = {
          id: `att-${Date.now()}-${i}`,
          name: file.name,
          url: base64Str,
          fileContent: base64Str,
          category: categoryLabel,
        };
        setAttachmentsMap((prev) => {
          const existing =
            prev[recKey] || (editingRecord?.attachments ? [...editingRecord.attachments] : []);
          return {
            ...prev,
            [recKey]: [...existing, newAtt],
          };
        });
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSaveRecord = () => {
    if (!editingRecord) return;
    const recKey = editingRecord.id || editingRecord.wOCode || editingRecord.woCode || `rec-0`;
    const updatedAtts = attachmentsMap[recKey] || editingRecord.attachments || [];

    editingRecord.attachments = updatedAtts;
    editingRecord._modified = true;
    editingRecord.editedBy = "admin";
    editingRecord.editedAt = new Date().toISOString().slice(0, 19).replace("T", " ");

    const historyId = Number(
      editingRecord.id || editingRecord.historyId || editingRecord.changeHistoryId || 0,
    );
    const imagesPayload = updatedAtts.map((att, idx) => ({
      filename: att.name || att.filename || `image_${idx + 1}.png`,
      fileContent: att.fileContent || att.url || "",
      category: att.category || "기타",
      caption: att.caption || att.name || "",
      sortOrder: idx,
    }));

    const saveImagePayload = {
      historyId,
      images: imagesPayload,
    };

    if (!isStaticDataMode && pocEndPoints?.SAVE_IMAGE) {
      APIcallPost(pocEndPoints.SAVE_IMAGE, saveImagePayload, {}, (responseData, status) => {
        if (status >= 200 && status < 300) {
          console.log("SaveImage API success:", responseData);
        } else {
          console.error("SaveImage API failed:", status, responseData);
        }
      });
    }

    setEditingRecord(null);
  };

  const renderValue = (detail) => {
    const val = detail.value;
    if (val === undefined || val === null || val === "" || val === "-") return "—";

    const key = detail.labelKey;

    // Format date fields
    if (key === "field.workedOn" || key === "field.registeredAt" || key === "field.editedAt") {
      const formatted = getFormattedDateString(val);
      if (formatted) return formatted;
    }

    if (!isChangeHistoryView) {
      if (key === "field.priority") {
        if (val === "중요" || val === "High") {
          return <span className="badge badge-danger">{val}</span>;
        }
        if (val === "일반" || val === "Normal") {
          return <span className="badge badge-success">{val}</span>;
        }
      }
      if (key === "field.category") {
        return <span className="badge badge-primary">{val}</span>;
      }
    }
    return String(val);
  };

  return (
    <>
      <div className="eq-drawer-overlay">
        <aside
          className="eq-drawer"
          style={{ pointerEvents: "auto" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="eq-drawer-header">
            <div>
              <h2 className="eq-drawer-title">{t("drawer.title", "상세 정보")}</h2>
              <p
                className="eq-drawer-subtitle flex flex-wrap items-center gap-x-1.5 mt-1 text-xs"
              >
                {isChangeHistoryView ? (
                  <span className="text-gray-500 dark:text-gray-400 font-medium">
                    W/O코드: {woCode || "N/A"} | 설비: {equipmentName || ""}{equipmentCode ? ` (${equipmentCode})` : ""}
                  </span>
                ) : (
                  (() => {
                    const repWorkVal = firstValue(firstItem, [
                      "representativeWork",
                      "representativeWorkName",
                      "rep_work",
                      "work_name",
                      "workName",
                    ]);
                    const siteVal = firstValue(firstItem, ["site", "siteName", "corporation"]);

                    return (
                      <span className="text-gray-500 dark:text-gray-400 font-medium">
                        {repWorkVal ? `작업명 : ${repWorkVal}` : ""}
                        {repWorkVal && (siteVal || equipmentName || equipmentCode) ? " | " : ""}
                        {siteVal ? `${siteVal} ` : ""}
                        {equipmentName || ""}
                        {equipmentCode ? ` (${equipmentCode})` : ""}
                      </span>
                    );
                  })()
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="eq-drawer-close"
              aria-label={t("app.close")}
            >
              <i className="fas fa-times" />
            </button>
          </div>

          <div className="eq-drawer-body flex-1 overflow-y-auto p-5 space-y-4">
            {(isArray ? item : [item]).map((rec, idx) => {
              const details = getRecordDetails(rec, t);
              const atts = getAttachments(rec, idx);
              const recRepWork =
                firstValue(rec, [
                  "representativeWork",
                  "representativeWorkName",
                  "rep_work",
                  "workName",
                ]) || "";
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
                <div key={idx} className="detail-group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3 shadow-2xs">
                  {/* Card Section Header */}
                  {isChangeHistoryView ? (
                    <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-700/60">
                      <span className="text-xs font-bold text-[#1745c2] dark:text-blue-400">
                        레코드 상세
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700/60">
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
                          <span className="text-gray-400 dark:text-gray-500 flex items-center gap-1 shrink-0">
                            <i className="fas fa-square-xmark" />
                            <span>미적용 확인</span>
                          </span>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500 flex items-center gap-1 shrink-0">
                            <i className="far fa-square" />
                            <span>미확인</span>
                          </span>
                        )}
                        {recRepWork && (
                          <span className="text-gray-800 dark:text-gray-200 truncate max-w-[200px]">
                            {recRepWork}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Detail Field DL */}
                  <dl className="detail-field">
                    {details.map((detail, index) => (
                      <div key={`${detail.label}-${index}`} style={{ display: "contents" }}>
                        <dt>{detail.label}</dt>
                        <dd>{renderValue(detail)}</dd>
                      </div>
                    ))}
                  </dl>

                  {/* Attachment Section */}
                  {showAttachments && !isChangeHistoryView && (
                    <div className="pt-3 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-between">
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
                  )}
                </div>
              );
            })}
          </div>

          {/* Drawer Footer Buttons Bar */}
          {showFooter && !isChangeHistoryView && (showEdit || allowEdit) && (
            <div className="eq-drawer-footer px-5 py-3.5 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shrink-0 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setEditingRecord({ ...firstItem })}
                className="px-4 py-2 text-xs font-bold text-[#1745c2] dark:text-blue-400 border border-[#1745c2] dark:border-blue-400 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <i className="fas fa-pen-to-square text-xs" />
                <span>{t("app.edit", "편집")}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  const repWork = firstValue(firstItem, [
                    "representativeWork",
                    "representativeWorkName",
                    "rep_work",
                    "work_name",
                  ]);
                  const ev = new CustomEvent("openLateralDeploymentModal", {
                    detail: { repWork, item: firstItem },
                  });
                  window.dispatchEvent(ev);
                }}
                className="px-5 py-2 text-xs font-bold text-white bg-[#1745c2] hover:bg-[#1239a5] rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <i className="fas fa-clipboard-check text-xs" />
                <span>{t("page.matrix.lateralModalTitle", "횡전개 관리")}</span>
              </button>
            </div>
          )}
        </aside>
      </div>

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

      {editingRecord && (
        <div
          className="modal-overlay animate-fade-in overflow-y-auto"
          onClick={() => setEditingRecord(null)}
        >
          <div
            className="modal-panel modal-panel-xl p-6 relative my-8 max-h-[90vh] flex flex-col animate-scale-up w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header shrink-0 !px-0 !pt-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="modal-icon-wrap">
                  <i className="fas fa-pen-square text-base" />
                </div>
                <div className="min-w-0">
                  <h3 className="modal-title">{t("modal.editItemTitle", "항목 편집")}</h3>
                  <p className="modal-description">
                    {t(
                      "modal.editItemSub",
                      "Work Order 항목입니다. 법인과 작업완료일은 수정할 수 없습니다.",
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn shrink-0"
                onClick={() => setEditingRecord(null)}
              >
                <i className="fas fa-times text-xs" />
              </button>
            </div>

            <div className="modal-body flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar text-xs !p-0 !pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="modal-field-label">{t("field.process", "공정")}</label>
                  <input
                    type="text"
                    disabled
                    readOnly
                    value={editingRecord.process || editingRecord.processName || "02.배치"}
                    className="modal-readonly-field"
                  />
                </div>
                <div>
                  <label className="modal-field-label">
                    {t("field.equipmentType", "EQUIPMENT TYPE")}
                  </label>
                  <input
                    type="text"
                    disabled
                    readOnly
                    value={
                      editingRecord.maintGroup ||
                      editingRecord.maintGroupName ||
                      editingRecord.maintenanceType ||
                      "0202. Nano Mill"
                    }
                    className="modal-readonly-field"
                  />
                </div>
              </div>

              <div>
                <label className="modal-field-label">
                  대표 작업명 <span className="text-text-danger">*</span>
                </label>
                <input
                  type="text"
                  value={
                    editingRecord.representativeWork || editingRecord.representativeWorkName || ""
                  }
                  onChange={(e) =>
                    setEditingRecord({ ...editingRecord, representativeWork: e.target.value })
                  }
                  className="modal-input"
                />
              </div>

              <div>
                <label className="modal-field-label">작업 목적</label>
                <input
                  type="text"
                  value={editingRecord.purpose || editingRecord.work || ""}
                  onChange={(e) => setEditingRecord({ ...editingRecord, purpose: e.target.value })}
                  className="modal-input"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="modal-field-label">
                    문제 현상 <span className="text-text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    value={editingRecord.situation || editingRecord.symptom || ""}
                    onChange={(e) =>
                      setEditingRecord({
                        ...editingRecord,
                        situation: e.target.value,
                        symptom: e.target.value,
                      })
                    }
                    className="modal-input"
                  />
                </div>
                <div>
                  <label className="modal-field-label">문제 원인</label>
                  <input
                    type="text"
                    value={editingRecord.cause || ""}
                    onChange={(e) => setEditingRecord({ ...editingRecord, cause: e.target.value })}
                    className="modal-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="modal-field-label">BOM</label>
                  <input
                    type="text"
                    placeholder="BOM 입력"
                    value={editingRecord.bom || ""}
                    onChange={(e) => setEditingRecord({ ...editingRecord, bom: e.target.value })}
                    className="modal-input"
                  />
                </div>
                <div>
                  <label className="modal-field-label">자재명</label>
                  <input
                    type="text"
                    placeholder="자재명 입력"
                    value={editingRecord.sparePart || editingRecord.materialName || ""}
                    onChange={(e) =>
                      setEditingRecord({
                        ...editingRecord,
                        sparePart: e.target.value,
                        materialName: e.target.value,
                      })
                    }
                    className="modal-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="modal-field-label">HW 변경 전</label>
                  <input
                    type="text"
                    value={editingRecord.hwBefore || editingRecord.hwAsWas || "정보 없음"}
                    onChange={(e) =>
                      setEditingRecord({
                        ...editingRecord,
                        hwBefore: e.target.value,
                        hwAsWas: e.target.value,
                      })
                    }
                    className="modal-input"
                  />
                </div>
                <div>
                  <label className="modal-field-label">HW 변경 후</label>
                  <input
                    type="text"
                    value={editingRecord.hwAfter || editingRecord.hwAsIs || "정보 없음"}
                    onChange={(e) =>
                      setEditingRecord({
                        ...editingRecord,
                        hwAfter: e.target.value,
                        hwAsIs: e.target.value,
                      })
                    }
                    className="modal-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="modal-field-label">SW 변경 전</label>
                  <input
                    type="text"
                    value={editingRecord.swBefore || editingRecord.swAsWas || "정보 없음"}
                    onChange={(e) =>
                      setEditingRecord({
                        ...editingRecord,
                        swBefore: e.target.value,
                        swAsWas: e.target.value,
                      })
                    }
                    className="modal-input"
                  />
                </div>
                <div>
                  <label className="modal-field-label">SW 변경 후</label>
                  <input
                    type="text"
                    value={editingRecord.swAfter || editingRecord.swAsIs || "정보 없음"}
                    onChange={(e) =>
                      setEditingRecord({
                        ...editingRecord,
                        swAfter: e.target.value,
                        swAsIs: e.target.value,
                      })
                    }
                    className="modal-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="modal-field-label">중요도</label>
                  <select
                    value={editingRecord.priority || editingRecord.priorityName || "중요"}
                    onChange={(e) =>
                      setEditingRecord({
                        ...editingRecord,
                        priority: e.target.value,
                        priorityName: e.target.value,
                      })
                    }
                    className="modal-select"
                  >
                    <option value="중요">중요</option>
                    <option value="일반">일반</option>
                  </select>
                </div>
                <div>
                  <label className="modal-field-label">효과 유형</label>
                  <select
                    value={editingRecord.category || editingRecord.effectCategory || "품질"}
                    onChange={(e) =>
                      setEditingRecord({
                        ...editingRecord,
                        category: e.target.value,
                        effectCategory: e.target.value,
                      })
                    }
                    className="modal-select"
                  >
                    <option value="품질">품질</option>
                    <option value="보전성">보전성</option>
                    <option value="생산성">생산성</option>
                    <option value="기타">기타</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="modal-field-label">작업완료일</label>
                  <input
                    type="text"
                    disabled
                    value={editingRecord.workedOn || "2026-03-09"}
                    className="modal-readonly-field"
                  />
                </div>
                <div>
                  <label className="modal-field-label">요청 법인</label>
                  <input
                    type="text"
                    disabled
                    value={editingRecord.site || editingRecord.siteName || "D1.필리핀"}
                    className="modal-readonly-field"
                  />
                </div>
              </div>

              <div className="pt-2">
                <div className="drawer-tab-bar">
                  {[
                    { id: "problem", label: "문제 현상" },
                    { id: "after", label: "개선 후" },
                    { id: "equipment", label: "설비 참고" },
                    { id: "others", label: "기타" },
                  ].map((tab) => {
                    const recKey =
                      editingRecord.id || editingRecord.wOCode || editingRecord.woCode || `rec-0`;
                    const currentAtts = attachmentsMap[recKey] || editingRecord.attachments || [];
                    const tabCount = currentAtts.filter((a) => a.category === tab.label).length;

                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={`drawer-tab-btn ${activeTab === tab.id ? "active" : ""}`}
                      >
                        {tab.label} {tabCount}장
                      </button>
                    );
                  })}
                </div>

                <label className="drawer-upload-zone">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) =>
                      handleFileUpload(
                        e,
                        editingRecord.id || editingRecord.wOCode || editingRecord.woCode || `rec-0`,
                      )
                    }
                  />
                  <div className="drawer-upload-icon">
                    <i className="fas fa-cloud-upload-alt text-base" />
                  </div>
                  <span className="drawer-upload-hint">
                    사진을 드래그하거나 클릭하여 업로드 (같은 그룹 항목에 자동 공유)
                  </span>
                </label>
              </div>
            </div>

            <div className="modal-footer shrink-0 !px-0 !pb-0">
              <button
                type="button"
                className="modal-cancel-btn"
                onClick={() => setEditingRecord(null)}
              >
                {t("app.cancellation", "취소")}
              </button>
              <button type="button" onClick={handleSaveRecord} className="btn-base btn-primary">
                <i className="fas fa-check text-xs" />
                <span>{t("app.save", "저장하기")}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
