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

function visibleValue(value) {
  if (value === undefined || value === null || value === "") return "-";
  return String(value);
}

function getRecordDetails(item, t) {
  const orderedFields = rowLooksLikeSpec(item) ? SPEC_DETAIL_FIELDS : CHANGE_DETAIL_FIELDS;
  const usedKeys = new Set(orderedFields.flatMap((field) => field.keys));
  const orderedDetails = orderedFields.map((field) => ({
    labelKey: field.labelKey,
    label: t(field.labelKey),
    value: firstValue(item, field.keys),
  }));
  const extraDetails = Object.entries(item)
    .filter(
      ([key, value]) =>
        !usedKeys.has(key) &&
        !key.startsWith("_") &&
        key !== "id" &&
        key !== "type" &&
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

  if (!item) return null;

  const isArray = Array.isArray(item);
  const firstItem = isArray ? item[0] : item;

  const woCode = firstValue(firstItem, ["wOCode", "woCode"]);
  const equipmentName = firstValue(firstItem, ["equipmentName"]);
  const equipmentCode = firstValue(firstItem, ["equipmentCode"]);

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
    <div className="eq-drawer-overlay" onClick={onClose}>
      <aside className="eq-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="eq-drawer-header">
          <div>
            <h2 className="eq-drawer-title">{t("drawer.title")}</h2>
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
          {isArray ? (
            item.map((rec, idx) => {
              const details = getRecordDetails(rec, t);
              return (
                <div key={idx} className="detail-group border-b border-border-base last:border-b-0 pb-4 mb-4">
                  <div className="detail-group-title text-brand-60 font-semibold mb-2" style={{ color: "var(--brand-60, #0f62fe)" }}>
                    {t("detail.record", "항목")} {idx + 1}
                  </div>
                  <dl className="detail-field">
                    {details.map((detail, index) => (
                      <div key={`${detail.label}-${index}`} style={{ display: "contents" }}>
                        <dt>{detail.label}</dt>
                        <dd>{renderValue(detail)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              );
            })
          ) : (
            <div className="detail-group">
              <div className="detail-group-title">
                {t("detail.record")}
              </div>
              <dl className="detail-field">
                {getRecordDetails(item, t).map((detail, index) => (
                  <div key={`${detail.label}-${index}`} style={{ display: "contents" }}>
                    <dt>{detail.label}</dt>
                    <dd>{renderValue(detail)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
