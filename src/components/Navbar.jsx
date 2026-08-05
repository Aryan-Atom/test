import { useState } from "react";
import { useI18n } from "../i18n.jsx";
import Modal from "./Modal.jsx";
import UserMenu from "./UserMenu.jsx";
import { APIcallGet } from "../axios/apiCall.js";
import { pocEndPoints } from "../axios/endPoints.js";
import { useToast } from "./ToastContext.jsx";

const PAGE_BREADCRUMBS = {
  home: { section: "nav.main", title: "nav.home" },
  "dm-change": { section: "nav.data", title: "nav.changeHistory" },
  "dm-spec": { section: "nav.data", title: "nav.specData" },
  "mx-matrix": { section: "nav.matrix", title: "nav.matrixView" },
  "mx-mplist": { section: "nav.matrix", title: "nav.mpList" },
  "mx-mplist-mgmt": { section: "nav.matrix", title: "nav.mpListManagement" },
  spec: { section: "nav.dataHeader", title: "nav.specMatrix" },
  board: { section: "nav.community", title: "nav.board" },
  admin: { section: "nav.system", title: "nav.admin" },
};

export default function Navbar({ activePage, collapsed, onToggleMenu, theme, onToggleTheme }) {
  const { language, toggleLanguage, t } = useI18n();
  const isDark = theme === "dark";

  const [showConfirm, setShowConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const { pushToast } = useToast();

  const breadcrumb = PAGE_BREADCRUMBS[activePage] || { section: null, title: "nav.home" };

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
      <header className="eq-topbar flex items-center justify-between px-5 h-[60px] border-b border-border-base bg-surface-default/90 backdrop-blur-md z-30 transition-all">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="eq-topbar-icon hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg p-2 transition-colors"
            aria-label={t("app.menu")}
            title={collapsed ? t("app.menu") : t("app.menu")}
            onClick={onToggleMenu}
          >
            <i className={`fas ${collapsed ? "fa-indent text-sm" : "fa-bars text-sm"}`} />
          </button>

          <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-700/80 h-5">
            {breadcrumb.section && (
              <>
                <span className="text-[11px] font-semibold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
                  {t(breadcrumb.section)}
                </span>
                <i className="fas fa-chevron-right text-[9px] text-slate-300 dark:text-slate-600 mx-0.5" />
              </>
            )}
            <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">
              {t(breadcrumb.title)}
            </span>
          </div>
        </div>

        <div className="eq-topbar-actions flex items-center gap-2.5">
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
            className="eq-topbar-icon text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label={isDark ? t("app.lightMode") : t("app.darkMode")}
            title={isDark ? t("app.lightMode") : t("app.darkMode")}
            onClick={onToggleTheme}
          >
            <i className={`fas ${isDark ? "fa-sun text-yellow-400" : "fa-moon text-indigo-500"}`} />
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
          <UserMenu />
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
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm">
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
