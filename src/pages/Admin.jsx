import { useState } from "react";
import { useI18n } from "../i18n.jsx";

const permissionSections = [
  {
    id: "data-management",
    titleKey: "nav.data",
    defaultTitle: "Data Management",
    items: [
      { labelKey: "nav.changeHistory", defaultLabel: "Change Data", adminAllowed: true, userAllowed: false },
      { labelKey: "nav.specData", defaultLabel: "Spec. Data", adminAllowed: true, userAllowed: false },
    ],
  },
  {
    id: "change-matrix",
    titleKey: "nav.matrix",
    defaultTitle: "Change Matrix",
    items: [
      { labelKey: "nav.matrixView", defaultLabel: "Matrix View", adminAllowed: true, userAllowed: true },
      { labelKey: "nav.mpList", defaultLabel: "MP List Check", adminAllowed: true, userAllowed: true },
      { labelKey: "nav.mpListManagement", defaultLabel: "MP List Management", adminAllowed: true, userAllowed: true },
      { labelKey: "nav.specMatrix", defaultLabel: "Spec. Matrix", adminAllowed: true, userAllowed: false },
    ],
  },
  {
    id: "board",
    titleKey: "nav.board",
    defaultTitle: "Board",
    items: [{ labelKey: "nav.board", defaultLabel: "Board", adminAllowed: true, userAllowed: true }],
  },
];

function PermissionStatus({ allowed, t }) {
  return (
    <span
      className={`rbp-status ${allowed ? "allowed" : "denied"}`}
      title={allowed ? t("page.admin.allowed", "Allowed (O)") : t("page.admin.denied", "Not Allowed (X)")}
    >
      <i className={`fas ${allowed ? "fa-check" : "fa-xmark"}`} aria-hidden="true" />
      <span className="rbp-status-code">{allowed ? "O" : "X"}</span>
      <span className="sr-only">{allowed ? t("page.admin.allowedSr", "Allowed") : t("page.admin.deniedSr", "Not Allowed")}</span>
    </span>
  );
}

export default function Admin() {
  const { t } = useI18n();
  const [openSections, setOpenSections] = useState(() => ({
    "data-management": true,
    "change-matrix": true,
    board: true,
  }));

  const toggleSection = (sectionId) => {
    setOpenSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  return (
    <section className="rbp-page">
      <header className="rbp-header card">
        <div>
          <p className="rbp-kicker">{t("page.admin.kicker", "Access Control")}</p>
          <h1 className="rbp-title">{t("page.admin.rbpTitle", "Role-Based Permissions")}</h1>
          <p className="rbp-subtitle">
            {t("page.admin.subtitle", "Compare Admin and User permissions by category with a clear enterprise access matrix.")}
          </p>
        </div>
        <div className="rbp-legend" aria-label="Permissions legend">
          <span className="rbp-legend-item allowed">
            <i className="fas fa-check" aria-hidden="true" /> {t("page.admin.allowedLegend", "O = Allowed")}
          </span>
          <span className="rbp-legend-item denied">
            <i className="fas fa-xmark" aria-hidden="true" /> {t("page.admin.deniedLegend", "X = Not Allowed")}
          </span>
        </div>
      </header>

      <div className="rbp-columns-head card" role="presentation">
        <span>{t("page.admin.permission", "Permission")}</span>
        <span>{t("page.admin.admin", "Admin")}</span>
        <span>{t("page.admin.user", "User")}</span>
      </div>

      <div className="rbp-sections">
        {permissionSections.map((section) => {
          const isOpen = Boolean(openSections[section.id]);

          return (
            <article key={section.id} className="rbp-section card">
              <button
                type="button"
                className="rbp-section-toggle"
                onClick={() => toggleSection(section.id)}
                aria-expanded={isOpen}
                aria-controls={`rbp-panel-${section.id}`}
              >
                <div className="rbp-section-title-wrap">
                  <h2>{t(section.titleKey, section.defaultTitle)}</h2>
                  <span className="rbp-section-count">{section.items.length} {t("page.admin.items", "items")}</span>
                </div>
                <i className={`fas fa-chevron-${isOpen ? "up" : "down"}`} aria-hidden="true" />
              </button>

              {isOpen && (
                <div className="rbp-rows" id={`rbp-panel-${section.id}`}>
                  {section.items.map((item) => (
                    <div className="rbp-row" key={item.labelKey}>
                      <div className="rbp-permission-name">{t(item.labelKey, item.defaultLabel)}</div>
                      <div className="rbp-cell">
                        <PermissionStatus allowed={item.adminAllowed} t={t} />
                      </div>
                      <div className="rbp-cell">
                        <PermissionStatus allowed={item.userAllowed} t={t} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
