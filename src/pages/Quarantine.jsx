import { useEffect, useState, useRef, useMemo, Fragment } from "react";
import { Link } from "react-router-dom";
import { pocEndPoints } from "../axios/endPoints.js";
import { useI18n } from "../i18n.jsx";

const WHY = {
  empty: "The report cell was blank, or held nothing but codes and dates.",
  literal_noise: "The text matched a placeholder phrase (N/A, 없음, 확인중, TBD…).",
  numeric_only: "The text was only digits.",
  non_content: "The text was only punctuation or symbols.",
  too_short: "Fewer than the minimum characters once codes and dates were removed.",
  duplicate_row: "This exact report was already loaded under the same W/O code.",
  missing_mandatory_field:
    "A required column was blank — W/O code, process, equipment name, equipment code, work date, or site.",
};

function HighlightText({ text, query }) {
  if (text === undefined || text === null || text === "") return null;
  const strText = String(text);
  if (!query || !query.trim()) {
    return <>{strText}</>;
  }

  const trimmedQuery = query.trim();
  const escapedQuery = trimmedQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escapedQuery})`, "gi");
  const parts = strText.split(regex);

  return (
    <>
      {parts.map((part, index) =>
        regex.test(part) ? (
          <mark
            key={index}
            className="bg-yellow-200 dark:bg-yellow-800/80 text-gray-900 dark:text-gray-100 rounded-xs px-0.5"
          >
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

function formatDateTime(raw) {
  if (!raw || raw === "—" || raw === "-") return "—";
  try {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const hours = String(d.getHours()).padStart(2, "0");
      const minutes = String(d.getMinutes()).padStart(2, "0");
      const seconds = String(d.getSeconds()).padStart(2, "0");
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }
  } catch {
    // ignore
  }
  return String(raw);
}

export default function Quarantine() {
  const [data, setData] = useState(null);
  const [items, setItems] = useState([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reason, setReason] = useState("");
  const [showReleased, setShowReleased] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const tableContainerRef = useRef(null);
  const { t } = useI18n();

  const userManuallyToggledRef = useRef(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      setOffset(0);
      setHasMore(false);
      userManuallyToggledRef.current = false;

      const aiServer = (
        import.meta.env.VITE_APP_AI_POC_PIPELINE_SERVER || "http://107.108.32.188:8001"
      ).replace(/\/+$/, "");

      const fetchBatch = async (batchOffset, batchLimit = 100) => {
        const params = new URLSearchParams({
          include_released: String(showReleased),
          limit: String(batchLimit),
          offset: String(batchOffset),
        });
        if (reason) {
          params.append("reason", reason);
        }
        const apiUrl = `${aiServer}/api/quarantine?${params.toString()}`;
        const response = await fetch(apiUrl, {
          headers: { accept: "application/json" },
        });
        if (!response.ok) {
          throw new Error(`Failed to load quarantine data (status: ${response.status})`);
        }
        return await response.json();
      };

      const firstBatch = await fetchBatch(0, 100);
      setData(firstBatch);
      let allItems = firstBatch?.items || (Array.isArray(firstBatch) ? firstBatch : []);
      const total = firstBatch?.total ?? allItems.length;

      setItems(allItems);
      setLoading(false);

      // Auto-fetch remaining batches in background so all grouped data is complete
      let currentOffset = allItems.length;
      while (currentOffset < total) {
        setLoadingMore(true);
        const nextBatch = await fetchBatch(currentOffset, 100);
        const newItems = nextBatch?.items || (Array.isArray(nextBatch) ? nextBatch : []);
        if (newItems.length === 0) break;
        allItems = [...allItems, ...newItems];
        setItems(allItems);
        currentOffset += newItems.length;
        if (newItems.length < 100) break;
      }
      setOffset(currentOffset);
      setHasMore(currentOffset < total);
    } catch (err) {
      console.error("Quarantine fetch error:", err);
      setError(err.message || "Failed to load quarantine data.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [reason, showReleased]);

  const loadMoreData = async () => {
    if (loadingMore || loading || !hasMore) return;
    try {
      setLoadingMore(true);
      const aiServer = (
        import.meta.env.VITE_APP_AI_POC_PIPELINE_SERVER || "http://107.108.32.188:8001"
      ).replace(/\/+$/, "");

      const params = new URLSearchParams({
        include_released: String(showReleased),
        limit: "100",
        offset: String(offset),
      });
      if (reason) {
        params.append("reason", reason);
      }

      const apiUrl = `${aiServer}/api/quarantine?${params.toString()}`;

      const response = await fetch(apiUrl, {
        headers: { accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(`Failed to load more quarantine data (status: ${response.status})`);
      }

      const json = await response.json();
      const newItems = json?.items || (Array.isArray(json) ? json : []);
      setItems((prev) => [...prev, ...newItems]);
      const nextOffset = offset + newItems.length;
      setOffset(nextOffset);
      setHasMore(nextOffset < (json?.total ?? 0) && newItems.length === 100);
    } catch (err) {
      console.error("Quarantine scroll fetch error:", err);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleRelease = async (row) => {
    setBusy(row.id);
    setError(null);
    setNote(null);
    try {
      const aiServer = (
        import.meta.env.VITE_APP_AI_POC_PIPELINE_SERVER || "http://107.108.32.188:8001"
      ).replace(/\/+$/, "");

      const apiUrl = `${aiServer}/api/quarantine/${row.id}/release`;
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(`Failed to release row (status: ${response.status})`);
      }

      const r = await response.json();
      setNote(
        r.duplicate_of
          ? `Row ${row.source_row || row.id} released, but its text already exists in this process — recorded as a repeat report.`
          : `Row ${row.source_row || row.id} is now released as report ${r.report_id || r.id || ""}.`,
      );
      loadData();
    } catch (err) {
      console.error("Release error:", err);
      setError(err.message || "Failed to restore row.");
    } finally {
      setBusy(null);
    }
  };

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 40) {
      if (hasMore && !loadingMore && !loading) {
        loadMoreData();
      }
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter((r) => {
      if (reason && String(r.reason || "").toLowerCase() !== reason.toLowerCase()) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const str = JSON.stringify(r).toLowerCase();
      return str.includes(q);
    });
  }, [items, searchQuery, reason]);

  const reasonCounts = useMemo(() => {
    const counts = {};
    if (data?.by_reason && typeof data.by_reason === "object") {
      Object.entries(data.by_reason).forEach(([k, v]) => {
        counts[k] = v;
      });
    }
    // Also include counts from items in case by_reason wasn't fully returned
    items.forEach((item) => {
      const rKey = item.reason || "unknown";
      if (!(rKey in counts)) {
        counts[rKey] = items.filter((i) => (i.reason || "unknown") === rKey).length;
      }
    });
    return counts;
  }, [data?.by_reason, items]);

  // Group items by source_file and created_at
  const groupedData = useMemo(() => {
    const groupsMap = new Map();

    filteredItems.forEach((item) => {
      const file = item.source_file || "Unknown File";
      const createdAt = item.created_at || "—";
      const key = `${file}___${createdAt}`;

      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          groupKey: key,
          source_file: file,
          created_at: createdAt,
          items: [],
        });
      }
      groupsMap.get(key).items.push(item);
    });

    return Array.from(groupsMap.values());
  }, [filteredItems]);

  useEffect(() => {
    if (groupedData.length > 0 && !userManuallyToggledRef.current) {
      setExpandedGroups(new Set(groupedData.map((g) => g.groupKey)));
    }
  }, [groupedData]);

  const isAllExpanded =
    groupedData.length > 0 && groupedData.every((g) => expandedGroups.has(g.groupKey));

  const toggleGroup = (key) => {
    userManuallyToggledRef.current = true;
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleAllGroups = () => {
    userManuallyToggledRef.current = true;
    if (isAllExpanded) {
      setExpandedGroups(new Set());
    } else {
      setExpandedGroups(new Set(groupedData.map((g) => g.groupKey)));
    }
  };

  return (
    <section className="flex-1 flex flex-col min-h-0 space-y-6">
      {/* Page Header */}
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between relative z-20">
        <div>
          <h1 className="page-title flex items-center gap-2.5">
            <i className="fas fa-shield-alt text-amber-600 text-xl md:text-[22px]" />
            <span>Quarantine</span>
          </h1>
          <p className="page-subtitle">
            Rows that were read but judged to have no usable report text. They are kept, not deleted
            — but they do <b>not</b> appear in the export.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative w-80 sm:w-96 md:w-[380px]">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none" />
            <input
              type="text"
              className="input-base text-xs w-full py-1.5"
              style={{ paddingLeft: "2.25rem" }}
              placeholder="Search file, W/O code, text..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <select
            className="input-base py-1.5 text-xs min-w-[180px]"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          >
            <option value="">All reasons</option>
            {Object.entries(reasonCounts).map(([rKey, count]) => (
              <option key={rKey} value={rKey}>
                {rKey} ({count})
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={loadData}
            className="btn-base btn-secondary w-8 h-8 flex items-center justify-center p-0 rounded-lg text-xs shrink-0"
            title="Refresh"
            aria-label="Refresh"
          >
            <i className={`fas fa-sync-alt text-xs ${loading ? "fa-spin" : ""}`} />
          </button>
        </div>
      </header>

      {/* Notices */}
      {error && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
          <i className="fas fa-exclamation-circle text-sm" />
          <span>{error}</span>
        </div>
      )}

      {note && (
        <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 text-xs flex items-center gap-2">
          <i className="fas fa-check-circle text-sm" />
          <span>{note}</span>
        </div>
      )}

      {/* Main Card */}
      <div className="card flex-1 flex flex-col min-h-0 p-0 overflow-hidden shadow-xs border border-border-base bg-surface-default">
        {/* Filters bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-3 border-b border-border-base bg-gray-50/50 dark:bg-gray-800/40 shrink-0">
          <div className="flex items-center gap-3">
            {groupedData.length > 0 && (
              <button
                type="button"
                onClick={toggleAllGroups}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1.5 cursor-pointer"
              >
                <i
                  className={`fas ${
                    isAllExpanded ? "fa-compress-alt" : "fa-expand-alt"
                  } text-[11px]`}
                />
                <span>{isAllExpanded ? "Collapse All" : "Expand All"}</span>
              </button>
            )}
          </div>

          <div className="text-xs text-text-subtle font-mono">
            {groupedData.length} group{groupedData.length === 1 ? "" : "s"} ({filteredItems.length}{" "}
            quarantined row{filteredItems.length === 1 ? "" : "s"})
          </div>
        </div>

        {/* Content Body */}
        {loading && !data ? (
          <div className="flex flex-col items-center justify-center py-20 text-text-subtle">
            <i className="fas fa-spinner fa-spin text-3xl text-amber-600 mb-3" />
            <p className="text-sm font-medium">Loading quarantine items...</p>
          </div>
        ) : data?.total === 0 || filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-text-subtle">
            <i className="fas fa-shield-alt text-5xl opacity-30 mb-3 text-amber-500" />
            <h3 className="text-base font-semibold text-text-default mb-1">
              Nothing is quarantined
            </h3>
            <p className="text-xs text-text-subtle max-w-sm text-center">
              Every row that was read had usable report text or matches your filter criteria.
            </p>
          </div>
        ) : (
          <div
            ref={tableContainerRef}
            onScroll={handleScroll}
            className="overflow-auto flex-1 max-h-[calc(88vh-160px)]"
          >
            <table className="w-full text-xs text-left border-collapse table-fixed">
              <colgroup>
                <col style={{ width: "48px" }} />
                <col style={{ width: "64px" }} />
                <col style={{ width: "42%" }} />
                <col style={{ width: "26%" }} />
                <col style={{ width: "180px" }} />
              </colgroup>
              <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0 z-20 border-b border-border-base shadow-xs">
                <tr className="font-semibold text-text-subtle whitespace-nowrap">
                  <th className="px-3 py-3 text-center" />
                  <th className="px-3 py-3 text-center">S.No</th>
                  <th className="px-4 py-3">Source File</th>
                  <th className="px-4 py-3">Created At</th>
                  <th className="px-4 py-3 text-center">Count of Quarantines</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-base">
                {groupedData.map((group, gIdx) => {
                  const isExpanded = expandedGroups.has(group.groupKey);

                  return (
                    <Fragment key={group.groupKey}>
                      {/* Main Group Row */}
                      <tr
                        onClick={() => toggleGroup(group.groupKey)}
                        className={`cursor-pointer transition-colors ${
                          isExpanded
                            ? "bg-amber-50/40 dark:bg-amber-950/20 hover:bg-amber-50/70 dark:hover:bg-amber-950/30 font-semibold"
                            : "hover:bg-gray-50/90 dark:hover:bg-gray-800/60"
                        }`}
                      >
                        {/* Expand Icon */}
                        <td className="px-3 py-3.5 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleGroup(group.groupKey);
                            }}
                            className="w-7 h-7 inline-flex items-center justify-center rounded-lg hover:bg-gray-200/80 dark:hover:bg-gray-700 transition-all text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100 cursor-pointer"
                            aria-label={isExpanded ? "Collapse" : "Expand"}
                          >
                            <i
                              className={`fas fa-chevron-right text-xs transition-transform duration-200 ${
                                isExpanded ? "rotate-90 text-amber-600 dark:text-amber-400" : ""
                              }`}
                            />
                          </button>
                        </td>

                        {/* S.No */}
                        <td className="px-3 py-3.5 text-center font-mono font-medium text-text-subtle text-xs">
                          {gIdx + 1}
                        </td>

                        {/* Source File */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2 text-text-default font-medium">
                            <i className="fas fa-file-excel text-emerald-600 dark:text-emerald-400 text-sm shrink-0" />
                            <span className="truncate max-w-[380px]" title={group.source_file}>
                              <HighlightText text={group.source_file} query={searchQuery} />
                            </span>
                          </div>
                        </td>

                        {/* Created At */}
                        <td className="px-4 py-3.5 whitespace-nowrap text-text-subtle font-mono text-xs">
                          <div className="inline-flex items-center gap-1.5">
                            <i className="far fa-clock text-gray-400 text-[11px]" />
                            <span>{formatDateTime(group.created_at)}</span>
                          </div>
                        </td>

                        {/* Count of Quarantines */}
                        <td className="px-4 py-3.5 text-center">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80 shadow-2xs">
                            <i className="fas fa-shield-alt text-[10px]" />
                            <span>{group.items.length}</span>
                          </span>
                        </td>
                      </tr>

                      {/* Expanded Subtable */}
                      {isExpanded && (
                        <tr className="expanded-detail-row bg-slate-50/40 dark:bg-gray-900/40">
                          <td colSpan={5} className="p-0 border-b border-border-base">
                            <div className="p-4 pl-12 pr-6 bg-slate-50/80 dark:bg-gray-900/70 border-y border-dashed border-gray-200 dark:border-gray-800 space-y-2.5">
                              <div className="flex items-center justify-between pb-0.5">
                                <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                                  <i className="fas fa-list-ul text-amber-600 text-xs" />
                                  <span>Quarantined Items in {group.source_file}</span>
                                </span>
                                <span className="text-[10px] text-gray-400 font-mono">
                                  {group.items.length} records
                                </span>
                              </div>

                              <div className="rounded-xl border border-border-base bg-white dark:bg-gray-800/95 overflow-hidden shadow-xs">
                                <table className="quarantine-subtable w-full text-xs text-left border-collapse table-fixed">
                                  <colgroup>
                                    <col style={{ width: "70px" }} />
                                    <col style={{ width: "140px" }} />
                                    <col style={{ width: "240px" }} />
                                    <col style={{ width: "auto" }} />
                                    <col style={{ width: "240px" }} />
                                  </colgroup>
                                  <thead className="bg-gray-50 dark:bg-gray-750 border-b border-border-base text-[11px] font-semibold text-text-subtle uppercase tracking-wider sticky top-0 z-10">
                                    <tr>
                                      <th className="px-3.5 py-2.5 text-center">Row</th>
                                      <th className="px-3.5 py-2.5">W/O Code</th>
                                      <th className="px-3.5 py-2.5">
                                        Process · Equipment
                                      </th>
                                      <th className="px-3.5 py-2.5">
                                        What the cell held
                                      </th>
                                      <th className="px-3.5 py-2.5">Why</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-border-base text-xs bg-white dark:bg-gray-800">
                                    {group.items.map((r) => {
                                      const isReleased = Boolean(
                                        r.released_report_id || r.released_at,
                                      );

                                      return (
                                          <tr
                                            key={r.id}
                                            className={`transition-colors ${
                                              isReleased
                                                ? "opacity-60 bg-gray-50/30"
                                                : "hover:bg-blue-50/90 dark:hover:bg-blue-950/40"
                                            }`}
                                          >
                                          {/* Row */}
                                          <td className="px-3.5 py-2.5 font-mono text-center text-text-subtle font-medium">
                                            <HighlightText
                                              text={`row ${r.source_row ?? "-"}`}
                                              query={searchQuery}
                                            />
                                          </td>

                                          {/* W/O code */}
                                          <td className="px-3.5 py-2.5 font-mono font-medium text-text-default">
                                            <HighlightText
                                              text={r.wo_code || "—"}
                                              query={searchQuery}
                                            />
                                          </td>

                                          {/* Process · Equipment */}
                                          <td className="px-3.5 py-2.5 text-xs">
                                            <div className="font-medium text-text-default">
                                              <HighlightText
                                                text={r.process || "—"}
                                                query={searchQuery}
                                              />
                                            </div>
                                            <div
                                              className="text-[11px] text-text-subtle truncate max-w-[240px]"
                                              title={`${
                                                r.equipment_name ||
                                                r.equipmentName ||
                                                r.eqname ||
                                                r.Eqname ||
                                                r.equipment ||
                                                ""
                                              }${
                                                r.equipment_code ||
                                                r.equipmentCode ||
                                                r.eqcode ||
                                                r.Eqcode
                                                  ? ` (${
                                                      r.equipment_code ||
                                                      r.equipmentCode ||
                                                      r.eqcode ||
                                                      r.Eqcode
                                                    })`
                                                  : ""
                                              }`}
                                            >
                                              <HighlightText
                                                text={`${
                                                  r.equipment_name ||
                                                  r.equipmentName ||
                                                  r.eqname ||
                                                  r.Eqname ||
                                                  r.equipment ||
                                                  ""
                                                }${
                                                  r.equipment_code ||
                                                  r.equipmentCode ||
                                                  r.eqcode ||
                                                  r.Eqcode
                                                    ? ` (${
                                                        r.equipment_code ||
                                                        r.equipmentCode ||
                                                        r.eqcode ||
                                                        r.Eqcode
                                                      })`
                                                    : ""
                                                }`}
                                                query={searchQuery}
                                              />
                                            </div>
                                          </td>

                                          {/* What the cell held */}
                                          <td className="px-3.5 py-2.5 text-xs max-w-[280px]">
                                            {r.raw_content ? (
                                              <code
                                                className="bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 px-2 py-1 rounded-md font-mono text-[11px] block truncate"
                                                title={String(r.raw_content)}
                                              >
                                                <HighlightText
                                                  text={String(r.raw_content).slice(0, 140)}
                                                  query={searchQuery}
                                                />
                                              </code>
                                            ) : (
                                              <span className="text-text-subtle italic">
                                                (blank)
                                              </span>
                                            )}
                                          </td>

                                          {/* Why */}
                                          <td className="px-3.5 py-2.5 text-xs">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 mb-1">
                                              <HighlightText
                                                text={r.reason || "quarantined"}
                                                query={searchQuery}
                                              />
                                            </span>
                                            <div className="text-[11px] text-text-subtle leading-tight">
                                              <HighlightText
                                                text={WHY[r.reason] || ""}
                                                query={searchQuery}
                                              />
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            {loadingMore && (
              <div className="py-2.5 text-center text-xs text-amber-600 dark:text-amber-400 bg-gray-50/80 dark:bg-gray-800/80 border-t border-border-base flex items-center justify-center gap-2">
                <i className="fas fa-spinner fa-spin text-sm" />
                <span>Loading more quarantine items...</span>
              </div>
            )}
            {hasMore && !loadingMore && (
              <div className="py-3 text-center bg-gray-50/80 dark:bg-gray-800/80 border-t border-border-base">
                <button
                  type="button"
                  onClick={loadMoreData}
                  className="btn-base btn-secondary text-xs py-1.5 px-4 font-semibold inline-flex items-center gap-1.5"
                >
                  <i className="fas fa-arrow-down text-[11px]" />
                  <span>Load More Records</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
