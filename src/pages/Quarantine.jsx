import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { pocEndPoints } from "../axios/endPoints.js";
import { useI18n } from "../i18n.jsx";

const WHY = {
  empty: "The report cell was blank, or held nothing but codes and dates.",
  literal_noise: "The text matched a placeholder phrase (N/A, 없음, 확인중, TBD…).",
  numeric_only: "The text was only digits.",
  non_content: "The text was only punctuation or symbols.",
  too_short: "Fewer than the minimum characters once codes and dates were removed.",
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
  const tableContainerRef = useRef(null);
  const { t } = useI18n();

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      setOffset(0);
      setHasMore(true);

      const aiServer = (
        import.meta.env.VITE_APP_AI_POC_PIPELINE_SERVER || "http://107.108.32.188:8001"
      ).replace(/\/+$/, "");

      const params = new URLSearchParams({
        include_released: String(showReleased),
        limit: "50",
        offset: "0",
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

      const json = await response.json();
      setData(json);
      const newItems = json?.items || (Array.isArray(json) ? json : []);
      setItems(newItems);
      setOffset(50);
      setHasMore(newItems.length === 50);
    } catch (err) {
      console.error("Quarantine fetch error:", err);
      setError(err.message || "Failed to load quarantine data.");
    } finally {
      setLoading(false);
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
        limit: "50",
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
      setOffset((prev) => prev + 50);
      setHasMore(newItems.length === 50);
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
          : `Row ${row.source_row || row.id} is now released as report ${r.report_id || r.id || ""}.`
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

  const filteredItems = items.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const str = JSON.stringify(r).toLowerCase();
    return str.includes(q);
  });

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
            Rows that were read but judged to have no usable report text. They are kept, not deleted — but they do <b>not</b> appear in the export.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-64 sm:w-80">
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

          <button
            type="button"
            onClick={loadData}
            className="btn-base btn-secondary flex items-center gap-1.5 text-xs py-1.5 px-3"
            title="Refresh"
          >
            <i className={`fas fa-sync-alt text-xs ${loading ? "fa-spin" : ""}`} />
            <span>Refresh</span>
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
        <div className="flex flex-wrap items-center justify-end gap-4 px-6 py-3 border-b border-border-base bg-gray-50/50 dark:bg-gray-800/40 shrink-0">
          <div className="text-xs text-text-subtle font-mono">
            {data?.total != null ? data.total.toLocaleString() : 0} row
            {data?.total === 1 ? "" : "s"}
            {reason && (
              <>
                {" "}with reason <b>{reason}</b>
              </>
            )}
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
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-gray-50 dark:bg-gray-800/80 sticky top-0 z-10 border-b border-border-base">
                <tr className="font-semibold text-text-subtle whitespace-nowrap">
                  <th className="px-4 py-3 min-w-[160px]">Source</th>
                  <th className="px-4 py-3 min-w-[120px]">W/O code</th>
                  <th className="px-4 py-3 min-w-[180px]">Process · Equipment</th>
                  <th className="px-4 py-3 min-w-[220px]">What the cell held</th>
                  <th className="px-4 py-3 min-w-[200px]">Why</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-base">
                {filteredItems.map((r) => {
                  const isReleased = Boolean(r.released_report_id || r.released_at);

                  return (
                    <tr
                      key={r.id}
                      className={`transition-colors hover:bg-gray-50/80 dark:hover:bg-gray-800/60 ${
                        isReleased ? "opacity-60 bg-gray-50/30" : ""
                      }`}
                    >
                      {/* Source */}
                      <td className="px-4 py-3 font-mono text-xs">
                        <div className="font-medium text-text-default truncate max-w-[180px]" title={r.source_file}>
                          <HighlightText text={r.source_file || "-"} query={searchQuery} />
                        </div>
                        <div className="text-[11px] text-text-subtle">
                          <HighlightText text={`row ${r.source_row ?? "-"}`} query={searchQuery} />
                        </div>
                      </td>

                      {/* W/O code */}
                      <td className="px-4 py-3 font-mono font-medium text-text-default">
                        <HighlightText text={r.wo_code || "—"} query={searchQuery} />
                      </td>

                      {/* Process · Equipment */}
                      <td className="px-4 py-3 text-xs">
                        <div className="font-medium text-text-default">
                          <HighlightText text={r.process || "—"} query={searchQuery} />
                        </div>
                        <div
                          className="text-[11px] text-text-subtle truncate max-w-[200px]"
                          title={`${r.equipment_name || r.equipmentName || r.eqname || r.Eqname || r.equipment || ""}${
                            r.equipment_code || r.equipmentCode || r.eqcode || r.Eqcode
                              ? ` (${r.equipment_code || r.equipmentCode || r.eqcode || r.Eqcode})`
                              : ""
                          }`}
                        >
                          <HighlightText
                            text={`${r.equipment_name || r.equipmentName || r.eqname || r.Eqname || r.equipment || ""}${
                              r.equipment_code || r.equipmentCode || r.eqcode || r.Eqcode
                                ? ` (${r.equipment_code || r.equipmentCode || r.eqcode || r.Eqcode})`
                                : ""
                            }`}
                            query={searchQuery}
                          />
                        </div>
                      </td>

                      {/* What the cell held */}
                      <td className="px-4 py-3 text-xs max-w-[260px]">
                        {r.raw_content ? (
                          <code
                            className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-1.5 py-0.5 rounded font-mono text-[11px] block truncate"
                            title={String(r.raw_content)}
                          >
                            <HighlightText text={String(r.raw_content).slice(0, 120)} query={searchQuery} />
                          </code>
                        ) : (
                          <span className="text-text-subtle italic">(blank)</span>
                        )}
                      </td>

                      {/* Why */}
                      <td className="px-4 py-3 text-xs">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 mb-1">
                          <HighlightText text={r.reason || "quarantined"} query={searchQuery} />
                        </span>
                        <div className="text-[11px] text-text-subtle leading-tight">
                          <HighlightText text={WHY[r.reason] || ""} query={searchQuery} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {loadingMore && (
              <div className="py-2.5 text-center text-xs text-amber-600 dark:text-amber-400 bg-gray-50/80 dark:bg-gray-800/80 border-t border-border-base flex items-center justify-center gap-2">
                <i className="fas fa-spinner fa-spin text-sm" />
                <span>Loading next 50 items...</span>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
