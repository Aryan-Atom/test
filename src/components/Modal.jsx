import { useI18n } from "../i18n.jsx";

export default function Modal({ open, title, description, children, footer, onClose, headerBg, titleIcon, maxWidth }) {
  const { t } = useI18n();

  if (!open) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={maxWidth ? { maxWidth } : undefined}>
        <div className="border-b border-border-base p-5" style={headerBg ? { background: headerBg } : undefined}>
          <h3 className="text-xl font-bold text-text-default flex items-center gap-2">
            {titleIcon}
            <span>{title}</span>
          </h3>
          {description ? <p className="mt-1 text-sm text-text-subtle">{description}</p> : null}
        </div>
        <div className="max-h-[75vh] overflow-y-auto p-5">{children}</div>
        <div className="flex items-center justify-end gap-3 border-t border-border-base bg-surface-strong p-5">
          <button type="button" onClick={onClose} className="btn-base btn-ghost">
            {t("app.cancel")}
          </button>
          {footer}
        </div>
      </div>
    </div>
  );
}
