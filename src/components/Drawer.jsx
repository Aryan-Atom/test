import { useI18n } from "../i18n.jsx";

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
                {key}
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
