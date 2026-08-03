import { useI18n } from "../i18n.jsx";

export default function Modal({ open, title, description, children, footer, onClose, headerBg, titleIcon, maxWidth }) {
  const { t } = useI18n();

  if (!open) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={maxWidth ? { maxWidth } : undefined}>
        <div className="border-b border-border-base p-5 flex items-start justify-between gap-4" style={headerBg ? { background: headerBg } : undefined}>
          <div className="flex items-center gap-3 min-w-0">
            {titleIcon}
            <div className="min-w-0">
              <h3 className="text-lg font-bold text-text-default leading-tight truncate">
                {title}
              </h3>
              {description ? <p className="mt-0.5 text-xs text-text-subtle">{description}</p> : null}
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors shrink-0 cursor-pointer"
              aria-label="Close"
            >
              <i className="fas fa-times text-xs" />
            </button>
          )}
        </div>
        <div className="max-h-[75vh] overflow-y-auto p-5">{children}</div>
        <div className="flex items-center justify-between border-t border-border-base bg-surface-strong p-5">
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-sm font-medium px-2 py-1 cursor-pointer bg-transparent border-0">
            {t("app.cancel", "cancellation")}
          </button>
          {footer}
        </div>
      </div>
    </div>
  );
}
