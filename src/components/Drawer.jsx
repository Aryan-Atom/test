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
  { labelKey: "field.repWork", keys: ["representativeWork", "representativeWorkName", "rep_work"] },
  { labelKey: "field.equipmentCode", keys: ["equipmentCode", "equipment_code", "eqCode", "eqcode"] },
  { labelKey: "field.woCode", keys: ["wOCode", "woCode", "wo_code", "w/ocode"] },
  { labelKey: "field.process", keys: ["process", "processName"] },
  { labelKey: "field.equipmentName", keys: ["equipmentName", "equipment_name", "eqName", "eqname"] },
  { labelKey: "field.maintenance", keys: ["maintGroup", "maintGroupName", "equipment", "eqType", "equipmentType"] },
  { labelKey: "field.improvement", keys: ["work", "work_description", "improvement"] },
  { labelKey: "field.workPurpose", keys: ["purpose", "work_purpose"] },
  { labelKey: "field.situation", keys: ["situation"] },
  { labelKey: "field.cause", keys: ["cause"] },
  { labelKey: "field.bom", keys: ["bom", "BOM"] },
  { labelKey: "field.sparePart", keys: ["sparePart", "sparepart", "spare_part"] },
  { labelKey: "field.hwBefore", keys: ["hwAsWas", "hwBefore", "hw_was"] },
  { labelKey: "field.hwAfter", keys: ["hwAsIs", "hwAfter", "hw_is"] },
  { labelKey: "field.swBefore", keys: ["swAsWas", "swBefore", "sw_was"] },
  { labelKey: "field.swAfter", keys: ["swAsIs", "swAfter", "sw_is"] },
  { labelKey: "field.report", keys: ["report", "report_content"] },
  { labelKey: "field.site", keys: ["site", "siteName"] },
  { labelKey: "field.workedOn", keys: ["workedOn", "work_date", "worked_date"] },
  { labelKey: "field.priority", keys: ["priority", "priorityName"] },
  { labelKey: "field.category", keys: ["category", "categoryName"] },
  { labelKey: "field.woType", keys: ["woType", "wo_type", "wotype"] },
  { labelKey: "field.registeredBy", keys: ["registeredBy", "createdBy", "created_by", "uploadedBy", "author", "registrant"] },
  { labelKey: "field.registeredAt", keys: ["registeredAt", "createdAt", "creationDate", "created_date", "registeredDate"] },
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
  { labelKey: "field.registeredBy", keys: ["registeredBy", "createdBy", "created_by", "uploadedBy", "author", "registrant"] },
  { labelKey: "field.registeredAt", keys: ["registeredAt", "createdAt", "creationDate", "created_date", "registeredDate"] },
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

  const registeredByVal = firstValue(item, ["registeredBy", "createdBy", "created_by", "uploadedBy", "author", "registrant"]) || "admin";
  const registeredAtVal = firstValue(item, ["registeredAt", "createdAt", "creationDate", "created_date", "registeredDate"]) || firstValue(item, ["workedOn", "work_date"]) || "2026-06-26";
  const editedByVal = firstValue(item, ["editedBy", "modifiedBy", "editor"]) || (item?._modified || item?.isDirty ? "admin" : "");
  const editedAtVal = firstValue(item, ["editedAt", "modifiedAt", "modificationDate", "editedDate"]) || (item?._modified || item?.isDirty ? "2026-06-26 16:11:24" : "");

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
        return <span className="badge badge-danger">{val}</span>;
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
                    <span className="text-text-subtlest">{t("field.woCode", "W/O코드")}: </span>
                    <span className="text-text-default font-semibold">{woCode}</span>
                  </span>
                )}
                {woCode && (equipmentName || equipmentCode) && (
                  <span className="text-text-disabled mx-1">|</span>
                )}
                {(equipmentName || equipmentCode) && (
                  <span>
                    <span className="text-text-subtlest">{t("field.equipmentName", "설비명")}: </span>
                    <span className="text-text-default font-semibold">
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
              const atts = getAttachments(rec, idx);

              return (
                <div key={idx} className="detail-group">
                  {isArray && (
                    <div className="detail-group-title flex items-center justify-between">
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

                  <div className="detail-group-footer">
                    {atts && atts.length > 0 ? (
                      <div className="flex flex-col gap-1.5">
                        <span className="detail-attachment-label">
                          {atts[0].category || "기타"} ({atts.length})
                        </span>
                        <div
                          className="detail-attachment-thumb group"
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
                      <div className="detail-attachment-empty">
                        <i className="far fa-image text-sm" />
                        <span>{t("drawer.noPhoto", "첨부된 사진이 없습니다")}</span>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setEditingRecord({ ...rec });
                      }}
                      className="drawer-edit-btn"
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

            <div className="lightbox-caption">
              {previewImage.name || "attachment.jpg"}
            </div>
          </div>
        </div>
      )}

      {editingRecord && (
        <div className="modal-overlay animate-fade-in overflow-y-auto" onClick={() => setEditingRecord(null)}>
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
                  <h3 className="modal-title">
                    {t("modal.editItemTitle", "항목 편집")}
                  </h3>
                  <p className="modal-description">
                    {t("modal.editItemSub", "Work Order 항목입니다. 법인과 작업완료일은 수정할 수 없습니다.")}
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
                  <label className="modal-field-label">
                    {t("field.process", "공정")}
                  </label>
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
                    value={editingRecord.maintGroup || editingRecord.maintGroupName || editingRecord.maintenanceType || "0202. Nano Mill"}
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
                  value={editingRecord.representativeWork || editingRecord.representativeWorkName || ""}
                  onChange={(e) => setEditingRecord({ ...editingRecord, representativeWork: e.target.value })}
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
                    onChange={(e) => setEditingRecord({ ...editingRecord, situation: e.target.value, symptom: e.target.value })}
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
                    onChange={(e) => setEditingRecord({ ...editingRecord, sparePart: e.target.value, materialName: e.target.value })}
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
                    onChange={(e) => setEditingRecord({ ...editingRecord, hwBefore: e.target.value, hwAsWas: e.target.value })}
                    className="modal-input"
                  />
                </div>
                <div>
                  <label className="modal-field-label">HW 변경 후</label>
                  <input
                    type="text"
                    value={editingRecord.hwAfter || editingRecord.hwAsIs || "정보 없음"}
                    onChange={(e) => setEditingRecord({ ...editingRecord, hwAfter: e.target.value, hwAsIs: e.target.value })}
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
                    onChange={(e) => setEditingRecord({ ...editingRecord, swBefore: e.target.value, swAsWas: e.target.value })}
                    className="modal-input"
                  />
                </div>
                <div>
                  <label className="modal-field-label">SW 변경 후</label>
                  <input
                    type="text"
                    value={editingRecord.swAfter || editingRecord.swAsIs || "정보 없음"}
                    onChange={(e) => setEditingRecord({ ...editingRecord, swAfter: e.target.value, swAsIs: e.target.value })}
                    className="modal-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="modal-field-label">중요도</label>
                  <select
                    value={editingRecord.priority || editingRecord.priorityName || "중요"}
                    onChange={(e) => setEditingRecord({ ...editingRecord, priority: e.target.value, priorityName: e.target.value })}
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
                    onChange={(e) => setEditingRecord({ ...editingRecord, category: e.target.value, effectCategory: e.target.value })}
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
                    const recKey = editingRecord.id || editingRecord.wOCode || editingRecord.woCode || `rec-0`;
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
                    onChange={(e) => handleFileUpload(e, editingRecord.id || editingRecord.wOCode || editingRecord.woCode || `rec-0`)}
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
              <button
                type="button"
                onClick={handleSaveRecord}
                className="btn-base btn-primary"
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
