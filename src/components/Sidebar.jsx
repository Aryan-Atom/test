import { useState } from "react";
import { useI18n } from "../i18n.jsx";

const navSections = [
  {
    titleKey: "nav.main",
    items: [
      {
        id: "data",
        labelKey: "nav.data",
        icon: "fa-database",
        children: [
          { id: "dm-change", labelKey: "nav.changeHistory" },
          { id: "dm-spec", labelKey: "nav.specData" },
        ],
      },
      {
        id: "matrix",
        labelKey: "nav.matrix",
        icon: "fa-th-large",
        children: [
          { id: "mx-matrix", labelKey: "nav.matrixView" },
          { id: "mx-mplist", labelKey: "nav.mpList" },
        ],
      },
      { id: "spec", labelKey: "nav.specMatrix", icon: "fa-diagram-project" },
    ],
  },
  {
    titleKey: "nav.community",
    items: [{ id: "board", labelKey: "nav.board", icon: "fa-comments" }],
  },
  {
    titleKey: "nav.system",
    items: [{ id: "admin", labelKey: "nav.admin", icon: "fa-user-shield" }],
  },
];

function hasActiveChild(item, activePage) {
  return item.children?.some((child) => child.id === activePage);
}

export default function Sidebar({ activePage, onNavigate, collapsed = false }) {
  const { t } = useI18n();
  const [openGroups, setOpenGroups] = useState({
    data: true,
    matrix: true,
  });

  const toggleGroup = (groupId) => {
    setOpenGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  return (
    <aside className={`eq-sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="eq-sidebar-logo">
        <div className="eq-logo-mark">
          <i className="fas fa-layer-group" />
        </div>
        <div className="eq-sidebar-text">
          <div className="eq-logo-title">EQUAL</div>
          <div className="eq-logo-subtitle">{t("brand.subtitle")}</div>
        </div>
      </div>

      <nav className="eq-sidebar-nav">
        {navSections.map((section) => (
          <div key={section.titleKey} className="eq-nav-section">
            <div className="eq-section-title">{t(section.titleKey)}</div>
            {section.items.map((item) => {
              const isGroup = item.children?.length > 0;
              const isActive = activePage === item.id || hasActiveChild(item, activePage);
              const isOpen = isGroup ? openGroups[item.id] : false;
              const label = t(item.labelKey);

              if (!isGroup) {
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onNavigate(item.id)}
                    className={`eq-nav-item ${activePage === item.id ? "active" : ""}`}
                    title={label}
                  >
                    <i className={`fas ${item.icon}`} />
                    <span>{label}</span>
                  </button>
                );
              }

              return (
                <div key={item.id}>
                  <button
                    type="button"
                    onClick={() => toggleGroup(item.id)}
                    className={`eq-nav-item ${isActive ? "active-parent" : ""}`}
                    title={label}
                  >
                    <i className={`fas ${item.icon}`} />
                    <span>{label}</span>
                    <i className={`fas fa-chevron-${isOpen ? "up" : "down"} eq-nav-chevron`} />
                  </button>
                  <div className={`eq-sub-menu ${isOpen ? "open" : ""}`}>
                    {item.children.map((child) => (
                      <button
                        key={child.id}
                        type="button"
                        onClick={() => onNavigate(child.id)}
                        className={`eq-sub-item ${activePage === child.id ? "active" : ""}`}
                        title={t(child.labelKey)}
                      >
                        {t(child.labelKey)}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="eq-system-card">
        <div>{t("nav.system")}</div>
        <span>
          <i />
          {t("nav.online")}
        </span>
      </div>
    </aside>
  );
}
