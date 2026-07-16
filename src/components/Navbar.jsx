import { useState } from "react";
import { useI18n } from "../i18n.jsx";
import { getUserInfo } from "../utils/cookieUtils.js";
import Modal from "./Modal.jsx";
import { APIcallGet } from "../axios/apiCall.js";
import { pocEndPoints } from "../axios/endPoints.js";
import { useToast } from "./ToastContext.jsx";

function getUserDisplayName(userInfo) {
  return (
    userInfo?.name ??
    userInfo?.userName ??
    userInfo?.username ??
    userInfo?.displayName ??
    userInfo?.employeeName ??
    userInfo?.email ??
    ""
  );
}

export default function Navbar({ collapsed, onToggleMenu, theme, onToggleTheme }) {
  const { language, toggleLanguage, t } = useI18n();
  const isDark = theme === "dark";
  const userName = getUserDisplayName(getUserInfo());
  const userInitial = String(userName || "User").trim().charAt(0).toUpperCase() || "U";

  const [showConfirm, setShowConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const { pushToast } = useToast();

  const showResetButton = String(import.meta.env.VITE_SHOW_RESET_DATA ?? "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .toLowerCase() === "true";

  const handleReset = () => {
    setIsResetting(true);
    setShowConfirm(false);
    APIcallGet(pocEndPoints.RESET_DATA, {}, (responseData, status) => {
      setIsResetting(false);
      if (status === 200) {
        pushToast(t("app.resetDataSuccess"), "success");
        localStorage.removeItem("eq_chg");
        localStorage.removeItem("eq_spec");
        localStorage.removeItem("eq_board");
        localStorage.removeItem("eq_users");
        localStorage.removeItem("eq_mp");
        localStorage.removeItem("eq_chg_cols");
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        pushToast(t("app.resetDataError") + ` (${status})`, "error");
      }
    });
  };

  return (
    <>
      <header className="eq-topbar">
        <button
          type="button"
          className="eq-topbar-icon"
          aria-label={t("app.menu")}
          title={collapsed ? t("app.menu") : t("app.menu")}
          onClick={onToggleMenu}
        >
          <i className="fas fa-bars" />
        </button>

        <div className="eq-topbar-actions">
          {showResetButton && (
            <button
              type="button"
              className="eq-topbar-icon eq-reset-btn"
              aria-label={t("app.resetData")}
              title={t("app.resetData")}
              onClick={() => setShowConfirm(true)}
              disabled={isResetting}
            >
              <i className={`fas ${isResetting ? "fa-spinner fa-spin" : "fa-trash-alt"}`} />
              <span>{t("app.resetData")}</span>
            </button>
          )}
          <button
            type="button"
            className="eq-topbar-icon"
            aria-label={isDark ? t("app.lightMode") : t("app.darkMode")}
            title={isDark ? t("app.lightMode") : t("app.darkMode")}
            onClick={onToggleTheme}
          >
            <i className={`fas ${isDark ? "fa-sun" : "fa-moon"}`} />
          </button>
          <button
            type="button"
            className="eq-language-button"
            aria-label={t("app.language")}
            title={language === "ko" ? t("app.english") : t("app.korean")}
            onClick={toggleLanguage}
          >
            {language === "ko" ? "EN" : "KO"}
          </button>
          <div className="eq-topbar-divider" />
          <button
            type="button"
            className="eq-user-button"
            aria-label={userName || t("app.user")}
            title={userName || t("app.user")}
          >
            {userInitial}
          </button>
        </div>
      </header>

      {showConfirm && (
        <Modal
          open={showConfirm}
          title={t("app.resetDataConfirmTitle")}
          description={null}
          onClose={() => setShowConfirm(false)}
          footer={
            <button
              type="button"
              className="btn-base bg-red-600 hover:bg-red-700 text-white font-medium px-4 py-2 rounded-xl transition-colors"
              onClick={handleReset}
            >
              {t("app.delete")}
            </button>
          }
        >
          <div className="py-2 text-sm text-text-default">
            {t("app.resetDataConfirmDesc")}
          </div>
        </Modal>
      )}

      {isResetting && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-950/50 backdrop-blur-sm">
          <div
            className="flex flex-col items-center p-8 rounded-2xl shadow-2xl border text-center"
            style={{
              background: "var(--surface-default, #ffffff)",
              borderColor: "var(--border-base, rgba(226, 232, 240, 0.8))",
              maxWidth: "380px",
              width: "90%",
            }}
          >
            {/* Spinning Loader Ring with Gradient */}
            <div className="relative flex items-center justify-center mb-6">
              <div
                className="w-16 h-16 rounded-full border-4 border-slate-100 animate-spin"
                style={{
                  borderTopColor: "#ef4444",
                  borderRightColor: "#ef4444",
                }}
              />
              <i
                className="fas fa-trash-alt absolute text-xl text-red-500 animate-pulse"
                style={{ animationDuration: "1.5s" }}
              />
            </div>

            <h3 className="text-lg font-bold text-text-default mb-2">
              {t("app.resettingData")}
            </h3>
            <p className="text-sm text-text-subtle">
              {t("app.resettingDataDesc")}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
