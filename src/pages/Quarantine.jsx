import { useI18n } from "../i18n.jsx";

export default function Quarantine() {
  const { t } = useI18n();

  return (
    <section className="flex-1 flex flex-col min-h-0 space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between relative z-20">
        <div>
          <h1 className="page-title flex items-center gap-2.5">
            <i className="fas fa-shield-alt text-[#1745c2] text-xl md:text-[22px]" />
            <span>Quarantine</span>
          </h1>
          <p className="page-subtitle">
            Inspect quarantined rows or files flagged by the AI pipeline during ingestion.
          </p>
        </div>
      </header>

      <div className="card flex-1 flex flex-col items-center justify-center p-12 text-center text-text-subtle">
        <i className="fas fa-shield-alt text-5xl text-amber-500/40 mb-4" />
        <h3 className="text-lg font-bold text-text-default mb-1">
          AI Pipeline Quarantine Management
        </h3>
        <p className="text-xs text-text-subtle max-w-md">
          Uncertain or errored dataset entries isolated for safety are managed in this view.
        </p>
      </div>
    </section>
  );
}
