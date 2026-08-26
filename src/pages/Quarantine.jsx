import { useEffect, useState } from "react";
import { pocEndPoints } from "../axios/endPoints.js";
import { useI18n } from "../i18n.jsx";

export default function Quarantine() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { t } = useI18n();

  const fetchQuarantineData = async () => {
    try {
      setLoading(true);
      setError(null);
      const baseUrl =
        pocEndPoints.AI_PIPELINE_GET_QUARANTINE ||
        "http://107.108.32.188:8001/api/quarantine?include_released=false&limit=200&offset=0";

      const response = await fetch(baseUrl, {
        headers: { accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch quarantine items (status: ${response.status})`);
      }

      const data = await response.json();
      const rawList = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.rows)
        ? data.rows
        : Array.isArray(data?.quarantines)
        ? data.quarantines
        : Array.isArray(data?.data)
        ? data.data
        : [];

      setItems(rawList);
    } catch (err) {
      console.error("Quarantine fetch error:", err);
      setError(err.message || "Failed to load quarantine details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuarantineData();
  }, []);

  const filteredItems = items.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const str = JSON.stringify(item).toLowerCase();
    return str.includes(q);
  });

  return (
    <section className="flex-1 flex flex-col min-h-0 space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between relative z-20">
        <div>
          <h1 className="page-title flex items-center gap-2.5">
            <i className="fas fa-shield-alt text-amber-600 text-xl md:text-[22px]" />
            <span>Quarantine</span>
          </h1>
          <p className="page-subtitle">
            Inspect quarantined rows or files flagged by the AI pipeline during ingestion.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-72 sm:w-96">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none" />
            <input
              type="text"
              className="input-base text-xs w-full py-1.5"
              style={{ paddingLeft: "2.25rem" }}
              placeholder="Search quarantine ID, file, reason..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <button
            type="button"
            onClick={fetchQuarantineData}
            className="btn-base btn-secondary flex items-center gap-1.5 text-xs py-1.5 px-3"
            title="Refresh Quarantine Data"
          >
            <i className={`fas fa-sync-alt text-xs ${loading ? "fa-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </header>

      {/* Main Table Card */}
      <div className="card flex-1 flex flex-col min-h-0 p-0 overflow-hidden shadow-xs border border-border-base bg-surface-default">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-text-subtle">
            <i className="fas fa-spinner fa-spin text-3xl text-amber-600 mb-3" />
            <p className="text-sm font-medium">Loading quarantine data...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-red-600">
            <i className="fas fa-exclamation-triangle text-3xl mb-3" />
            <p className="text-sm font-medium">{error}</p>
            <button
              type="button"
              onClick={fetchQuarantineData}
              className="mt-4 btn-base btn-secondary text-xs px-4 py-1.5"
            >
              Retry
            </button>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-text-subtle">
            <i className="fas fa-shield-alt text-5xl opacity-30 mb-3 text-amber-500" />
            <h3 className="text-base font-semibold text-text-default mb-1">No Quarantine Data Found</h3>
            <p className="text-xs text-text-subtle">
              There are no quarantined entries matching your criteria.
            </p>
          </div>
        ) : (
          <div className="overflow-auto max-h-[calc(88vh-160px)]">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-gray-50 dark:bg-gray-800/80 sticky top-0 z-10 border-b border-border-base">
                <tr className="font-semibold text-text-subtle whitespace-nowrap">
                  <th className="px-4 py-3 w-12 text-center">#</th>
                  <th className="px-4 py-3 min-w-[100px]">ID / Job ID</th>
                  <th className="px-4 py-3 min-w-[200px]">File / Item</th>
                  <th className="px-4 py-3 min-w-[250px]">Reason / Issue</th>
                  <th className="px-4 py-3 min-w-[180px]">Quarantined At</th>
                  <th className="px-4 py-3 min-w-[120px] text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-base">
                {filteredItems.map((item, idx) => {
                  const itemId = item.id || item.quarantine_id || item.job_id || idx + 1;
                  const fileName =
                    item.file_name ||
                    item.file ||
                    item.filename ||
                    (Array.isArray(item.files) ? item.files.join(", ") : "-");
                  const reason =
                    item.reason || item.error || item.cause || item.issue || item.message || "Quarantined by AI Pipeline";
                  const createdAt = item.created_at || item.timestamp || item.quarantined_at || "-";
                  const isReleased = Boolean(item.is_released || item.released);

                  return (
                    <tr
                      key={idx}
                      className="hover:bg-gray-50/80 dark:hover:bg-gray-800/60 transition-colors"
                    >
                      <td className="px-4 py-3 text-center text-text-subtle font-mono">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-text-default">
                        #{itemId}
                      </td>
                      <td className="px-4 py-3 font-medium text-text-default max-w-[260px] truncate" title={String(fileName)}>
                        <i className="fas fa-file-excel text-emerald-600 mr-2" />
                        {String(fileName)}
                      </td>
                      <td className="px-4 py-3 text-amber-700 dark:text-amber-400 font-medium max-w-[320px] truncate" title={String(reason)}>
                        {String(reason)}
                      </td>
                      <td className="px-4 py-3 font-mono text-text-subtle">
                        {String(createdAt)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                            isReleased
                              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200"
                              : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200"
                          }`}
                        >
                          <i className={`fas ${isReleased ? "fa-check-circle" : "fa-shield-alt"} text-[10px]`} />
                          {isReleased ? "Released" : "Quarantined"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
