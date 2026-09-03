import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../i18n.jsx";

const WHY = {
  empty: "The report cell was blank, or held nothing but codes and dates.",
  literal_noise: "The text matched a placeholder phrase (N/A, 없음, 확인중, TBD…).",
  numeric_only: "The text was only digits.",
  non_content: "The text was only punctuation or symbols.",
  too_short: "Fewer than the minimum characters once codes and dates were removed.",
  duplicate_row: "Duplicate row with matching content found in this process.",
  missing_mandatory_field: "Missing mandatory fields in the uploaded file.",
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

export default function JobQuarantineModal({ job, onClose }) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [byReason, setByReason] = useState({});
  const [byFile, setByFile] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReason, setSelectedReason] = useState("");

  const itemsRef = useRef([]);
  const isFetchingRef = useRef(false);
  const tableContainerRef = useRef(null);
  const { t } = useI18n();

  const aiServer = (
    import.meta.env.VITE_APP_AI_POC_PIPELINE_SERVER || "http://107.108.32.188:8001"
  ).replace(/\/+$/, "");

  const fetchQuarantineData = useCallback(async (isInitial = true) => {
    if (!job?.id) return;
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    if (isInitial) {
      setLoading(true);
      setError(null);
    } else {
      setLoadingMore(true);
    }

    try {
      const currentOffset = isInitial ? 0 : itemsRef.current.length;
      const params = new URLSearchParams({
        include_released: "false",
        limit: "50",
        offset: String(currentOffset),
      });

      const apiUrl = `${aiServer}/api/jobs/${job.id}/quarantine?${params.toString()}`;
      const response = await fetch(apiUrl, {
        headers: { accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(`Failed to load quarantine items (${response.status})`);
      }

      const data = await response.json();
      const rawItems = Array.isArray(data?.items) ? data.items : [];
      const totalCount = data?.total ?? rawItems.length;

      setTotal(totalCount);
      if (data?.by_reason) setByReason(data.by_reason);
      if (data?.by_file) setByFile(data.by_file);

      if (isInitial) {
        setItems(rawItems);
        itemsRef.current = rawItems;
        setHasMore(rawItems.length === 50 && rawItems.length < totalCount);
      } else {
        setItems((prev) => {
          const existingIds = new Set(prev.map((i) => i.id));
          const uniqueNew = rawItems.filter((i) => !existingIds.has(i.id));
          const updated = [...prev, ...uniqueNew];
          itemsRef.current = updated;
          setHasMore(rawItems.length === 50 && updated.length < totalCount);
          return updated;
        });
      }
    } catch (err) {
      console.error("Job quarantine fetch error:", err);
      setError(err.message || "Failed to load quarantined items");
    } finally {
      if (isInitial) setLoading(false);
      setLoadingMore(false);
      setTimeout(() => {
        isFetchingRef.current = false;
      }, 200);
    }
  }, [job?.id, aiServer]);

  useEffect(() => {
    fetchQuarantineData(true);
  }, [fetchQuarantineData]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Infinite scroll handler
  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 80) {
      if (hasMore && !loadingMore && !isFetchingRef.current) {
        fetchQuarantineData(false);
      }
    }
  };

  // Filter items based on reason and search query
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (selectedReason && String(item.reason || "").toLowerCase() !== selectedReason.toLowerCase()) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const str = JSON.stringify(item).toLowerCase();
      return str.includes(q);
    });
  }, [items, selectedReason, searchQuery]);

  // Combined reason counts for dropdown
  const reasonOptions = useMemo(() => {
    const counts = { ...byReason };
    items.forEach((item) => {
      const r = item.reason || "unknown";
      if (!(r in counts)) {
        counts[r] = items.filter((i) => (i.reason || "unknown") === r).length;
      }
    });
    return counts;
  }, [byReason, items]);

  const sourceFiles = useMemo(() => {
    const fileSet = new Set();
    if (Array.isArray(job?.files)) {
      job.files.forEach((f) => f && fileSet.add(String(f)));
    } else if (job?.files) {
      fileSet.add(String(job.files));
    }
    if (byFile && typeof byFile === "object") {
      Object.keys(byFile).forEach((f) => f && fileSet.add(String(f)));
    }
    items.forEach((i) => {
      if (i.source_file) fileSet.add(String(i.source_file));
    });
    return Array.from(fileSet);
  }, [job?.files, byFile, items]);

  const getReasonBadgeClass = (reason) => {
    const r = String(reason || "").toLowerCase();
    if (r === "duplicate_row") {
      return "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/80";
    }
    if (r === "missing_mandatory_field") {
      return "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/80";
    }
    if (r === "empty") {
      return "bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800/80";
    }
    return "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700";
  };

  return createPortal(
    <div className="modal-overlay fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen z-[10000] flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="card w-full max-w-[1360px] w-[95vw] max-h-[90vh] flex flex-col min-h-0 p-0 overflow-hidden shadow-2xl border border-border-base bg-surface-default z-[10001]">
        {/* Modal Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 border-b border-border-base bg-gray-50/70 dark:bg-gray-800/60 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/80 shrink-0">
              <i className="fas fa-shield-alt text-base" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-text-default whitespace-nowrap">
                  Quarantine Items
                </h2>
                <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700 whitespace-nowrap">
                  Job #{job.id}
                </span>
                {sourceFiles.map((f, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80 max-w-xs truncate"
                    title={f}
                  >
                    <i className="fas fa-file-excel text-emerald-600 dark:text-emerald-400 text-xs shrink-0" />
                    <span className="truncate">{f}</span>
                  </span>
                ))}
              </div>
              <p className="text-xs text-text-subtle mt-0.5">
                Rows flagged during processing that were kept for review without being exported.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Total Count Badge */}
            <span className="text-xs font-medium px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-text-subtle border border-border-base whitespace-nowrap">
              Total: <strong className="text-text-default">{total}</strong> records
            </span>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200/60 dark:hover:bg-gray-700 transition-colors cursor-pointer"
              title="Close (Esc)"
              aria-label="Close"
            >
              <i className="fas fa-times text-sm" />
            </button>
          </div>
        </div>

        {/* Toolbar: Search, Reason Filter, Refresh in single horizontal row */}
        <div className="flex items-center justify-between gap-3 px-6 py-3 border-b border-border-base bg-white dark:bg-gray-900 shrink-0">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            {/* Search Input */}
            <div className="relative flex-1 max-w-sm sm:max-w-md min-w-[180px]">
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none" />
              <input
                type="text"
                className="input-base text-xs w-full py-1.5"
                style={{ paddingLeft: "2.25rem" }}
                placeholder="Search W/O code, process, equipment, text..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Reason Filter Dropdown */}
            <select
              className="input-base py-1.5 text-xs w-48 sm:w-56 shrink-0"
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value)}
            >
              <option value="">All reasons</option>
              {Object.entries(reasonOptions).map(([rKey, count]) => (
                <option key={rKey} value={rKey}>
                  {rKey} ({count})
                </option>
              ))}
            </select>
          </div>

          <div className="text-xs text-text-subtle font-mono whitespace-nowrap hidden md:block">
            {filteredItems.length} records
          </div>
        </div>

        {/* Notices */}
        {error && (
          <div className="mx-6 my-3 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2 shrink-0">
            <i className="fas fa-exclamation-circle text-sm" />
            <span>{error}</span>
          </div>
        )}

        {/* Table Container */}
        <div
          ref={tableContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-auto min-h-0 bg-white dark:bg-gray-900"
        >
          {loading && items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-text-subtle">
              <i className="fas fa-spinner fa-spin text-3xl text-amber-600 mb-3" />
              <p className="text-sm font-medium">Loading quarantine items for Job #{job.id}...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-text-subtle">
              <i className="fas fa-shield-alt text-5xl opacity-30 mb-3 text-amber-500" />
              <h3 className="text-base font-semibold text-text-default mb-1">
                No Quarantine Records Found
              </h3>
              <p className="text-xs text-text-subtle max-w-sm text-center">
                {items.length === 0
                  ? "This job has no quarantined records."
                  : "No quarantined items match your current search and filter criteria."}
              </p>
            </div>
          ) : (
            <table className="quarantine-subtable w-full text-xs text-left border-collapse table-fixed">
              <colgroup>
                <col style={{ width: "55px" }} />
                <col style={{ width: "75px" }} />
                <col style={{ width: "140px" }} />
                <col style={{ width: "240px" }} />
                <col style={{ width: "auto" }} />
                <col style={{ width: "240px" }} />
              </colgroup>
              <thead className="bg-gray-100/90 dark:bg-gray-800 border-b border-border-base text-[11px] font-semibold text-text-subtle uppercase tracking-wider sticky top-0 z-20 shadow-2xs">
                <tr>
                  <th className="px-3 py-3 text-center">S.No</th>
                  <th className="px-3 py-3 text-center">Row</th>
                  <th className="px-3.5 py-3">W/O Code</th>
                  <th className="px-3.5 py-3">Process · Equipment</th>
                  <th className="px-3.5 py-3">What the cell held</th>
                  <th className="px-3.5 py-3">Why</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-base text-xs bg-white dark:bg-gray-900">
                {filteredItems.map((r, idx) => {
                  const isReleased = Boolean(r.released_report_id || r.released_at);

                  return (
                    <tr
                      key={r.id}
                      className={`transition-colors ${
                        isReleased
                          ? "opacity-60 bg-gray-50/30"
                          : "hover:bg-blue-50/90 dark:hover:bg-blue-950/40"
                      }`}
                    >
                      {/* S.No */}
                      <td className="px-3 py-2.5 font-mono text-center text-text-subtle font-medium">
                        {idx + 1}
                      </td>

                      {/* Row */}
                      <td className="px-3 py-2.5 font-mono text-center text-text-subtle font-medium">
                        <HighlightText
                          text={`row ${r.source_row ?? "-"}`}
                          query={searchQuery}
                        />
                      </td>

                      {/* W/O Code */}
                      <td className="px-3.5 py-2.5 font-mono font-medium text-text-default">
                        <HighlightText text={r.wo_code || "—"} query={searchQuery} />
                      </td>

                      {/* Process · Equipment */}
                      <td className="px-3.5 py-2.5 text-xs">
                        <div className="font-medium text-text-default">
                          <HighlightText text={r.process || "—"} query={searchQuery} />
                        </div>
                        <div
                          className="text-[11px] text-text-subtle truncate max-w-[220px]"
                          title={`${
                            r.equipment_name ||
                            r.equipmentName ||
                            r.eqname ||
                            r.equipment ||
                            ""
                          }${
                            r.equipment_code || r.equipmentCode || r.eqcode
                              ? ` (${r.equipment_code || r.equipmentCode || r.eqcode})`
                              : ""
                          }`}
                        >
                          <HighlightText
                            text={`${
                              r.equipment_name ||
                              r.equipmentName ||
                              r.eqname ||
                              r.equipment ||
                              ""
                            }${
                              r.equipment_code || r.equipmentCode || r.eqcode
                                ? ` (${r.equipment_code || r.equipmentCode || r.eqcode})`
                                : ""
                            }`}
                            query={searchQuery}
                          />
                        </div>
                      </td>

                      {/* What the cell held */}
                      <td className="px-3.5 py-2.5 text-xs">
                        {r.raw_content ? (
                          <div
                            className="font-mono text-xs text-text-default max-w-[420px] line-clamp-2"
                            title={r.raw_content}
                          >
                            <HighlightText text={r.raw_content} query={searchQuery} />
                          </div>
                        ) : (
                          <span className="text-gray-400 italic text-xs">(blank)</span>
                        )}
                      </td>

                      {/* Why */}
                      <td className="px-3.5 py-2.5">
                        <div className="flex flex-col gap-1">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border shadow-2xs w-fit ${getReasonBadgeClass(
                              r.reason,
                            )}`}
                          >
                            <span>{r.reason || "unknown"}</span>
                          </span>
                          <span className="text-[11px] text-text-subtle leading-tight line-clamp-2">
                            {WHY[r.reason] || r.reason || "Quarantined record"}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* Loading More Indicator */}
          {loadingMore && (
            <div className="py-3 text-center text-xs text-amber-600 dark:text-amber-400 bg-gray-50/80 dark:bg-gray-800/80 border-t border-border-base flex items-center justify-center gap-2">
              <i className="fas fa-spinner fa-spin text-sm" />
              <span>Loading next 50 records...</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-border-base bg-gray-50/70 dark:bg-gray-800/60 flex items-center justify-between shrink-0">
          <div className="text-xs text-text-subtle font-mono">
            Showing {filteredItems.length} of {total} records
            {items.length < total && !loading && (
              <span className="ml-2 text-amber-600 dark:text-amber-400">
                (Scroll down to load more)
              </span>
            )}
          </div>
          <button
            type="button"
            className="btn-base btn-secondary text-xs px-4 py-1.5"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
