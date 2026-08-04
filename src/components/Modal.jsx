import { useI18n } from "../i18n.jsx";

export default function Modal({
  open,
  title,
  description,
  children,
  footer,
  onClose,
  headerBg,
  titleIcon,
  maxWidth,
}) {
  const { t } = useI18n();

  if (!open) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={maxWidth ? { maxWidth } : undefined}>
        <div
          className="modal-header"
          style={headerBg ? { background: headerBg } : undefined}
        >
          <div className="flex items-center gap-3 min-w-0">
            {titleIcon}
            <div className="min-w-0">
              <h3 className="modal-title truncate">{title}</h3>
              {description ? (
                <p className="modal-description">{description}</p>
              ) : null}
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="modal-close-btn shrink-0"
              aria-label="Close"
            >
              <i className="fas fa-times text-xs" />
            </button>
          )}
        </div>
        <div className="modal-body max-h-[75vh] overflow-y-auto">{children}</div>
        <div className="modal-footer">
          <button type="button" onClick={onClose} className="modal-cancel-btn">
            {t("app.cancel", "cancellation")}
          </button>
          {footer}
        </div>
      </div>
    </div>
  );
}
