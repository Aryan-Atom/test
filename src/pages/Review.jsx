import { useEffect, useState, useMemo, useCallback } from "react";
import { pocEndPoints } from "../axios/endPoints.js";
import { APIcallGet, APIcallPost } from "../axios/apiCall.js";
import { useI18n } from "../i18n.jsx";
import Modal from "../components/Modal.jsx";
import {
  mapExportedRowToChangeData,
  formatValidDateIso,
} from "../components/JobPreviewModal.jsx";

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

function resynthesisNote(r, t) {
  if (!r) return null;
  if (r.status === "ok" || r.rep_name) {
    const raw = t ? t("review.newSynthesisGenerated", `New synthesis generated: "${r.rep_name}".`) : `New synthesis generated: "${r.rep_name}".`;
    return { text: raw.replace("{repName}", r.rep_name), bad: false };
  }
  if (r.status === "failed") {
    const errMsg = r.error || "unknown error";
    const raw = t ? t("review.resynthesisFailed", `Resynthesis failed: ${errMsg}.`) : `Resynthesis failed: ${errMsg}.`;
    return { text: raw.replace("{error}", errMsg), bad: true };
  }
  return null;
}

export default function Review() {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [items, setItems] = useState([]);
  const [itemsError, setItemsError] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [busyMessage, setBusyMessage] = useState("");
  const [countdown, setCountdown] = useState(null); // 60s countdown timer
  const [note, setNote] = useState(null); // { text, bad }
  const [selectedReportId, setSelectedReportId] = useState(null); // focused / selected row
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProcess, setSelectedProcess] = useState("all");
  // Set of wo_codes that exist in change_data_history (from GetAllWoCodes API).
  // null = not loaded yet -> filtering is skipped (fail-open).
  const [validWoCodes, setValidWoCodes] = useState(null);

  // Keep Confirmation Modal State
  const [keepConfirmReport, setKeepConfirmReport] = useState(null);

  // Move Modal State
  const [moveModalReport, setMoveModalReport] = useState(null);
  const [selectedTargetId, setSelectedTargetId] = useState(null);
  const [targetSearchQuery, setTargetSearchQuery] = useState("");
  const [moveConfirmState, setMoveConfirmState] = useState(null); // { report, targetId, targetName }

  const aiServer = (
    import.meta.env.VITE_APP_AI_POC_PIPELINE_SERVER || "http://107.99.131.150:8002"
  ).replace(/\/+$/, "");

  // API wrappers
  const api = useMemo(
    () => ({
      review: async () => {
        const url = pocEndPoints.AI_PIPELINE_GET_REVIEW || `${aiServer}/api/review`;
        const res = await fetch(url, { headers: { accept: "application/json" } });
        if (!res.ok) throw new Error(`Failed to load review queue (status: ${res.status})`);
        return await res.json();
      },
      workItems: async (params = {}) => {
        const query = new URLSearchParams({
          limit: String(params.limit || 1000),
          sort: params.sort || "members",
          include_archived: String(params.includeArchived ?? true),
        });
        const baseUrl =
          pocEndPoints.AI_PIPELINE_GET_WORK_ITEMS || `${aiServer}/api/work-items`;
        const url = `${baseUrl}?${query.toString()}`;
        const res = await fetch(url, { headers: { accept: "application/json" } });
        if (!res.ok) throw new Error(`Failed to load work items (status: ${res.status})`);
        return await res.json();
      },
      keepReport: async (reportId) => {
        // Primary route: /api/review/reports/{id}/keep
        let res = await fetch(`${aiServer}/api/review/reports/${reportId}/keep`, {
          method: "POST",
          headers: { "Content-Type": "application/json", accept: "application/json" },
        }).catch(() => null);

        if (!res || (!res.ok && (res.status === 404 || res.status === 405))) {
          res = await fetch(`${aiServer}/api/reports/${reportId}/keep`, {
            method: "POST",
            headers: { "Content-Type": "application/json", accept: "application/json" },
          }).catch(() => null);
        }

        if (!res || (!res.ok && res.status === 404)) {
          res = await fetch(`${aiServer}/api/review/keep`, {
            method: "POST",
            headers: { "Content-Type": "application/json", accept: "application/json" },
            body: JSON.stringify({ report_id: reportId }),
          });
        }

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(
            errData.detail || errData.message || `Failed to keep report (status: ${res.status})`,
          );
        }
        return await res.json().catch(() => ({}));
      },
      moveReport: async (reportId, targetId) => {
        const payload = {
          to: Number(targetId) || targetId,
          target_id: Number(targetId) || targetId,
          destination_id: Number(targetId) || targetId,
        };

        // Primary route: /api/review/reports/{id}/move
        let res = await fetch(`${aiServer}/api/review/reports/${reportId}/move`, {
          method: "POST",
          headers: { "Content-Type": "application/json", accept: "application/json" },
          body: JSON.stringify(payload),
        }).catch(() => null);

        if (!res || (!res.ok && (res.status === 404 || res.status === 405))) {
          res = await fetch(`${aiServer}/api/reports/${reportId}/move`, {
            method: "POST",
            headers: { "Content-Type": "application/json", accept: "application/json" },
            body: JSON.stringify(payload),
          }).catch(() => null);
        }

        if (!res || (!res.ok && res.status === 404)) {
          res = await fetch(`${aiServer}/api/review/move`, {
            method: "POST",
            headers: { "Content-Type": "application/json", accept: "application/json" },
            body: JSON.stringify({ report_id: reportId, ...payload }),
          });
        }

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(
            errData.detail || errData.message || `Failed to move report (status: ${res.status})`,
          );
        }
        return await res.json().catch(() => ({}));
      },
    }),
    [aiServer],
  );

  const fetchValidWoCodes = useCallback(() => {
    APIcallGet(
      pocEndPoints.GET_ALL_WO_CODES,
      {},
      (responseData, status) => {
        if (status === 200 && responseData) {
          const list =
            responseData?.data ??
            responseData?.result ??
            responseData?.items ??
            responseData?.woCodes ??
            responseData?.wOCodes ??
            responseData;

          if (Array.isArray(list)) {
            const codeSet = new Set();
            list.forEach((item) => {
              if (item == null) return;
              let code = "";
              if (typeof item === "string" || typeof item === "number") {
                code = String(item).trim();
              } else if (typeof item === "object") {
                code = String(
                  item.woCode ??
                    item.wo_code ??
                    item.WoCode ??
                    item.wOCode ??
                    item.WO_CODE ??
                    item.code ??
                    item.value ??
                    "",
                ).trim();
              }
              if (code) {
                codeSet.add(code);
                codeSet.add(code.toLowerCase());
              }
            });
            setValidWoCodes(codeSet);
          } else {
            setValidWoCodes(null); // unexpected shape -> fail-open
          }
        } else {
          console.warn("GetAllWoCodes failed:", status, responseData);
          setValidWoCodes(null); // fail-open on API error
        }
      },
    );
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      fetchValidWoCodes();
      const res = await api.review();
      setData(res);
    } catch (e) {
      console.error("Review fetch error:", e);
      setError(e.message || "Failed to load review data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    api
      .workItems({ limit: 1000, sort: "members", includeArchived: true })
      .then((r) => {
        setItems(r.items || (Array.isArray(r) ? r : []));
        setItemsError(null);
      })
      .catch((e) => {
        console.error("Work items fetch error:", e);
        setItemsError(e.message || "Failed to load destination work items");
      });
  }, [api, fetchValidWoCodes]);

  // Filter legal target work items within same partition / process
  function targetsFor(report) {
    if (!report) return [];
    const repKey = report.partition_key || report.process;
    return items.filter(
      (w) =>
        w.id !== report.rep_work_id &&
        (!repKey || !w.partition_key || w.partition_key === repKey),
    );
  }

  // Act helper with notifications and blocking overlay message
  async function act(fn, describe, loadingMsg = "Processing...") {
    setError(null);
    setBusy(true);
    setBusyMessage(loadingMsg);
    try {
      const r = await fn();
      if (describe) setNote(describe(r));
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      setBusyMessage("");
    }
  }

  const destName = (to) => {
    const tItem = items.find((x) => x.id === to || String(x.id) === String(to));
    return tItem?.rep_name || `Work Item #${to}`;
  };

  // Borderline matches list filtered by process and search query
  const rawRows = data?.borderline || [];

  const processOptions = useMemo(() => {
    const set = new Set();
    rawRows.forEach((r) => {
      if (validWoCodes) {
        const wo = (r.wo_code || "").toString().trim();
        if (!wo || (!validWoCodes.has(wo) && !validWoCodes.has(wo.toLowerCase()))) {
          return;
        }
      }
      if (r.process) set.add(r.process);
      if (r.partition_key) set.add(r.partition_key);
    });
    return Array.from(set).sort();
  }, [rawRows, validWoCodes]);

  const filteredRows = useMemo(() => {
    return rawRows.filter((r) => {
      // Only show rows whose wo_code exists in change_data_history.
      // Rows without a wo_code are hidden; skip filtering until the list is loaded (fail-open).
      if (validWoCodes) {
        const wo = (r.wo_code || "").toString().trim();
        if (!wo || (!validWoCodes.has(wo) && !validWoCodes.has(wo.toLowerCase()))) {
          return false;
        }
      }
      if (
        selectedProcess !== "all" &&
        r.process !== selectedProcess &&
        r.partition_key !== selectedProcess
      ) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        (r.normalized_content || "").toLowerCase().includes(q) ||
        (r.wo_code || "").toLowerCase().includes(q) ||
        (r.rep_name || "").toLowerCase().includes(q) ||
        (r.equipment || "").toLowerCase().includes(q) ||
        (r.equipment_name || "").toLowerCase().includes(q) ||
        (r.equipment_code || "").toLowerCase().includes(q) ||
        (r.maintenance_part || "").toLowerCase().includes(q) ||
        String(r.rep_work_id || "").includes(q)
      );
    });
  }, [rawRows, selectedProcess, searchQuery, validWoCodes]);

  // Handler for Confirming Keep Action
  const handleConfirmKeep = () => {
    if (!keepConfirmReport) return;
    const rep = keepConfirmReport;
    setKeepConfirmReport(null);
    act(
      () => api.keepReport(rep.report_id),
      () => ({
        text: `Report ${rep.wo_code || `#${rep.report_id}`} successfully kept in "${rep.rep_name || `#${rep.rep_work_id}`}".`,
        bad: false,
      }),
      `Keeping report ${rep.wo_code || `#${rep.report_id}`} in "${rep.rep_name || `#${rep.rep_work_id}`}"...`,
    );
  };

  // Handler for opening move modal
  const handleOpenMoveModal = (report) => {
    setMoveModalReport(report);
    setSelectedTargetId(null);
    setTargetSearchQuery("");
  };

  // Handler for Proceeding to Confirm Move
  const handleProceedMoveConfirm = () => {
    if (!moveModalReport || !selectedTargetId) return;
    const tName = destName(selectedTargetId);
    setMoveConfirmState({
      report: moveModalReport,
      targetId: selectedTargetId,
      targetName: tName,
    });
    setMoveModalReport(null);
  };

  // Handler for Confirming Move Action
  const handleConfirmMove = async () => {
    if (!moveConfirmState) return;
    const { report, targetId, targetName } = moveConfirmState;
    setMoveConfirmState(null);
    setError(null);
    setBusy(true);
    setCountdown(null);
    setBusyMessage(
      t(
        "review.movingMsg",
        `Moving report ${report.wo_code || `#${report.report_id}`} to ${targetName}...`,
      ),
    );

    let moveResp = null;
    try {
      // Step 1: Execute Move API
      moveResp = await api.moveReport(report.report_id, targetId);
    } catch (moveErr) {
      console.error("Move error:", moveErr);
      setError(moveErr.message || t("review.moveFailed", "Failed to move report"));
      setBusy(false);
      setBusyMessage("");
      return; // Do NOT call any cursor or sync API if move failed!
    }

    const outcome = resynthesisNote(moveResp?.resynthesis?.[targetId], t);
    const archived = moveResp?.archived_source
      ? t("review.archivedNotice", " This work item had no reports left and was archived.")
      : "";

    // Step 2: On successful move, execute cursor and changes sync pipeline
    try {
      setBusyMessage(t("review.gettingCursor", "Fetching cursor..."));

      // Step 2a: New AI_POC_API call -> getCursor() from api/ChangeData/GetCursor
      const cursorResponse = await new Promise((resolve) => {
        APIcallGet(pocEndPoints.GET_CURSOR, {}, (data, status) => {
          resolve({ data, status });
        });
      });

      let cursorData = null;
      if (cursorResponse.status === 200 || cursorResponse.status === 201) {
        const raw = cursorResponse.data;
        if (typeof raw === "string") {
          cursorData = raw.trim() || null;
        } else if (raw && typeof raw === "object") {
          cursorData = raw.cursor ?? raw.data ?? raw.value ?? null;
          if (typeof cursorData === "string") {
            cursorData = cursorData.trim() || null;
          }
        }
      }

      // Step 2b: FAST API exports/changes (if data is null don't pass since, else pass since)
      const baseChangesUrl =
        pocEndPoints.AI_PIPELINE_GET_CHANGES ||
        `${aiServer}/api/exports/changes`;
      const changesUrl = new URL(baseChangesUrl);

      if (cursorData && cursorData !== "null" && cursorData !== "undefined") {
        changesUrl.searchParams.set("since", cursorData);
      }
      changesUrl.searchParams.set("limit", "500");
      changesUrl.searchParams.set("offset", "0");

      // 60-second timeout with UI block and countdown timer (60 -> 0)
      let remaining = 60;
      setCountdown(remaining);
      setBusyMessage(
        t(
          "review.syncingChangesWithTimer",
          `Syncing pipeline changes... (${remaining}s)`,
        ),
      );

      const abortController = new AbortController();
      const timerInterval = setInterval(() => {
        remaining -= 1;
        if (remaining >= 0) {
          setCountdown(remaining);
          setBusyMessage(
            t(
              "review.syncingChangesWithTimer",
              `Syncing pipeline changes... (${remaining}s)`,
            ),
          );
        }
      }, 1000);

      const timeoutId = setTimeout(() => {
        abortController.abort();
      }, 60000);

      let fastApiRes;
      try {
        fastApiRes = await fetch(changesUrl.toString(), {
          method: "GET",
          headers: {
            accept: "application/json",
          },
          signal: abortController.signal,
        });
      } catch (fetchErr) {
        if (fetchErr.name === "AbortError" || abortController.signal.aborted) {
          throw new Error(
            t(
              "review.timeoutError",
              "Request timed out: No response from server after 60 seconds.",
            ),
          );
        }
        throw fetchErr;
      } finally {
        clearInterval(timerInterval);
        clearTimeout(timeoutId);
        setCountdown(null);
      }

      if (fastApiRes.ok) {
        const fastApiData = await fastApiRes.json();

        // Step 2c: Extract rows from FastAPI response. If response rows is null or empty, don't call SaveReviewedChangedData
        const rawRows = fastApiData?.rows;
        if (rawRows && Array.isArray(rawRows) && rawRows.length > 0) {
          setBusyMessage(
            t("review.savingReviewedData", "Saving reviewed changed data..."),
          );
          const changeDataList = rawRows.map((r) =>
            mapExportedRowToChangeData(r),
          );

          const reviewedPayload = {
            changeDataList: changeDataList.map((r) => {
              const rawDate = r.workDate || r.workedOn || r.work_date || "";
              const isoDate = formatValidDateIso(rawDate);
              return {
                ...r,
                workDate: isoDate,
                workedOn: r.workedOn || r.workDate || isoDate.slice(0, 10),
              };
            }),
            id: 0,
          };

          // Send to api/ChangeData/SaveReviewedChangedData
          const reviewedResponse = await new Promise((resolve) => {
            APIcallPost(
              pocEndPoints.SAVE_REVIEWED_CHANGED_DATA,
              reviewedPayload,
              {},
              (reviewedRes, status) => {
                resolve({ reviewedRes, status });
              },
            );
          });

          const isReviewedSuccess =
            (reviewedResponse.status === 200 || reviewedResponse.status === 201) &&
            reviewedResponse.reviewedRes?.statusCode !== 400 &&
            (reviewedResponse.reviewedRes?.statusCode == null ||
              reviewedResponse.reviewedRes?.statusCode === 200 ||
              reviewedResponse.reviewedRes?.statusCode === 201);

          // Step 2d: If the response from SaveReviewedChangedData is 200 then only call Save Cursor else don't call
          if (isReviewedSuccess) {
            setBusyMessage(t("review.savingCursor", "Saving cursor..."));
            const newCursor =
              fastApiData?.cursor ??
              fastApiData?.next_cursor ??
              fastApiData?.nextCursor ??
              fastApiData?.cursor_id ??
              cursorData ??
              "";

            const cursorPayload = {
              cursor: String(newCursor || ""),
            };

            await new Promise((resolve) => {
              APIcallPost(
                pocEndPoints.SAVE_CURSOR,
                cursorPayload,
                {},
                (saveCursorRes, status) => {
                  resolve({ saveCursorRes, status });
                },
              );
            });
          } else {
            console.warn(
              "SaveReviewedChangedData did not return 200 (status: " +
                reviewedResponse.status +
                ", code: " +
                reviewedResponse.reviewedRes?.statusCode +
                "). SaveCursor was not called.",
              reviewedResponse.reviewedRes,
            );
          }
        } else {
          console.log(
            "No rows to review (rows is null or empty). Skipping SaveReviewedChangedData.",
            fastApiData,
          );
        }
      } else {
        console.error(
          "FastAPI changes export error:",
          fastApiRes.status,
          fastApiRes.statusText,
        );
      }

      const successTemplate = t(
        "review.moveSuccessNotice",
        "Moved report {woCode} to {targetName}.{archived}{outcome} Changes synchronized successfully.",
      );
      setNote({
        text: successTemplate
          .replace("{woCode}", report.wo_code || `#${report.report_id}`)
          .replace("{targetName}", targetName)
          .replace("{archived}", archived)
          .replace("{outcome}", outcome ? " " + outcome.text : ""),
        bad: outcome?.bad ?? false,
      });
      window.dispatchEvent(new Event("refreshChangeHistoryData"));
    } catch (syncErr) {
      console.error("Sync error after move:", syncErr);
      const failTemplate = t(
        "review.moveSyncFailed",
        `Moved report to ${targetName}, but sync failed: ${syncErr.message || "Unknown sync error"}`,
      );
      setError(
        failTemplate
          .replace("{targetName}", targetName)
          .replace("{error}", syncErr.message || "Unknown sync error"),
      );
    } finally {
      setBusy(false);
      setBusyMessage("");
      setCountdown(null);
      await load();
    }
  };

  const counts = data?.counts || {};
  const chk = data?.checked || { matched_reports: data?.matched_reports ?? 0 };
  const isSearchOrFilterActive = Boolean(
    searchQuery.trim() || selectedProcess !== "all",
  );
  // There is nothing for review if rawRows is empty, counts.borderline is 0,
  // or filteredRows is empty when no search/process filter is applied.
  const nothing =
    !isSearchOrFilterActive &&
    (rawRows.length === 0 ||
      counts.borderline === 0 ||
      filteredRows.length === 0);

  // Targets for Move Modal
  const modalTargets = useMemo(() => {
    if (!moveModalReport) return [];
    const allT = targetsFor(moveModalReport);
    if (!targetSearchQuery.trim()) return allT;
    const q = targetSearchQuery.toLowerCase();
    return allT.filter(
      (t) =>
        (t.rep_name || "").toLowerCase().includes(q) ||
        String(t.id).includes(q) ||
        (t.partition_key || "").toLowerCase().includes(q),
    );
  }, [moveModalReport, items, targetSearchQuery]);

  return (
    <section className="flex-1 flex flex-col min-h-0 space-y-4">
      {/* Header */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between shrink-0">
        <div>
          <h1 className="page-title flex items-center gap-2.5">
            <i className="fas fa-clipboard-check text-[#1745c2] text-xl md:text-[22px]" />
            <span>{t("review.title", "Review")}</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              {filteredRows.length} {t("review.items", "items")}
            </span>
          </h1>
          <p className="page-subtitle mt-1">
            {t(
              "review.subtitle",
              "Matches the system was unsure about, and groups it distrusts. Nothing here has been hidden — confirming is as much an answer as moving.",
            )}
          </p>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search */}
          <div className="relative w-64">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
            <input
              type="text"
              placeholder={t("review.searchPlaceholder", "Search reports, WO, equipment...")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl border border-border-base bg-surface-default text-text-default focus:outline-hidden focus:ring-1 focus:ring-blue-500 shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs cursor-pointer"
              >
                <i className="fas fa-times" />
              </button>
            )}
          </div>

          {/* Process Filter */}
          {processOptions.length > 0 && (
            <select
              value={selectedProcess}
              onChange={(e) => setSelectedProcess(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-xl border border-border-base bg-surface-default text-text-default focus:outline-hidden focus:ring-1 focus:ring-blue-500 shadow-2xs cursor-pointer"
            >
              <option value="all">{t("review.allProcesses", "All Processes")}</option>
              {processOptions.map((proc) => (
                <option key={proc} value={proc}>
                  {proc}
                </option>
              ))}
            </select>
          )}

          {/* Refresh Button */}
          <button
            type="button"
            onClick={load}
            disabled={loading || busy}
            className="btn-base w-8 h-8 rounded-xl border border-border-base bg-surface-default hover:bg-gray-100 dark:hover:bg-gray-800 text-text-default flex items-center justify-center cursor-pointer disabled:opacity-50 shadow-2xs shrink-0"
            title={t("app.refresh", "Refresh")}
            aria-label={t("app.refresh", "Refresh")}
          >
            <i className={`fas fa-sync-alt text-xs ${loading ? "fa-spin" : ""}`} />
          </button>
        </div>
      </header>

      {/* Alert Notices */}
      {error && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center justify-between gap-2 animate-fade-in">
          <div className="flex items-center gap-2">
            <i className="fas fa-exclamation-triangle shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-500 hover:text-red-700 dark:hover:text-red-300 cursor-pointer"
          >
            <i className="fas fa-times" />
          </button>
        </div>
      )}

      {note && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2 animate-fade-in ${
            note.bad
              ? "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200"
              : "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
          }`}
        >
          <div className="flex items-center gap-2">
            <i
              className={`fas ${note.bad ? "fa-exclamation-circle" : "fa-check-circle"} shrink-0`}
            />
            <span>{note.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setNote(null)}
            className="opacity-70 hover:opacity-100 cursor-pointer"
          >
            <i className="fas fa-times" />
          </button>
        </div>
      )}

      {/* Main Table Container */}
      <div className="flex-1 flex flex-col min-h-0 bg-surface-default border border-border-base rounded-2xl shadow-xs overflow-hidden">
        {loading && !data ? (
          <div className="p-6 animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
            <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-1/2" />
            <div className="space-y-2 pt-2">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-12 bg-gray-100 dark:bg-gray-800 rounded-xl" />
              ))}
            </div>
          </div>
        ) : nothing ? (
          <div className="p-8 space-y-4">
            <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
              <i className="fas fa-check-circle text-2xl" />
              <h2 className="text-base font-bold text-text-default">
                {t("review.nothingWaiting", "Nothing is waiting for you.")}
              </h2>
            </div>
            <p className="text-xs text-text-subtle">
              {t("review.whatThatMeans", "What that means depends on which checks have run:")}
            </p>
            <ul className="space-y-2 text-xs text-text-default pl-4 border-l-2 border-border-base">
              <li className="flex items-start gap-2">
                <i className="fas fa-circle text-[6px] mt-1.5 text-blue-500" />
                <span>
                  {Number(chk.matched_reports) > 0 ? (
                    t(
                      "review.borderlineChecked",
                      "Borderline matches — {count} report(s) were scored against existing groups, none landed near the boundary.",
                    ).replace("{count}", chk.matched_reports)
                  ) : (
                    t(
                      "review.borderlineNotChecked",
                      "Borderline matches — not checked yet. This check only runs when a report is matched against groups that already exist.",
                    )
                  )}
                </span>
              </li>
            </ul>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <div className="w-10 h-10 mx-auto rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-400 flex items-center justify-center">
              <i className="fas fa-search text-base" />
            </div>
            <h3 className="text-xs font-bold text-text-default">
              {t("empty.noMatch", "No data matches the conditions.")}
            </h3>
            <p className="text-[11px] text-text-subtle">
              {t(
                "empty.hint",
                "Please select a process and maintenance group or enter a search query to check the data.",
              )}
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left text-xs border-collapse border-spacing-0">
              {/* Sticky Table Header (No vertical borders) */}
              <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800 border-b border-border-base text-text-subtle font-semibold uppercase tracking-wider text-[11px] shadow-xs">
                <tr>
                  <th className="py-3 px-3.5 w-14 text-center border-0">{t("jobs.sNo", "S.No")}</th>
                  <th className="py-3 px-4 border-0">{t("review.report", "Report")}</th>
                  <th className="py-3 px-3.5 min-w-[220px] border-0">{t("review.attachedTo", "Attached to")}</th>
                  <th className="py-3 px-3.5 text-right w-24 border-0">{t("review.score", "Score")}</th>
                  <th className="py-3 px-4 text-center w-36 border-0">{t("review.actions", "Actions")}</th>
                </tr>
              </thead>

              {/* Table Body with horizontal row borders only */}
              <tbody className="divide-y divide-border-base">
                {filteredRows.map((r, index) => {
                  const isSelected = selectedReportId === r.report_id;

                  return (
                    <tr
                      key={r.report_id}
                      data-row={r.report_id}
                      onClick={() =>
                        setSelectedReportId((prev) =>
                          prev === r.report_id ? null : r.report_id,
                        )
                      }
                      className={`transition-colors duration-150 cursor-pointer ${
                        isSelected
                          ? "bg-blue-100/80 dark:bg-blue-900/50"
                          : "hover:bg-gray-50/80 dark:hover:bg-gray-800/50"
                      }`}
                    >
                      {/* S.No column */}
                      <td
                        className={`py-3.5 px-3.5 text-center font-mono font-bold text-xs border-0 ${
                          isSelected
                            ? "text-[#1745c2] dark:text-blue-300"
                            : "text-text-subtlest"
                        }`}
                      >
                        {index + 1}
                      </td>

                      {/* Report column */}
                      <td className="py-3.5 px-4 max-w-xl border-0">
                        <div className="font-medium text-text-default text-xs leading-relaxed line-clamp-3">
                          <HighlightText
                            text={r.normalized_content || ""}
                            query={searchQuery}
                          />
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-2 text-[10px] text-text-subtle">
                          {r.wo_code && (
                            <span className="px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800/90 font-mono text-gray-800 dark:text-gray-200">
                              <HighlightText text={r.wo_code} query={searchQuery} />
                            </span>
                          )}
                          {r.process && (
                            <span className="px-1.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 font-medium">
                              {r.process}
                            </span>
                          )}
                          {(r.equipment_name || r.equipment) && (
                            <span className="px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                              <HighlightText
                                text={r.equipment_name || r.equipment}
                                query={searchQuery}
                              />
                            </span>
                          )}
                          {r.equipment_code && (
                            <span className="px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 font-mono text-gray-500">
                              {r.equipment_code}
                            </span>
                          )}
                          {r.maintenance_part && (
                            <span className="px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                              {r.maintenance_part}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Attached to */}
                      <td className="py-3.5 px-3.5 border-0">
                        <div className="font-semibold text-blue-600 dark:text-blue-400 text-xs line-clamp-2 leading-snug">
                          <HighlightText
                            text={r.rep_name || `Work Item #${r.rep_work_id}`}
                            query={searchQuery}
                          />
                        </div>
                        <div className="text-[10px] text-text-subtlest font-mono mt-1">
                          #{r.rep_work_id}
                        </div>
                      </td>

                      {/* Score */}
                      <td className="py-3.5 px-3.5 text-right border-0">
                        <span
                          className={`font-mono font-bold text-xs px-2 py-0.5 rounded-md inline-block ${
                            (r.match_score ?? 1) < 0.55
                              ? "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300"
                              : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                          }`}
                        >
                          {r.match_score?.toFixed(3)}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap border-0">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setKeepConfirmReport(r);
                            }}
                            disabled={busy}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                            title={t("review.keepTooltip", "Keep report in current work item")}
                          >
                            {t("review.keep", "Keep")}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenMoveModal(r);
                            }}
                            disabled={busy}
                            className="px-3 py-1.5 rounded-lg border border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
                            title={t("review.moveTooltip", "Move report to another work item")}
                          >
                            {t("review.move", "Move…")}
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

      {/* Keep Confirmation Modal */}
      {keepConfirmReport && (
        <Modal
          open={Boolean(keepConfirmReport)}
          title={t("review.confirmKeepTitle", "Confirm Keep")}
          description={t(
            "review.confirmKeepDesc",
            "Are you sure you want to keep this report in the current work item?",
          )}
          titleIcon={<i className="fas fa-check-circle text-emerald-600 text-lg" />}
          onClose={() => setKeepConfirmReport(null)}
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <button
                type="button"
                onClick={() => setKeepConfirmReport(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
              >
                {t("app.cancel", "Cancel")}
              </button>
              <button
                type="button"
                onClick={handleConfirmKeep}
                disabled={busy}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm cursor-pointer disabled:opacity-50"
              >
                {busy ? t("review.keeping", "Keeping…") : t("review.confirmKeepBtn", "Confirm Keep")}
              </button>
            </div>
          }
        >
          <div className="space-y-2 py-1 text-xs text-text-default">
            <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-border-base space-y-1.5">
              <div className="font-semibold text-text-default">
                {t("review.woCodeLabel", "W/O Code:")}{" "}
                <span className="font-mono text-blue-600 dark:text-blue-400">
                  {keepConfirmReport.wo_code || `#${keepConfirmReport.report_id}`}
                </span>
              </div>
              <div className="text-text-subtle line-clamp-2">
                {keepConfirmReport.normalized_content}
              </div>
              <div className="text-[11px] text-text-subtlest">
                {t("review.targetWorkItemLabel", "Target Work Item:")}{" "}
                <span className="font-bold text-text-default">
                  {keepConfirmReport.rep_name || `#${keepConfirmReport.rep_work_id}`}
                </span>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Move Destination Selection Modal */}
      {moveModalReport && (
        <Modal
          open={Boolean(moveModalReport)}
          title={t("review.moveModalTitle", "Move Report to Work Item")}
          description={t(
            "review.moveModalDesc",
            "Select a target work item to move this report to.",
          )}
          titleIcon={<i className="fas fa-arrows-alt text-[#1745c2] text-lg" />}
          onClose={() => setMoveModalReport(null)}
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <button
                type="button"
                onClick={() => setMoveModalReport(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
              >
                {t("app.cancel", "Cancel")}
              </button>
              <button
                type="button"
                onClick={handleProceedMoveConfirm}
                disabled={!selectedTargetId || busy}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-[#1745c2] hover:bg-blue-700 text-white shadow-sm cursor-pointer disabled:opacity-50"
              >
                {t("review.selectProceed", "Select & Proceed")}
              </button>
            </div>
          }
        >
          <div className="space-y-4 py-1 text-xs text-text-default">
            {/* Current Report Summary */}
            <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-border-base space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-xs">
                  {moveModalReport.wo_code || `#${moveModalReport.report_id}`}
                </span>
                {moveModalReport.process && (
                  <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 text-[10px] font-semibold">
                    {moveModalReport.process}
                  </span>
                )}
              </div>
              <p className="text-text-subtle line-clamp-2 text-xs">
                {moveModalReport.normalized_content}
              </p>
              <div className="text-[11px] text-text-subtlest pt-1 border-t border-border-base/50">
                {t("review.currentlyAttachedTo", "Currently attached to:")}{" "}
                <span className="font-semibold text-text-default">
                  {moveModalReport.rep_name || `#${moveModalReport.rep_work_id}`}
                </span>
              </div>
            </div>

            {/* Target Work Item Search & Selection */}
            <div className="space-y-2">
              <label className="block font-bold text-text-default text-xs">
                {t("review.selectDestination", "Select Destination Work Item:")}
              </label>
              <div className="relative">
                <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
                <input
                  type="text"
                  placeholder={t(
                    "review.searchDestPlaceholder",
                    "Search destination work items by name or ID...",
                  )}
                  value={targetSearchQuery}
                  onChange={(e) => setTargetSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-border-base bg-surface-default text-text-default focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Scrollable Work Item List */}
              <div className="max-h-56 overflow-y-auto rounded-xl border border-border-base divide-y divide-border-base bg-surface-default">
                {modalTargets.length === 0 ? (
                  <div className="p-4 text-center text-text-subtle text-xs italic">
                    {targetSearchQuery
                      ? t(
                          "review.noMatchDest",
                          "No matching destination work items found.",
                        )
                      : t(
                          "review.noOtherItems",
                          "No other work items available in this process.",
                        )}
                  </div>
                ) : (
                  modalTargets.map((w) => {
                    const isChosen = selectedTargetId === w.id;
                    return (
                      <div
                        key={w.id}
                        onClick={() => setSelectedTargetId(w.id)}
                        className={`p-3 transition-colors cursor-pointer flex items-start justify-between gap-3 ${
                          isChosen
                            ? "bg-blue-50 dark:bg-blue-950/60 border-l-4 border-l-[#1745c2]"
                            : "hover:bg-gray-50/80 dark:hover:bg-gray-800/40"
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-text-default text-xs leading-snug">
                            {w.rep_name || `Work Item #${w.id}`}
                          </div>
                          {w.partition_key && (
                            <div className="mt-1 text-[11px] text-text-subtlest">
                              <span>{w.partition_key}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 dark:bg-gray-800 text-text-subtle">
                            {w.member_count || 0} {t("review.members", "members")}
                          </span>
                          {w.status === "archived" && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-medium">
                              {t("review.archived", "archived")}
                            </span>
                          )}
                          <div
                            className={`w-4 h-4 rounded-full border flex items-center justify-center ml-1 ${
                              isChosen
                                ? "border-[#1745c2] bg-[#1745c2] text-white"
                                : "border-gray-300 dark:border-gray-600"
                            }`}
                          >
                            {isChosen && <i className="fas fa-check text-[8px]" />}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Move Confirmation Modal */}
      {moveConfirmState && (
        <Modal
          open={Boolean(moveConfirmState)}
          title={t("review.confirmMoveTitle", "Confirm Move")}
          description={t(
            "review.confirmMoveDesc",
            "Are you sure you want to move this report to the selected work item?",
          )}
          titleIcon={<i className="fas fa-exchange-alt text-[#1745c2] text-lg" />}
          onClose={() => setMoveConfirmState(null)}
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <button
                type="button"
                onClick={() => setMoveConfirmState(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
              >
                {t("app.cancel", "Cancel")}
              </button>
              <button
                type="button"
                onClick={handleConfirmMove}
                disabled={busy}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm cursor-pointer disabled:opacity-50"
              >
                {busy ? t("review.saving", "Saving…") : t("review.confirmMoveBtn", "Save")}
              </button>
            </div>
          }
        >
          <div className="space-y-3 py-1 text-xs text-text-default">
            <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-border-base space-y-2">
              <div>
                <span className="text-text-subtlest">{t("review.reportLabel", "Report:")} </span>
                <span className="font-mono font-bold text-text-default">
                  {moveConfirmState.report.wo_code || `#${moveConfirmState.report.report_id}`}
                </span>
                <p className="text-text-subtle line-clamp-2 mt-1">
                  {moveConfirmState.report.normalized_content}
                </p>
              </div>

              <div className="pt-2 border-t border-border-base flex items-center justify-between text-xs">
                <span className="text-text-subtle">{t("review.movingToLabel", "Moving To:")}</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">
                  {moveConfirmState.targetName} (#{moveConfirmState.targetId})
                </span>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Full-Screen UI Blocking Loader */}
      {busy && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/60 backdrop-blur-xs animate-fade-in pointer-events-auto select-none">
          <div className="bg-surface-default border border-border-base rounded-2xl p-6 shadow-2xl flex flex-col items-center max-w-sm mx-4 text-center space-y-3.5 animate-scale-in">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/70 text-[#1745c2] dark:text-blue-400 flex items-center justify-center shadow-xs">
              <i className="fas fa-circle-notch fa-spin text-2xl" />
            </div>
            {countdown !== null && (
              <div className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-700 text-[#1745c2] dark:text-blue-300 font-mono text-sm font-bold shadow-2xs">
                <i className="fas fa-stopwatch text-xs" />
                <span>{countdown}s</span>
              </div>
            )}
            <div>
              <h3 className="text-sm font-bold text-text-default">
                {busyMessage || t("review.processing", "Processing Request...")}
              </h3>
              <p className="text-xs text-text-subtle mt-1.5 leading-relaxed">
                {countdown !== null
                  ? t("review.syncWaitMsg", "Synchronizing pipeline changes. This may take up to 60 seconds...")
                  : t("review.waitMsg", "Please wait while the changes are being applied and resynthesized.")}
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}



