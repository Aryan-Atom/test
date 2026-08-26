import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../i18n.jsx";
import { pocEndPoints } from "../axios/endPoints.js";
import JobPreviewModal from "../components/JobPreviewModal.jsx";

export default function Jobs() {
  const [jobs, setJobs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState(null);
  const [previewJob, setPreviewJob] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();
  const { t } = useI18n();

  useEffect(() => {
    let isMounted = true;
    const fetchJobs = async () => {
      try {
        const apiUrl = pocEndPoints.AI_PIPELINE_GET_JOBS;
        const response = await fetch(apiUrl, {
          headers: { accept: "application/json" },
        });
        if (response.ok) {
          const data = await response.json();
          if (isMounted) {
            setJobs(data?.jobs || (Array.isArray(data) ? data : []));
          }
        }
      } catch (err) {
        console.error("Jobs fetch error:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchJobs();
    const interval = setInterval(fetchJobs, 4000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const filteredJobs = (jobs || []).filter((j) => {
    const matchesStatus =
      statusFilter === "all" ||
      String(j.status || "").toLowerCase() === statusFilter.toLowerCase();
    const matchesSearch =
      !searchQuery.trim() ||
      String(j.id || "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      (Array.isArray(j.files) ? j.files.join(" ") : String(j.files || ""))
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      String(j.createdBy || j.created_by_user || j.uploadedBy || j.created_by || "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      String(j.stage || "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (j) => {
    const statusStr = String(j.status || "").toLowerCase();
    let badgeClass =
      "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700";
    let icon = "fa-circle-notch";

    if (statusStr === "done") {
      badgeClass =
        "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
      icon = "fa-check-circle";
    } else if (statusStr === "failed") {
      badgeClass =
        "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800";
      icon = "fa-times-circle";
    } else if (statusStr === "running") {
      badgeClass =
        "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800";
      icon = "fa-spinner fa-spin";
    }

    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badgeClass}`}
        >
          <i className={`fas ${icon} text-[10px]`} />
          {j.status || "idle"}
        </span>
        {j.columns_uncertain && (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 cursor-help"
            title={
              Array.isArray(j.uncertain_fields)
                ? `Guessed: ${j.uncertain_fields.join(", ")}`
                : "Columns guessed"
            }
          >
            <i className="fas fa-exclamation-triangle text-[10px]" />
            columns guessed
          </span>
        )}
      </div>
    );
  };

  return (
    <section className="flex-1 flex flex-col min-h-0 space-y-6">
      {/* Page Header */}
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between relative z-20">
        <div>
          <h1 className="page-title flex items-center gap-2.5">
            <i className="fas fa-robot text-[#1745c2] text-xl md:text-[22px]" />
            <span>Jobs</span>
          </h1>
          <p className="page-subtitle">
            Runs happen one at a time — a second upload waits its turn.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-72 sm:w-96">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none" />
            <input
              type="text"
              className="input-base text-xs w-full py-1.5"
              style={{ paddingLeft: "2.25rem" }}
              placeholder="Search job ID, files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select
            className="input-base py-1.5 text-xs"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="running">Running</option>
            <option value="done">Done</option>
            <option value="failed">Failed</option>
            <option value="idle">Idle</option>
          </select>
        </div>
      </header>

      {/* Main Table Card */}
      <div className="card flex-1 flex flex-col min-h-0 overflow-hidden">
        {loading && !jobs ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3, 4, 5].map((idx) => (
              <div
                key={idx}
                className="h-10 bg-gray-100 dark:bg-gray-800 rounded animate-pulse"
              />
            ))}
          </div>
        ) : !jobs || jobs.length === 0 ? (
          <div className="p-12 text-center text-text-subtle">
            <i className="fas fa-inbox text-4xl text-gray-300 dark:text-gray-600 mb-3 block" />
            <p className="text-base font-semibold text-text-default mb-1">
              Nothing has been run yet.
            </p>
            <p className="text-xs text-text-subtle mb-4">
              Upload a spreadsheet via AI Pipeline to start a job.
            </p>
            <button
              type="button"
              className="btn-primary inline-flex items-center gap-2 text-xs"
              onClick={() => navigate("/data-management/change-history-data")}
            >
              <i className="fas fa-file-import" />
              <span>Go to Upload Spreadsheet</span>
            </button>
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="p-12 text-center text-text-subtle">
            <i className="fas fa-filter text-3xl text-gray-300 dark:text-gray-600 mb-2 block" />
            <p className="text-sm font-medium">No matching jobs found.</p>
          </div>
        ) : (
          <div className="table-wrapper flex-1 overflow-auto">
            <table className="table-base w-full text-left">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/80 border-b border-border-base text-xs font-semibold uppercase tracking-wider text-text-subtle">
                  <th className="px-4 py-3">Job ID</th>
                  <th className="px-4 py-3">Files</th>
                  <th className="px-4 py-3">Uploaded By</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Started</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-base text-xs">
                {filteredJobs.map((j) => {
                  const fileList = Array.isArray(j.files)
                    ? j.files.join(", ")
                    : j.files || j.fileName || "-";
                  const uploadedBy =
                    j.createdBy || j.created_by_user || j.uploadedBy || j.created_by || "-";
                  const createdAt = j.created_at || j.createdAt || "-";

                  return (
                    <tr
                      key={j.id}
                      className="hover:bg-gray-50/80 dark:hover:bg-gray-800/60 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono font-medium text-teal-600 dark:text-teal-400">
                        {j.id}
                      </td>
                      <td className="px-4 py-3 max-w-[280px] truncate" title={fileList}>
                        {fileList}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-text-default">
                        <div className="inline-flex items-center gap-1.5">
                          <i className="fas fa-user-circle text-gray-400 text-xs" />
                          <span>{uploadedBy}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">{getStatusBadge(j)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-text-subtle font-mono">
                        {createdAt}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="inline-flex items-center justify-center gap-1.5">
                          {/* Eye icon */}
                          <button
                            type="button"
                            className="p-1.5 rounded-lg text-gray-500 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/40 transition-colors"
                            title="View Job Preview & Save"
                            onClick={() => setPreviewJob(j)}
                          >
                            <i className="fas fa-eye text-sm" />
                          </button>

                          {/* Quarantine icon */}
                          <button
                            type="button"
                            className="p-1.5 rounded-lg text-gray-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors"
                            title="Quarantine Job"
                            onClick={() => navigate("/ai-pipeline/quarantine")}
                          >
                            <i className="fas fa-shield-alt text-sm" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Eye Icon Job Detail Modal */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="card w-full max-w-lg overflow-hidden shadow-2xl space-y-4">
            <div className="p-4 border-b border-border-base flex items-center justify-between bg-gray-50 dark:bg-gray-800">
              <h3 className="font-bold text-base flex items-center gap-2">
                <i className="fas fa-eye text-teal-600" />
                <span>Job Details (#{selectedJob.id})</span>
              </h3>
              <button
                type="button"
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                onClick={() => setSelectedJob(null)}
              >
                <i className="fas fa-times" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-3 gap-2 py-1 border-b border-border-base">
                <span className="font-semibold text-text-subtle">Job ID:</span>
                <span className="col-span-2 font-mono font-medium">{selectedJob.id}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 py-1 border-b border-border-base">
                <span className="font-semibold text-text-subtle">Uploaded By:</span>
                <span className="col-span-2 font-medium">
                  {selectedJob.createdBy ||
                    selectedJob.created_by_user ||
                    selectedJob.uploadedBy ||
                    selectedJob.created_by ||
                    "-"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 py-1 border-b border-border-base">
                <span className="font-semibold text-text-subtle">Status:</span>
                <span className="col-span-2">{getStatusBadge(selectedJob)}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 py-1 border-b border-border-base">
                <span className="font-semibold text-text-subtle">Files:</span>
                <span className="col-span-2 break-all">
                  {Array.isArray(selectedJob.files)
                    ? selectedJob.files.join(", ")
                    : selectedJob.files || "-"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 py-1 border-b border-border-base">
                <span className="font-semibold text-text-subtle">Started At:</span>
                <span className="col-span-2 font-mono">
                  {selectedJob.created_at || selectedJob.createdAt || "-"}
                </span>
              </div>
              {selectedJob.columns_uncertain && (
                <div className="grid grid-cols-3 gap-2 py-1 border-b border-border-base">
                  <span className="font-semibold text-text-subtle">Uncertain Fields:</span>
                  <span className="col-span-2 text-amber-600 dark:text-amber-400">
                    {Array.isArray(selectedJob.uncertain_fields)
                      ? selectedJob.uncertain_fields.join(", ")
                      : "Yes"}
                  </span>
                </div>
              )}
              {selectedJob.error && (
                <div className="grid grid-cols-3 gap-2 py-1 border-b border-border-base text-red-600">
                  <span className="font-semibold">Error:</span>
                  <span className="col-span-2">{selectedJob.error}</span>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-border-base flex justify-end gap-2 bg-gray-50 dark:bg-gray-800">
              <button
                type="button"
                className="btn-secondary text-xs px-4"
                onClick={() => setSelectedJob(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewJob && (
        <JobPreviewModal job={previewJob} onClose={() => setPreviewJob(null)} />
      )}
    </section>
  );
}
