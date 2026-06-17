import { useI18n } from "../i18n.jsx";

export default function Navbar({ collapsed, onToggleMenu, theme, onToggleTheme }) {
  const { language, toggleLanguage, t } = useI18n();
  const isDark = theme === "dark";

  return (
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
        <button type="button" className="eq-user-button" aria-label={t("app.user")}>
          <i className="fas fa-user" />
        </button>
      </div>
    </header>
  );
}
