import React, { useState } from "react";
import { useI18n } from "../i18n.jsx";

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
  { labelKey: "field.repWork", keys: ["representativeWork", "representativeWorkName"] },
  { labelKey: "field.equipmentCode", keys: ["equipmentCode"] },
  { labelKey: "field.woCode", keys: ["wOCode", "woCode"] },
  { labelKey: "field.process", keys: ["process", "processName"] },
  { labelKey: "field.equipmentName", keys: ["equipmentName"] },
  { labelKey: "field.maintenance", keys: ["maintGroup", "maintGroupName"] },
  { labelKey: "field.improvement", keys: ["improvement"] },
  { labelKey: "field.work", keys: ["work", "purpose"] },
  { labelKey: "field.situation", keys: ["situation"] },
  { labelKey: "field.cause", keys: ["cause"] },
  { labelKey: "field.bom", keys: ["bom"] },
  { labelKey: "field.sparePart", keys: ["sparePart"] },
  { labelKey: "field.hwBefore", keys: ["hwAsWas", "hwBefore"] },
  { labelKey: "field.hwAfter", keys: ["hwAsIs", "hwAfter"] },
  { labelKey: "field.swBefore", keys: ["swAsWas", "swBefore"] },
  { labelKey: "field.swAfter", keys: ["swAsIs", "swAfter"] },
  { labelKey: "field.report", keys: ["report"] },
  { labelKey: "field.site", keys: ["site", "siteName"] },
  { labelKey: "field.workedOn", keys: ["workedOn"] },
  { labelKey: "field.priority", keys: ["priority", "priorityName"] },
  { labelKey: "field.category", keys: ["category", "categoryName"] },
  { labelKey: "field.registeredBy", keys: ["registeredBy", "createdBy", "author", "registrant"] },
  { labelKey: "field.registeredAt", keys: ["registeredAt", "createdAt", "creationDate", "registeredDate"] },
  { labelKey: "field.editedBy", keys: ["editedBy", "modifiedBy", "editor"] },
  { labelKey: "field.editedAt", keys: ["editedAt", "modifiedAt", "modificationDate", "editedDate"] },
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
  { labelKey: "field.registeredBy", keys: ["registeredBy", "createdBy", "author", "registrant"] },
  { labelKey: "field.registeredAt", keys: ["registeredAt", "createdAt", "creationDate", "registeredDate"] },
  { labelKey: "field.editedBy", keys: ["editedBy", "modifiedBy", "editor"] },
  { labelKey: "field.editedAt", keys: ["editedAt", "modifiedAt", "modificationDate", "editedDate"] },
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

function rowLooksLikeSpec(item) {
  return Boolean(firstValue(item, ["specName", "specValue", "version", "specVersion"]));
}

function getRecordDetails(item, t) {
  const orderedFields = rowLooksLikeSpec(item) ? SPEC_DETAIL_FIELDS : CHANGE_DETAIL_FIELDS;
  const usedKeys = new Set(orderedFields.flatMap((field) => field.keys));

  const registeredByVal = firstValue(item, ["registeredBy", "createdBy", "author", "registrant"]) || "admin";
  const registeredAtVal = firstValue(item, ["registeredAt", "createdAt", "creationDate", "registeredDate"]) || firstValue(item, ["workedOn"]) || "2026-07-09 16:11:24";
  const editedByVal = firstValue(item, ["editedBy", "modifiedBy", "editor"]) || (item?._modified || item?.isDirty ? "admin" : "");
  const editedAtVal = firstValue(item, ["editedAt", "modifiedAt", "modificationDate", "editedDate"]) || (item?._modified || item?.isDirty ? "2026-07-09 16:11:24" : "");

  const orderedDetails = orderedFields
    .map((field) => {
      let val = firstValue(item, field.keys);
      if (field.labelKey === "field.registeredBy" && !val) val = registeredByVal;
      if (field.labelKey === "field.registeredAt" && !val) val = registeredAtVal;
      if (field.labelKey === "field.editedBy" && !val) val = editedByVal;
      if (field.labelKey === "field.editedAt" && !val) val = editedAtVal;

      return {
        labelKey: field.labelKey,
        label: t(field.labelKey),
        value: val,
      };
    })
    .filter((detail) => {
      if ((detail.labelKey === "field.editedBy" || detail.labelKey === "field.editedAt") && (!detail.value || detail.value === "-")) {
        return false;
      }
      return true;
    });

  const extraDetails = Object.entries(item)
    .filter(
      ([key, value]) =>
        !usedKeys.has(key) &&
        !key.startsWith("_") &&
        key !== "id" &&
        key !== "type" &&
        key !== "attachments" &&
        key !== "samplePhoto" &&
        value !== undefined,
    )
    .map(([key, value]) => ({
      labelKey: COLUMN_LABEL_KEYS[key] ?? `field.${key}`,
      label: t(COLUMN_LABEL_KEYS[key] ?? `field.${key}`, key),
      value,
    }));
  return [...orderedDetails, ...extraDetails];
}

export default function Drawer({ item, onClose }) {
  const { t } = useI18n();

  const [previewImage, setPreviewImage] = useState(null);
  const [editingRecord, setEditingRecord] = useState(null);
  const [activeTab, setActiveTab] = useState("others");
  const [attachmentsMap, setAttachmentsMap] = useState({});

  if (!item) return null;

  const isArray = Array.isArray(item);
  const firstItem = isArray ? item[0] : item;

  const woCode = firstValue(firstItem, ["wOCode", "woCode"]);
  const equipmentName = firstValue(firstItem, ["equipmentName"]);
  const equipmentCode = firstValue(firstItem, ["equipmentCode"]);

  const getAttachments = (rec, idx = 0) => {
    const recKey = rec.id || rec.wOCode || rec.woCode || `rec-${idx}`;
    if (attachmentsMap[recKey] !== undefined) {
      return attachmentsMap[recKey];
    }
    if (rec.attachments && Array.isArray(rec.attachments)) {
      return rec.attachments;
    }
    // Demo attachment for W009056401 or first item if specified
    if (rec.wOCode === "W009056401" || rec.woCode === "W009056401" || rec.samplePhoto) {
      return [DEMO_SAMPLE_ATTACHMENT];
    }
    return [];
  };

  const handleFileUpload = (e, recKey) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newAtts = files.map((file, i) => ({
      id: `att-${Date.now()}-${i}`,
      name: file.name,
      url: URL.createObjectURL(file),
      category: activeTab === "problem" ? "문제 현상" : activeTab === "after" ? "개선 후" : activeTab === "equipment" ? "설비 참고" : "기타",
    }));

    setAttachmentsMap((prev) => {
      const existing = prev[recKey] || (editingRecord?.attachments ? [...editingRecord.attachments] : []);
      return {
        ...prev,
        [recKey]: [...existing, ...newAtts],
      };
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

    setEditingRecord(null);
  };

  const renderValue = (detail) => {
    const val = detail.value;
    if (val === undefined || val === null || val === "") return "-";

    const key = detail.labelKey;
    if (key === "field.priority") {
      if (val === "중요" || val === "High") {
        return <span className="badge badge-error">{val}</span>;
      }
      if (val === "일반" || val === "Normal") {
        return <span className="badge badge-success">{val}</span>;
      }
    }
    if (key === "field.category") {
      return <span className="badge badge-primary">{val}</span>;
    }
    return String(val);
  };

  return (
    <>
      <div className="eq-drawer-overlay">
        <aside className="eq-drawer" style={{ pointerEvents: "auto" }} onClick={(e) => e.stopPropagation()}>
          <div className="eq-drawer-header">
            <div>
              <h2 className="eq-drawer-title">{t("drawer.title", "상세 정보")}</h2>
              <p className="eq-drawer-subtitle flex flex-wrap items-center gap-x-2" style={{ fontSize: "12px", lineHeight: "1.4" }}>
                {woCode && (
                  <span>
                    <span style={{ color: "var(--text-subtlest, #7e8a9e)", fontWeight: 500 }}>{t("field.woCode", "W/O코드")}: </span>
                    <span style={{ color: "var(--text-default, #111827)", fontWeight: 600 }}>{woCode}</span>
                  </span>
                )}
                {woCode && (equipmentName || equipmentCode) && (
                  <span style={{ color: "var(--border-base-strong, #b0b8c8)", margin: "0 4px" }}>|</span>
                )}
                {(equipmentName || equipmentCode) && (
                  <span>
                    <span style={{ color: "var(--text-subtlest, #7e8a9e)", fontWeight: 500 }}>{t("field.equipmentName", "설비명")}: </span>
                    <span style={{ color: "var(--text-default, #111827)", fontWeight: 600 }}>
                      {equipmentName}
                      {equipmentCode ? ` (${equipmentCode})` : ""}
                    </span>
                  </span>
                )}
                {!woCode && !equipmentName && !equipmentCode && t("drawer.desc")}
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

          <div className="eq-drawer-body">
            {(isArray ? item : [item]).map((rec, idx) => {
              const details = getRecordDetails(rec, t);
              const recKey = rec.id || rec.wOCode || rec.woCode || `rec-${idx}`;
              const atts = getAttachments(rec, idx);

              return (
                <div key={idx} className="detail-group border border-gray-100 dark:border-gray-700/70 rounded-2xl p-4 mb-4 bg-white dark:bg-gray-800 shadow-xs">
                  {isArray && (
                    <div className="detail-group-title text-brand-60 font-bold mb-3 text-sm text-[#0f62fe] flex items-center justify-between">
                      <span>{t("detail.record", "레코드 상세")} {idx + 1}</span>
                    </div>
                  )}

                  <dl className="detail-field">
                    {details.map((detail, index) => (
                      <div key={`${detail.label}-${index}`} style={{ display: "contents" }}>
                        <dt>{detail.label}</dt>
                        <dd>{renderValue(detail)}</dd>
                      </div>
                    ))}
                  </dl>

                  {/* ── Attachment Preview & Edit Button Footer ── */}
                  <div className="flex items-end justify-between pt-4 mt-3 border-t border-gray-100 dark:border-gray-700/60 gap-3">
                    {atts && atts.length > 0 ? (
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400">
                          {atts[0].category || "기타"} ({atts.length})
                        </span>
                        <div
                          className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 group cursor-pointer shadow-xs hover:shadow-md transition-all"
                          onClick={() => setPreviewImage(atts[0])}
                          title={atts[0].name}
                        >
                          <img
                            src={atts[0].url}
                            alt="Attachment Preview"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                          <div className="absolute bottom-0 inset-x-0 bg-black/70 text-white text-[10px] font-bold py-0.5 text-center truncate px-1">
                            {atts[0].category || "기타"}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 font-medium py-2">
                        <i className="far fa-image text-sm" />
                        <span>{t("drawer.noPhoto", "첨부된 사진이 없습니다")}</span>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setEditingRecord({ ...rec });
                      }}
                      className="px-3.5 py-1.5 border border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs shrink-0"
                    >
                      <i className="fas fa-edit text-xs" />
                      <span>{t("app.edit", "편집")}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>
      </div>

      {/* ── Image Lightbox Preview Modal ── */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[10500] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-w-xl w-full bg-white dark:bg-gray-900 rounded-3xl p-4 shadow-2xl animate-scale-up flex flex-col items-center border border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 hover:bg-black text-white flex items-center justify-center cursor-pointer transition-colors z-10"
              onClick={() => setPreviewImage(null)}
            >
              <i className="fas fa-times text-sm" />
            </button>

            <div className="w-full max-h-[75vh] rounded-2xl overflow-hidden flex items-center justify-center bg-black/90">
              <img
                src={previewImage.url}
                alt={previewImage.name}
                className="max-w-full max-h-[75vh] object-contain rounded-2xl shadow-lg"
              />
            </div>

            <div className="mt-3 px-4 py-1 bg-black/75 text-white text-xs font-mono rounded-full border border-gray-700/50 shadow-sm">
              {previewImage.name || "attachment.jpg"}
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Item Modal (항목 편집) ── */}
      {editingRecord && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-[#0f172a]/50 p-4 animate-fade-in overflow-y-auto"
          onClick={() => setEditingRecord(null)}
        >
          <div
            className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-2xl relative my-8 max-h-[90vh] flex flex-col animate-scale-up border border-gray-100 dark:border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 mb-4 border-b border-gray-100 dark:border-gray-700 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold shrink-0">
                  <i className="fas fa-pen-square text-base" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    {t("modal.editItemTitle", "항목 편집")}
                  </h3>
                  <p className="text-xs text-gray-400 dark:text-gray-400 mt-0.5">
                    {t("modal.editItemSub", "Work Order 항목입니다. 법인과 작업완료일은 수정할 수 없습니다.")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="w-8 h-8 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer shrink-0"
                onClick={() => setEditingRecord(null)}
              >
                <i className="fas fa-times text-xs" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar text-xs">
              {/* 1st Row: Process and Equipment Type (Read-only) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    {t("field.process", "공정")}
                  </label>
                  <input
                    type="text"
                    disabled
                    readOnly
                    value={editingRecord.process || editingRecord.processName || "02.배치"}
                    className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-medium cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    {t("field.equipmentType", "EQUIPMENT TYPE")}
                  </label>
                  <input
                    type="text"
                    disabled
                    readOnly
                    value={editingRecord.maintGroup || editingRecord.maintGroupName || editingRecord.maintenanceType || "0202. Nano Mill"}
                    className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-medium cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Representative Work */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  대표 작업명 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editingRecord.representativeWork || editingRecord.representativeWorkName || ""}
                  onChange={(e) => setEditingRecord({ ...editingRecord, representativeWork: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* Purpose */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  작업 목적
                </label>
                <input
                  type="text"
                  value={editingRecord.purpose || editingRecord.work || ""}
                  onChange={(e) => setEditingRecord({ ...editingRecord, purpose: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* Symptom & Cause */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    문제 현상 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editingRecord.situation || editingRecord.symptom || ""}
                    onChange={(e) => setEditingRecord({ ...editingRecord, situation: e.target.value, symptom: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    문제 원인
                  </label>
                  <input
                    type="text"
                    value={editingRecord.cause || ""}
                    onChange={(e) => setEditingRecord({ ...editingRecord, cause: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* BOM & Material Name */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    BOM
                  </label>
                  <input
                    type="text"
                    placeholder="BOM 입력"
                    value={editingRecord.bom || ""}
                    onChange={(e) => setEditingRecord({ ...editingRecord, bom: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    자재명
                  </label>
                  <input
                    type="text"
                    placeholder="자재명 입력"
                    value={editingRecord.sparePart || editingRecord.materialName || ""}
                    onChange={(e) => setEditingRecord({ ...editingRecord, sparePart: e.target.value, materialName: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* HW Before & HW After */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    HW 변경 전
                  </label>
                  <input
                    type="text"
                    value={editingRecord.hwBefore || editingRecord.hwAsWas || "정보 없음"}
                    onChange={(e) => setEditingRecord({ ...editingRecord, hwBefore: e.target.value, hwAsWas: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    HW 변경 후
                  </label>
                  <input
                    type="text"
                    value={editingRecord.hwAfter || editingRecord.hwAsIs || "정보 없음"}
                    onChange={(e) => setEditingRecord({ ...editingRecord, hwAfter: e.target.value, hwAsIs: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* SW Before & SW After */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    SW 변경 전
                  </label>
                  <input
                    type="text"
                    value={editingRecord.swBefore || editingRecord.swAsWas || "정보 없음"}
                    onChange={(e) => setEditingRecord({ ...editingRecord, swBefore: e.target.value, swAsWas: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    SW 변경 후
                  </label>
                  <input
                    type="text"
                    value={editingRecord.swAfter || editingRecord.swAsIs || "정보 없음"}
                    onChange={(e) => setEditingRecord({ ...editingRecord, swAfter: e.target.value, swAsIs: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* Priority & Effect Category */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    중요도
                  </label>
                  <select
                    value={editingRecord.priority || editingRecord.priorityName || "중요"}
                    onChange={(e) => setEditingRecord({ ...editingRecord, priority: e.target.value, priorityName: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-medium focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                  >
                    <option value="중요">중요</option>
                    <option value="일반">일반</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    효과 유형
                  </label>
                  <select
                    value={editingRecord.category || editingRecord.effectCategory || "품질"}
                    onChange={(e) => setEditingRecord({ ...editingRecord, category: e.target.value, effectCategory: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-medium focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                  >
                    <option value="품질">품질</option>
                    <option value="보전성">보전성</option>
                    <option value="생산성">생산성</option>
                    <option value="기타">기타</option>
                  </select>
                </div>
              </div>

              {/* Completion Date & Site */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    작업완료일
                  </label>
                  <input
                    type="text"
                    disabled
                    value={editingRecord.workedOn || "2026-03-09"}
                    className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-400 font-medium cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    요청 법인
                  </label>
                  <input
                    type="text"
                    disabled
                    value={editingRecord.site || editingRecord.siteName || "D1.필리핀"}
                    className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-400 font-medium cursor-not-allowed"
                  />
                </div>
              </div>

              {/* ── Photo Attachment Section ── */}
              <div className="pt-2">
                <div className="flex items-center gap-4 border-b border-gray-200 dark:border-gray-700 mb-3 pb-1">
                  {[
                    { id: "problem", label: "문제 현상" },
                    { id: "after", label: "개선 후" },
                    { id: "equipment", label: "설비 참고" },
                    { id: "others", label: "기타" },
                  ].map((tab) => {
                    const recKey = editingRecord.id || editingRecord.wOCode || editingRecord.woCode || `rec-0`;
                    const currentAtts = attachmentsMap[recKey] || editingRecord.attachments || [];
                    const tabCount = currentAtts.filter((a) => a.category === tab.label).length;

                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={`text-xs font-bold pb-2 transition-colors cursor-pointer ${activeTab === tab.id ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}
                      >
                        {tab.label} {tabCount}장
                      </button>
                    );
                  })}
                </div>

                <label className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 transition-colors bg-gray-50/50 dark:bg-gray-900/30">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, editingRecord.id || editingRecord.wOCode || editingRecord.woCode || `rec-0`)}
                  />
                  <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-2">
                    <i className="fas fa-[#0f62fe] fa-cloud-upload-alt text-base" />
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                    사진을 드래그하거나 클릭하여 업로드 (같은 그룹 항목에 자동 공유)
                  </span>
                </label>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-4 mt-4 border-t border-gray-100 dark:border-gray-700 shrink-0">
              <button
                type="button"
                className="text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 transition-colors cursor-pointer"
                onClick={() => setEditingRecord(null)}
              >
                {t("app.cancellation", "취소")}
              </button>
              <button
                type="button"
                onClick={handleSaveRecord}
                className="bg-[#1745c2] hover:bg-[#1239a5] text-white font-bold text-xs px-8 py-2.5 rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition-all"
              >
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
