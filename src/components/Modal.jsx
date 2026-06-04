export default function Modal({
  open,
  title,
  description,
  children,
  footer,
  onClose,
}) {
  if (!open) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="border-b border-border-base p-5 bg-surface-strong">
          <h3 className="text-xl font-bold text-text-default">{title}</h3>
          {description ? (
            <p className="mt-2 text-sm text-text-subtle">{description}</p>
          ) : null}
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>
        <div className="flex items-center justify-end gap-3 border-t border-border-base p-5 bg-surface-strong">
          <button
            type="button"
            onClick={onClose}
            className="btn-base btn-ghost"
          >
            취소
          </button>
          {footer}
        </div>
      </div>
    </div>
  );
}
