import "./AnimatedActionButton.css";

export default function AnimatedActionButton({
  busy = false,
  busyLabel = "Working...",
  icon,
  children,
  className = "",
  disabled = false,
  ...props
}) {
  return (
    <button
      type="button"
      className={`btn-base action-button ${className} ${busy ? "action-button-busy" : ""}`}
      disabled={disabled || busy}
      aria-busy={busy}
      {...props}
    >
      <span className="action-icon-wrapper">
        {busy ? (
          <span className="action-loader" aria-hidden="true">
            <span className="action-loader-ring" />
            <span className="action-loader-dot" />
          </span>
        ) : icon ? (
          <i className={icon} aria-hidden="true" />
        ) : null}
      </span>

      <span className="action-text">{busy ? busyLabel : children}</span>
    </button>
  );
}
