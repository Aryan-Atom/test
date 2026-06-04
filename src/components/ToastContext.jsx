import { createContext, useContext, useState } from "react";

const ToastContext = createContext(null);

export const useToast = () => useContext(ToastContext);

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const pushToast = (message, type = "info") => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3200);
  };

  return (
    <ToastContext.Provider value={{ pushToast }}>
      {children}
      <div className="fixed right-4 top-4 z-50 flex flex-col gap-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="rounded-2xl border bg-surface-default p-4 shadow-soft"
            style={{ borderColor: "var(--border-base)" }}
          >
            <div className="flex items-center gap-3 text-sm">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-10 text-brand-60">
                <i
                  className={`fas ${toast.type === "success" ? "fa-check" : toast.type === "warning" ? "fa-exclamation-triangle" : toast.type === "error" ? "fa-times" : "fa-info-circle"}`}
                />
              </span>
              <span className="text-text-default">{toast.message}</span>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
