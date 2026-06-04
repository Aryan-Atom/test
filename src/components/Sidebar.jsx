import { useState } from "react";

const navGroups = [
  {
    id: "data",
    label: "데이터 관리",
    icon: "fa-database",
    children: [
      { id: "dm-change", label: "변경 이력 데이터", icon: "fa-history" },
      { id: "dm-spec", label: "사양 데이터", icon: "fa-microchip" },
    ],
  },
  {
    id: "matrix",
    label: "변경 매트릭스",
    icon: "fa-layer-group",
    children: [
      { id: "mx-matrix", label: "매트릭스 조회", icon: "fa-table" },
      { id: "mx-mplist", label: "MP List 조회", icon: "fa-list" },
    ],
  },
  {
    id: "others",
    label: "기타 기능",
    icon: "fa-th-large",
    children: [
      { id: "spec", label: "사양 매트릭스", icon: "fa-sitemap" },
      { id: "board", label: "게시판", icon: "fa-comments" },
      { id: "admin", label: "권한 관리", icon: "fa-user-shield" },
    ],
  },
];

export default function Sidebar({ activePage, onNavigate }) {
  const [openGroups, setOpenGroups] = useState({
    data: true,
    matrix: true,
    others: false,
  });
  const [collapsed, setCollapsed] = useState(false);

  const toggleGroup = (groupId) => {
    setOpenGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  return (
    <aside
      className={`glass flex h-screen ${collapsed ? "w-20" : "w-80"} flex-col border-r border-border-base p-3`}
    >
      <div className="flex items-center gap-3 border-b border-border-base/80 pb-4 px-2">
        {/* <div
          className={`flex ${collapsed ? "h-10 w-10" : "h-14 w-14"} items-center justify-center rounded-full text-text-default`}
        >
          <i className="fas fa-layer-group text-lg" />
        </div>  */}
        <div className={collapsed ? "hidden" : ""}>
          <div className="text-xl font-black text-text-default px-10">
            Equipment Analysis
          </div>
          <div className="text-xs uppercase tracking-[0.22em] text-text-subtle"></div>
        </div>
      </div>

      <nav className="mt-4 flex-1 overflow-auto pr-2 space-y-4">
        {navGroups.map((group) => {
          const isActiveGroup = group.children.some(
            (item) => item.id === activePage,
          );
          const isOpen = openGroups[group.id];

          return (
            <div
              key={group.id}
              className="rounded-3xl border border-border-base bg-surface-default/80 p-2 shadow-sm"
            >
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                className={`flex w-full items-center justify-between gap-3 text-sm font-semibold text-text-default transition ${
                  isActiveGroup ? "text-brand-60" : "hover:text-text-default"
                }`}
                title={group.label}
              >
                <span className="flex items-center gap-3">
                  <i
                    className={`fas ${group.icon || "fa-layer-group"} text-base w-6 text-center`}
                  />
                  <span className={collapsed ? "hidden" : ""}>
                    {group.label}
                  </span>
                </span>
                <i
                  className={`fas fa-chevron-${isOpen ? "up" : "down"} text-text-subtle ${collapsed ? "hidden" : ""}`}
                />
              </button>

              <div
                className={`mt-3 space-y-2 ${collapsed || !isOpen ? "hidden" : ""}`}
              >
                {group.children.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onNavigate(item.id)}
                    title={item.label}
                    className={`flex w-full items-center gap-3 rounded-3xl px-4 py-3 text-sm transition ${
                      activePage === item.id
                        ? "bg-brand-10 text-brand-60 shadow-sm"
                        : "text-text-subtle hover:bg-surface-strong"
                    }`}
                  >
                    <i
                      className={`fas ${item.icon || "fa-circle-question"} w-5 text-center`}
                    />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="mt-4 pt-3 border-t border-border-base/80">
        <div className="flex items-center justify-center  ">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="btn-ghost rounded-full p-2"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <i
              className={`fas ${collapsed ? "fa-angle-right" : "fa-angle-left"} text-text-subtle`}
            />
          </button>
        </div>
      </div>
    </aside>
  );
}
