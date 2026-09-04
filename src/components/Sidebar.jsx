import { useState, useEffect } from "react";
import { useI18n } from "../i18n.jsx";

const navSections = [
  {
    titleKey: null,
    items: [
      { id: "home", labelKey: "nav.home", icon: "fa-home" },
    ],
  },
  {
    titleKey: "nav.dataHeader",
    items: [
      {
        id: "data",
        labelKey: "nav.data",
        icon: "fa-database",
        children: [
          { id: "dm-change", labelKey: "nav.changeHistory", adminOnly: true },
          { id: "dm-spec", labelKey: "nav.specData", adminOnly: true },
        ],
      },
      {
        id: "matrix",
        labelKey: "nav.matrix",
        icon: "fa-th-large",
        children: [
          { id: "mx-matrix", labelKey: "nav.matrixView" },
          { id: "mx-mplist", labelKey: "nav.mpList" },
          { id: "mx-mplist-mgmt", labelKey: "nav.mpListManagement" },
        ],
      },
      {
        id: "ai-pipeline",
        labelKey: "nav.aiPipeline",
        icon: "fa-robot",
        children: [
          { id: "ai-jobs", labelKey: "nav.aiJobs" },
          { id: "ai-review", labelKey: "nav.aiReview" },
          { id: "ai-quarantine", labelKey: "nav.aiQuarantine" },
        ],
      },
      {
        id: "spec",
        labelKey: "nav.specMatrix",
        icon: "fa-diagram-project",
        adminOnly: true,
      },
    ],
  },
  {
    titleKey: "nav.community",
    items: [{ id: "board", labelKey: "nav.board", icon: "fa-comments" }],
  },
  {
    titleKey: "nav.system",
    items: [
      {
        id: "admin",
        labelKey: "nav.admin",
        icon: "fa-user-shield",
        adminOnly: true,
      },
    ],
  },
];

function hasActiveChild(item, activePage) {
  return item.children?.some((child) => child.id === activePage);
}

export default function Sidebar({
  activePage,
  onNavigate,
  collapsed = false,
  isAdminUser = false,
}) {
  const { t } = useI18n();
  const [openGroups, setOpenGroups] = useState({
    data: true,
    matrix: true,
    "ai-pipeline": true,
  });

  // Auto-expand active parent group when active page changes
  useEffect(() => {
    navSections.forEach((section) => {
      section.items.forEach((item) => {
        if (item.children?.some((child) => child.id === activePage)) {
          setOpenGroups((prev) => ({ ...prev, [item.id]: true }));
        }
      });
    });
  }, [activePage]);

  const showOnlyFourPages =
    String(import.meta.env.VITE_SHOW_ONLY_FOUR_PAGES ?? "")
      .trim()
      .replace(/^['"]|['"]$/g, "")
      .toLowerCase() === "true";
  const allowedFourPageSet = new Set([
    "home",
    "dm-change",
    "mx-matrix",
    "mx-mplist",
    "mx-mplist-mgmt",
    "ai-jobs",
    "ai-review",
    "ai-quarantine",
  ]);

  const canAccess = (item) => {
    if (showOnlyFourPages) {
      if (item?.children?.length) {
        return item.children.some((child) => allowedFourPageSet.has(child.id));
      }

      return allowedFourPageSet.has(item?.id);
    }

    return item?.adminOnly ? isAdminUser : true;
  };

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
        {navSections.map((section, sIdx) => {
          const visibleItems = section.items
            .map((item) => {
              if (item.children?.length) {
                const visibleChildren = item.children.filter(canAccess);
                return visibleChildren.length
                  ? { ...item, children: visibleChildren }
                  : null;
              }

              return canAccess(item) ? item : null;
            })
            .filter(Boolean);

          if (!visibleItems.length) {
            return null;
          }

          return (
            <div key={section.titleKey || `sec-${sIdx}`} className="eq-nav-section">
              {section.titleKey && <div className="eq-section-title">{t(section.titleKey)}</div>}
              {visibleItems.map((item) => {
                const isGroup = item.children?.length > 0;
                const isActive =
                  activePage === item.id || hasActiveChild(item, activePage);
                const isOpen = isGroup ? Boolean(openGroups[item.id]) : false;
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
                      onClick={() => {
                        if (collapsed && item.children?.[0]?.id) {
                          onNavigate(item.children[0].id);
                        } else {
                          toggleGroup(item.id);
                        }
                      }}
                      className={`eq-nav-item ${isActive ? "active-parent" : ""}`}
                      title={label}
                    >
                      <i className={`fas ${item.icon}`} />
                      <span>{label}</span>
                      <i
                        className={`fas fa-chevron-${isOpen ? "up" : "down"} eq-nav-chevron transition-transform duration-200`}
                      />
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
          );
        })}
      </nav>

      <div className="eq-system-card">
        <div>{t("nav.serverStatus", "SERVER STATUS")}</div>
        <span>
          <i />
          {t("nav.online", "Online")}
        </span>
      </div>
    </aside>
  );
}
