import { useState } from "react";

const permissionSections = [
  {
    id: "data-management",
    title: "Data Management",
    items: [
      { label: "Change Data", adminAllowed: true, userAllowed: false },
      { label: "Spec. Data", adminAllowed: true, userAllowed: false },
    ],
  },
  {
    id: "change-matrix",
    title: "Change Matrix",
    items: [
      { label: "Matrix View", adminAllowed: true, userAllowed: true },
      { label: "MP List Check", adminAllowed: true, userAllowed: true },
      { label: "MP List Management", adminAllowed: true, userAllowed: true },
      { label: "Spec. Matrix", adminAllowed: true, userAllowed: false },
    ],
  },
  {
    id: "board",
    title: "Board",
    items: [{ label: "Board", adminAllowed: true, userAllowed: true }],
  },
];

function PermissionStatus({ allowed }) {
  return (
    <span
      className={`rbp-status ${allowed ? "allowed" : "denied"}`}
      title={allowed ? "Allowed (O)" : "Not Allowed (X)"}
    >
      <i className={`fas ${allowed ? "fa-check" : "fa-xmark"}`} aria-hidden="true" />
      <span className="rbp-status-code">{allowed ? "O" : "X"}</span>
      <span className="sr-only">{allowed ? "Allowed" : "Not Allowed"}</span>
    </span>
  );
}

export default function Admin() {
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
          <p className="rbp-kicker">Access Control</p>
          <h1 className="rbp-title">Role-Based Permissions</h1>
          <p className="rbp-subtitle">
            Compare Admin and User permissions by category with a clear enterprise access matrix.
          </p>
        </div>
        <div className="rbp-legend" aria-label="Permissions legend">
          <span className="rbp-legend-item allowed">
            <i className="fas fa-check" aria-hidden="true" /> O = Allowed
          </span>
          <span className="rbp-legend-item denied">
            <i className="fas fa-xmark" aria-hidden="true" /> X = Not Allowed
          </span>
        </div>
      </header>

      <div className="rbp-columns-head card" role="presentation">
        <span>Permission</span>
        <span>Admin</span>
        <span>User</span>
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
                  <h2>{section.title}</h2>
                  <span className="rbp-section-count">{section.items.length} items</span>
                </div>
                <i className={`fas fa-chevron-${isOpen ? "up" : "down"}`} aria-hidden="true" />
              </button>

              {isOpen && (
                <div className="rbp-rows" id={`rbp-panel-${section.id}`}>
                  {section.items.map((item) => (
                    <div className="rbp-row" key={item.label}>
                      <div className="rbp-permission-name">{item.label}</div>
                      <div className="rbp-cell">
                        <PermissionStatus allowed={item.adminAllowed} />
                      </div>
                      <div className="rbp-cell">
                        <PermissionStatus allowed={item.userAllowed} />
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
