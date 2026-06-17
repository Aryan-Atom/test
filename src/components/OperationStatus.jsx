import { useEffect, useState } from "react";
import "./OperationStatus.css";

export function OperationStatus({
  isVisible = false,
  status = "loading", // loading, success, error
  message = "처리 중입니다...",
  onClose = null,
  autoClose = true, // Only auto-close for success/error, not for loading
}) {
  const [show, setShow] = useState(isVisible);

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
        <span className={config.textColor}>{message}</span>
      </div>
      <button
        className="operation-status-close"
        onClick={handleClose}
        aria-label="닫기"
        title="닫기"
      >
        <i className="fas fa-times" />
      </button>
    </div>
  );
}
