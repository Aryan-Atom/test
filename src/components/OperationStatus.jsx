import { useEffect, useState } from "react";
import "./OperationStatus.css";
import { useI18n } from "../i18n.jsx";

export function OperationStatus({
  isVisible = false,
  status = "loading", // loading, success, error
  message,
  onClose = null,
  autoClose = true, // Only auto-close for success/error, not for loading
}) {
  const { t } = useI18n();
  const [show, setShow] = useState(isVisible);
  const displayMessage = message || t("toast.saving");

  useEffect(() => {
    setShow(isVisible);

    if (!isVisible) return;

    // Only auto-close if autoClose is true AND status is not loading
    if (autoClose && status !== "loading") {
      const timer = setTimeout(() => {
        setShow(false);
        onClose?.();
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [isVisible, status, autoClose, onClose]);

  if (!show) return null;

  const statusConfig = {
    loading: {
      icon: "fas fa-spinner",
      color: "info",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200",
      textColor: "text-blue-700",
    },
    success: {
      icon: "fas fa-check-circle",
      color: "success",
      bgColor: "bg-green-50",
      borderColor: "border-green-200",
      textColor: "text-green-700",
    },
    error: {
      icon: "fas fa-exclamation-circle",
      color: "error",
      bgColor: "bg-red-50",
      borderColor: "border-red-200",
      textColor: "text-red-700",
    },
  };

  const config = statusConfig[status] || statusConfig.loading;

  const handleClose = () => {
    setShow(false);
    onClose?.();
  };

  return (
    <div className={`operation-status ${status} ${config.bgColor} ${config.borderColor}`}>
      <div className="operation-status-content">
        <i className={`${config.icon} ${config.textColor} operation-status-icon`} />
        <span className={config.textColor}>{displayMessage}</span>
      </div>
      <button
        className="operation-status-close"
        onClick={handleClose}
        aria-label={t("app.close")}
        title={t("app.close")}
      >
        <i className="fas fa-times" />
      </button>
    </div>
  );
}
