import { useI18n } from "../i18n.jsx";

const COLUMN_LABEL_KEYS = {
  // English keys
  process: "field.process",
  maintGroup: "field.maintenance",
  site: "field.site",
  representativeWork: "field.repWork",
  priority: "field.priority",
  category: "field.category",
  period: "field.period",
  work: "field.work",
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
  woCode: "field.woCode",
  workedOn: "field.workedOn",
  wOCode: "field.woCode",
  hwAsWas: "field.hwBefore",
  hwAsIs: "field.hwAfter",
  swAsWas: "field.swBefore",
  swAsIs: "field.swAfter",
  version: "field.version",
  specName: "field.specName",
  specValue: "field.specValue",
  specVersion: "field.specVersion",
  equipmentId: "field.equipmentId",
  improvement: "field.improvement",
  // Korean keys
  "법인": "field.site",
  "공정": "field.process",
  "보전파트": "field.maintenance",
  "보전그룹": "field.maintenanceGroup",
  "보전유형": "field.maintenanceType",
  "설비코드": "field.equipmentCode",
  "설비명": "field.equipmentName",
  "W/O코드": "field.woCode",
  "Report내용": "field.report",
  "BOM": "field.bom",
  "자재명": "field.sparePart",
  "작업완료일": "field.workedOn",
  "개선 작업": "field.improvement",
  "작업목적": "field.work",
  "문제 현상": "field.situation",
  "문제 원인": "field.cause",
  "HW 변경 전": "field.hwBefore",
  "HW 변경 후": "field.hwAfter",
  "SW 변경 전": "field.swBefore",
  "SW 변경 후": "field.swAfter",
  "대표 작업명": "field.repWork",
  "중요도": "field.priority",
  "효과 유형": "field.category",
  "버전": "field.version",
  "사양항목": "field.specName",
  "사양값": "field.specValue",
  "설비ID": "field.equipmentId",
  "사양버전": "field.specVersion",
};

export default function Drawer({ item, onClose }) {
  const { t } = useI18n();

  if (!item) return null;

  const details = Object.entries(item).filter(([key]) => key !== "id" && key !== "type");

  return (
    <div className="fixed inset-0 z-40 bg-surface-inverse/30 backdrop-blur-sm">
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-surface-default shadow-2xl">
        <div className="flex items-center justify-between border-b border-border-base p-5">
          <div>
            <h2 className="text-xl font-bold text-text-default">{t("drawer.title")}</h2>
            <p className="text-sm text-text-subtle">{t("drawer.desc")}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-base btn-ghost rounded-xl p-3"
            aria-label={t("app.close")}
          >
            <i className="fas fa-times" />
          </button>
        </div>
        <div className="space-y-4 overflow-y-auto p-5 pb-8" style={{ height: "calc(100vh - 10vh)" }}>
          {details.map(([key, value]) => (
            <div key={key} className="rounded-2xl bg-surface-strong p-4">
              <div className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-text-subtle">
                {t(COLUMN_LABEL_KEYS[key] ?? `field.${key}`, key)}
              </div>
              <div className="whitespace-pre-wrap text-sm leading-6 text-text-default">
                {value || t("app.none")}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
