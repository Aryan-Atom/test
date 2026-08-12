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
      <div className="fixed right-6 top-6 z-[999999] flex flex-col gap-3 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-2xl border p-4 shadow-xl flex items-center gap-3 text-sm transition-all animate-slide-in ${
              toast.type === "error"
                ? "bg-red-50 border-red-200 text-red-700 dark:bg-red-950/80 dark:border-red-800 dark:text-red-300"
                : toast.type === "warning"
                  ? "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/80 dark:border-amber-800 dark:text-amber-300"
                  : toast.type === "success"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/80 dark:border-emerald-800 dark:text-emerald-300"
                    : "bg-surface-default border-border-base text-text-default"
            }`}
          >
            <span
              className={`inline-flex h-8 w-8 items-center justify-center rounded-full shrink-0 ${
                toast.type === "error"
                  ? "bg-red-100 text-red-600 dark:bg-red-900/60 dark:text-red-300"
                  : toast.type === "warning"
                    ? "bg-amber-100 text-amber-600 dark:bg-amber-900/60 dark:text-amber-300"
                    : toast.type === "success"
                      ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/60 dark:text-emerald-300"
                      : "bg-brand-10 text-brand-60"
              }`}
            >
              <i
                className={`fas ${
                  toast.type === "success"
                    ? "fa-check"
                    : toast.type === "warning"
                      ? "fa-exclamation-triangle"
                      : toast.type === "error"
                        ? "fa-exclamation-circle"
                        : "fa-info-circle"
                }`}
              />
            </span>
            <span className="font-semibold">{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
