import { useI18n } from "../i18n.jsx";

export default function Review() {
  const { t } = useI18n();

  return (
    <section className="flex-1 flex flex-col min-h-0 space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between relative z-20">
        <div>
          <h1 className="page-title flex items-center gap-2.5">
            <i className="fas fa-clipboard-check text-[#1745c2] text-xl md:text-[22px]" />
            <span>Review</span>
          </h1>
          <p className="page-subtitle">
            Review and validate AI pipeline processed data entries before final approval.
          </p>
        </div>
      </header>

      <div className="card flex-1 flex flex-col items-center justify-center p-12 text-center text-text-subtle">
        <i className="fas fa-clipboard-check text-5xl text-teal-500/40 mb-4" />
        <h3 className="text-lg font-bold text-text-default mb-1">
          AI Pipeline Review Management
        </h3>
        <p className="text-xs text-text-subtle max-w-md">
          Items requiring manual review and verification will appear here once processed by the AI pipeline.
        </p>
      </div>
    </section>
  );
}
