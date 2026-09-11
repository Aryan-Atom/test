import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../i18n.jsx";
import { pocEndPoints } from "../axios/endPoints.js";

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
  const [modelsData, setModelsData] = useState(null);
  const [showModelsModal, setShowModelsModal] = useState(false);

  // Poll AI models API every 4 seconds
  useEffect(() => {
    let isMounted = true;
    const fetchModels = async () => {
      try {
        const url =
          pocEndPoints.AI_PIPELINE_MODELS ||
          "http://107.108.32.188:8001/api/models";
        const res = await fetch(url, {
          headers: { accept: "application/json" },
        });
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setModelsData(data);
          }
        }
      } catch (err) {
        // Silently handle polling error
      }
    };

    fetchModels();
    const interval = setInterval(fetchModels, 4000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const languageModel = modelsData?.models?.find((m) => m.role === "language");
  const embeddingModel = modelsData?.models?.find((m) => m.role === "embedding");

  const getStatusInfo = (status) => {
    const s = String(status || "").toLowerCase();
    if (s === "ready" || s === "ok" || s === "online") {
      return {
        label: t("sidebar.ready", "Ready"),
        badgeClass:
          "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800",
        dotClass: "bg-emerald-500",
        icon: "fa-check-circle",
      };
    }
    if (s === "unreachable" || s === "failed" || s === "error") {
      return {
        label: t("sidebar.unreachable", "Unreachable"),
        badgeClass:
          "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400 border border-red-200 dark:border-red-800",
        dotClass: "bg-red-500",
        icon: "fa-exclamation-circle",
      };
    }
    return {
      label: status || "Unknown",
      badgeClass:
        "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-200 dark:border-amber-800",
      dotClass: "bg-amber-500",
      icon: "fa-circle-notch",
    };
  };

  const cleanModelName = (name) => {
    if (!name) return "-";
    const parts = String(name).replace(/\/+$/, "").split("/");
    return parts[parts.length - 1] || name;
  };

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

      {/* AI Models & System Status Card */}
      <div className="eq-sidebar-models mt-auto space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-bold text-gray-500 dark:text-gray-400 tracking-wider uppercase flex items-center gap-1.5">
            <i className="fas fa-microchip text-[11px] text-[#1745c2] dark:text-blue-400" />
            <span>{t("sidebar.aiModels", "AI Models")}</span>
          </div>
          {modelsData ? (
            <button
              type="button"
              onClick={() => setShowModelsModal(true)}
              className="p-1 rounded-full hover:bg-gray-200/70 dark:hover:bg-gray-700/60 transition-colors cursor-pointer flex items-center justify-center"
              title={
                modelsData.all_ready
                  ? "All models ready (Click to view details)"
                  : "Issues detected in one or more models (Click to view details)"
              }
            >
              <span
                className={`w-2.5 h-2.5 rounded-full inline-block ${
                  modelsData.all_ready
                    ? "bg-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-950 animate-pulse"
                    : "bg-red-500 ring-2 ring-red-200 dark:ring-red-950"
                }`}
              />
            </button>
          ) : (
            <span
              className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-600 inline-block animate-pulse"
              title="Checking models..."
            />
          )}
        </div>

        {/* Language & Embedding Rows */}
        <div className="space-y-1.5 pt-0.5">
          {/* Language Model */}
          {languageModel ? (
            <div
              onClick={() => setShowModelsModal(true)}
              className="p-2 rounded-lg bg-white/90 dark:bg-gray-800/80 border border-gray-200/80 dark:border-gray-700/80 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/30 dark:hover:bg-blue-950/20 transition-all cursor-pointer group shadow-2xs"
              title={`Language Model: ${
                languageModel.status === "ready" ? "Ready" : "Unreachable"
              }\nModel: ${languageModel.name}${
                languageModel.endpoint ? `\nEndpoint: ${languageModel.endpoint}` : ""
              }${
                languageModel.detail ? `\nDetail: ${languageModel.detail}` : ""
              }\n(Click to view details)`}
            >
              <div className="flex items-center justify-between text-[11px] leading-tight">
                <span className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1.5 group-hover:text-[#1745c2] dark:group-hover:text-blue-400 transition-colors">
                  <i className="fas fa-brain text-[10px] text-blue-600 dark:text-blue-400" />
                  <span>{t("sidebar.languageModel", "Language")}</span>
                </span>
                {/* Circle only, tooltip on hover */}
                <span
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    languageModel.status === "ready"
                      ? "bg-emerald-500 ring-2 ring-emerald-100 dark:ring-emerald-950/60"
                      : "bg-red-500 ring-2 ring-red-100 dark:ring-red-950/60"
                  }`}
                  title={
                    languageModel.status === "ready"
                      ? "Ready"
                      : `Unreachable: ${languageModel.detail || "Error"}`
                  }
                />
              </div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400 font-mono truncate mt-1 flex items-center justify-between">
                <span className="truncate" title={languageModel.name}>
                  {cleanModelName(languageModel.name)}
                </span>
                <i className="fas fa-arrow-up-right-from-square text-[8px] opacity-0 group-hover:opacity-100 text-gray-400 transition-opacity ml-1 shrink-0" />
              </div>
            </div>
          ) : (
            <div className="p-2 rounded-lg bg-white/50 dark:bg-gray-800/50 border border-gray-200/60 dark:border-gray-700/60 flex items-center justify-between text-[11px]">
              <span className="text-gray-500 flex items-center gap-1.5">
                <i className="fas fa-brain text-[10px] text-gray-400" />
                <span>{t("sidebar.languageModel", "Language")}</span>
              </span>
              <span className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600" title="Loading..." />
            </div>
          )}

          {/* Embedding Model */}
          {embeddingModel ? (
            <div
              onClick={() => setShowModelsModal(true)}
              className="p-2 rounded-lg bg-white/90 dark:bg-gray-800/80 border border-gray-200/80 dark:border-gray-700/80 hover:border-purple-400 dark:hover:border-purple-500 hover:bg-purple-50/30 dark:hover:bg-purple-950/20 transition-all cursor-pointer group shadow-2xs"
              title={`Embedding Model: ${
                embeddingModel.status === "ready" ? "Ready" : "Unreachable"
              }\nModel: ${embeddingModel.name}${
                embeddingModel.version ? `\nVersion: ${embeddingModel.version}` : ""
              }${
                embeddingModel.detail ? `\nDetail: ${embeddingModel.detail}` : ""
              }\n(Click to view details)`}
            >
              <div className="flex items-center justify-between text-[11px] leading-tight">
                <span className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1.5 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                  <i className="fas fa-vector-square text-[10px] text-purple-600 dark:text-purple-400" />
                  <span>{t("sidebar.embeddingModel", "Embedding")}</span>
                </span>
                {/* Circle only, tooltip on hover */}
                <span
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    embeddingModel.status === "ready"
                      ? "bg-emerald-500 ring-2 ring-emerald-100 dark:ring-emerald-950/60"
                      : "bg-red-500 ring-2 ring-red-100 dark:ring-red-950/60"
                  }`}
                  title={
                    embeddingModel.status === "ready"
                      ? "Ready"
                      : `Unreachable: ${embeddingModel.detail || "Error"}`
                  }
                />
              </div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400 font-mono truncate mt-1 flex items-center justify-between">
                <span className="truncate" title={embeddingModel.name}>
                  {cleanModelName(embeddingModel.name)}
                </span>
                <i className="fas fa-arrow-up-right-from-square text-[8px] opacity-0 group-hover:opacity-100 text-gray-400 transition-opacity ml-1 shrink-0" />
              </div>
            </div>
          ) : (
            <div className="p-2 rounded-lg bg-white/50 dark:bg-gray-800/50 border border-gray-200/60 dark:border-gray-700/60 flex items-center justify-between text-[11px]">
              <span className="text-gray-500 flex items-center gap-1.5">
                <i className="fas fa-vector-square text-[10px] text-gray-400" />
                <span>{t("sidebar.embeddingModel", "Embedding")}</span>
              </span>
              <span className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600" title="Loading..." />
            </div>
          )}
        </div>
      </div>

      {/* Collapsed view status icon */}
      {collapsed && (
        <div className="p-3 flex flex-col items-center gap-2 border-t border-border-base mt-auto">
          <button
            type="button"
            className="w-10 h-10 rounded-xl flex items-center justify-center relative cursor-pointer bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title={`AI Models: ${
              modelsData?.all_ready ? "All Ready" : "Issues Detected"
            } (Click for details)`}
            onClick={() => setShowModelsModal(true)}
          >
            <i className="fas fa-microchip text-sm" />
            <span
              className={`absolute top-2 right-2 w-2 h-2 rounded-full ring-2 ring-white dark:ring-gray-900 ${
                modelsData?.all_ready ? "bg-emerald-500" : "bg-red-500"
              }`}
            />
          </button>
        </div>
      )}

      {/* Models Detail Modal */}
      {showModelsModal &&
        createPortal(
          <div className="modal-overlay fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen z-[10000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="card w-full max-w-xl overflow-hidden shadow-2xl space-y-4 z-[10001]">
              <div className="p-4 border-b border-border-base flex items-center justify-between bg-gray-50 dark:bg-gray-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <i className="fas fa-microchip text-sm" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-gray-900 dark:text-gray-100">
                      {t("sidebar.modelDetails", "AI Models Status")}
                    </h3>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      {modelsData?.checked_at
                        ? `Checked at: ${new Date(
                            modelsData.checked_at,
                          ).toLocaleString()}`
                        : "Live model status polling every 4s"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                  onClick={() => setShowModelsModal(false)}
                >
                  <i className="fas fa-times text-sm" />
                </button>
              </div>

              <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto text-xs">
                {/* Overall status banner */}
                <div
                  className={`p-3 rounded-xl border flex items-center justify-between ${
                    modelsData?.all_ready
                      ? "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/80 text-emerald-800 dark:text-emerald-300"
                      : "bg-red-50/70 dark:bg-red-950/30 border-red-200 dark:border-red-800/80 text-red-800 dark:text-red-300"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <i
                      className={`fas ${
                        modelsData?.all_ready
                          ? "fa-check-circle text-emerald-600"
                          : "fa-triangle-exclamation text-red-600"
                      } text-base`}
                    />
                    <span className="font-semibold text-xs">
                      {modelsData?.all_ready
                        ? "All models are operational"
                        : "One or more models are unreachable or encountering errors"}
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-bold uppercase ${
                      modelsData?.all_ready
                        ? "bg-emerald-200/80 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200"
                        : "bg-red-200/80 dark:bg-red-900/60 text-red-900 dark:text-red-200"
                    }`}
                  >
                    {modelsData?.all_ready ? "Ready" : "Degraded"}
                  </span>
                </div>

                {/* Models Detail Cards */}
                <div className="space-y-3">
                  {(modelsData?.models || []).map((m, idx) => {
                    const isLang = m.role === "language";
                    const sInfo = getStatusInfo(m.status);
                    return (
                      <div
                        key={idx}
                        className="rounded-xl border border-border-base p-3.5 bg-gray-50/60 dark:bg-gray-800/50 space-y-2.5 shadow-2xs"
                      >
                        <div className="flex items-center justify-between border-b border-border-base/70 pb-2">
                          <div className="flex items-center gap-2">
                            <i
                              className={`fas ${
                                isLang
                                  ? "fa-brain text-blue-500"
                                  : "fa-vector-square text-purple-500"
                              } text-sm`}
                            />
                            <span className="font-bold text-xs capitalize text-gray-800 dark:text-gray-200">
                              {m.role || "Model"} Model
                            </span>
                          </div>
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${sInfo.badgeClass}`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${sInfo.dotClass}`}
                            />
                            <span className="capitalize">
                              {m.status || "Unknown"}
                            </span>
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <span className="text-gray-500 font-medium">
                            Model Name:
                          </span>
                          <span className="col-span-2 font-mono font-medium text-gray-800 dark:text-gray-200 break-all">
                            {m.name || "-"}
                          </span>
                        </div>

                        {m.provider && (
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <span className="text-gray-500 font-medium">
                              Provider:
                            </span>
                            <span className="col-span-2 font-mono text-gray-700 dark:text-gray-300">
                              {m.provider}
                            </span>
                          </div>
                        )}

                        {m.endpoint && (
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <span className="text-gray-500 font-medium">
                              Endpoint:
                            </span>
                            <span className="col-span-2 font-mono text-blue-600 dark:text-blue-400 break-all">
                              {m.endpoint}
                            </span>
                          </div>
                        )}

                        {m.version && (
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <span className="text-gray-500 font-medium">
                              Version:
                            </span>
                            <span className="col-span-2 font-mono text-gray-700 dark:text-gray-300">
                              {m.version}
                            </span>
                          </div>
                        )}

                        {m.detail && (
                          <div className="pt-1">
                            <span className="text-gray-500 font-medium block mb-1">
                              Details:
                            </span>
                            <div
                              className={`p-2.5 rounded-lg font-mono text-[11px] break-all ${
                                m.status === "ready"
                                  ? "bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/70"
                                  : "bg-red-50/70 dark:bg-red-950/40 text-red-800 dark:text-red-300 border border-red-200/70 dark:border-red-800/70"
                              }`}
                            >
                              {m.detail}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-4 border-t border-border-base flex justify-end bg-gray-50 dark:bg-gray-800">
                <button
                  type="button"
                  className="btn-secondary text-xs px-4 py-1.5 cursor-pointer"
                  onClick={() => setShowModelsModal(false)}
                >
                  {t("app.close", "Close")}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </aside>
  );
}
