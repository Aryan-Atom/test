import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../i18n.jsx";
import { promptApi } from "../utils/promptApi.js";
import "./AiPipelinePromptModal.css";

const LABEL_BOLD = "Prompt wording";
const LABEL_MUTED = "· how the ten Korean fields are written";

export default function AiPipelinePromptModal({
  isOpen,
  onClose,
  onUploadFile,
  isUploading = false,
}) {
  const { t } = useI18n();
  const [prompts, setPrompts] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState({}); // segment index -> edited text
  const [saved, setSaved] = useState(null); // transient confirmation
  const [isExpanded, setIsExpanded] = useState(false); // Collapsed by default
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const promptSectionRef = useRef(null);
  const modalBodyRef = useRef(null);

  // Load prompts directly from API
  const loadPrompts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await promptApi.prompts();
      setPrompts(data);
    } catch (err) {
      console.error("Failed to load prompt configuration:", err);
      setError(err.message || "Failed to load prompt from API");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadPrompts();
      setIsExpanded(false); // Default collapsed on open
    }
  }, [isOpen, loadPrompts]);

  // Handle ESC key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && !isUploading) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isUploading, onClose]);

  // The first (and only) UI-editable prompt (reduce_system)
  const prompt = prompts?.prompts?.[0] ?? null;

  // The editable segments, in order, with original text
  const editableSegs = useMemo(() => {
    if (!prompt) return [];
    return prompt.segments
      .map((s, i) => ({ ...s, index: i }))
      .filter((s) => !s.locked);
  }, [prompt]);

  // Whether any editable segment differs from original text
  const dirty = useMemo(() => {
    if (!prompt) return false;
    return editableSegs.some((s) => (drafts[s.index] ?? s.text) !== s.text);
  }, [prompt, editableSegs, drafts]);

  const isEdited = prompt?.edited === true;

  function setDraft(index, value) {
    setDrafts((d) => ({ ...d, [index]: value }));
  }

  async function handleSavePrompt() {
    if (!prompt) return;
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const parts = prompt.segments.map((s, i) =>
        s.locked ? s : { ...s, text: drafts[i] ?? s.text }
      );
      const updated = await promptApi.savePrompt(prompt.name, parts);
      if (updated?.prompts) {
        setPrompts(updated);
      } else if (updated?.name) {
        setPrompts((p) => ({ ...p, prompts: [updated] }));
      } else {
        await loadPrompts();
      }
      setDrafts({});
      setSaved(
        "Saved. This wording applies to the next run — nothing already loaded has changed."
      );
    } catch (e) {
      setError(e.message || "Failed to save prompt wording.");
    } finally {
      setBusy(false);
    }
  }

  async function handleResetPrompt() {
    if (!prompt) return;
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const updated = await promptApi.resetPrompt(prompt.name);
      if (updated?.prompts) {
        setPrompts(updated);
      } else if (updated?.name) {
        setPrompts((p) => ({ ...p, prompts: [updated] }));
      } else {
        await loadPrompts();
      }
      setDrafts({});
      setSaved(
        updated?.edited
          ? "Back to the original wording."
          : "This was already the original wording."
      );
    } catch (e) {
      setError(e.message || "Failed to reset prompt wording.");
    } finally {
      setBusy(false);
    }
  }

  // Trigger file explorer dialog
  function handleTriggerFileInput() {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  }

  // Handle selected file from file explorer
  function handleFileSelected(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name?.toLowerCase().endsWith(".xlsx")) {
      setError(
        t("toast.unsupportedFormat", "Unsupported file format. Only XLSX format is supported."),
      );
      return;
    }
    setError(null);
    if (onUploadFile) {
      onUploadFile(file);
    }
  }

  // Drag and drop handlers
  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    if (!file.name?.toLowerCase().endsWith(".xlsx")) {
      setError(
        t("toast.unsupportedFormat", "Unsupported file format. Only XLSX format is supported."),
      );
      return;
    }
    setError(null);
    if (onUploadFile) {
      onUploadFile(file);
    }
  }

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="ai-prompt-modal-overlay"
      onClick={() => {
        if (!isUploading && !busy) onClose();
      }}
    >
      <div
        className="ai-prompt-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx"
          style={{ display: "none" }}
          onChange={handleFileSelected}
        />

        {/* Modal Header */}
        <div className="ai-prompt-modal-header">
          <div className="ai-prompt-header-title">
            <i className="fas fa-robot text-[#1745c2]" />
            <span>{t("app.aiPipelineImportExcel", "AI Pipeline Import Excel")}</span>
          </div>

          <button
            type="button"
            className="ai-prompt-close-btn"
            onClick={onClose}
            disabled={busy || isUploading}
            aria-label="Close"
          >
            <i className="fas fa-times" />
          </button>
        </div>

        {/* Modal Body */}
        <div ref={modalBodyRef} className="ai-prompt-modal-body">
          {error && (
            <div className="p-3 mb-3 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-300 flex items-center gap-2">
              <i className="fas fa-exclamation-circle text-sm shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {/* Top: Drag & Drop Spreadsheet Area */}
          <div
            className={`prompt-dropzone ${isDragging ? "dragging" : ""} ${isExpanded ? "collapsed-dropzone" : ""}`}
            onClick={handleTriggerFileInput}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="prompt-dropzone-icon">
              <svg
                width="34"
                height="42"
                viewBox="0 0 34 42"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M2 5C2 3.34315 3.34315 2 5 2H22L32 12V37C32 38.6569 30.6569 40 29 40H5C3.34315 40 2 38.6569 2 37V5Z"
                  stroke="#94a3b8"
                  strokeWidth="2.2"
                  strokeLinejoin="round"
                />
                <path
                  d="M21 2V13H32"
                  stroke="#94a3b8"
                  strokeWidth="2.2"
                  strokeLinejoin="round"
                />
                <path
                  d="M8 20H26"
                  stroke="#94a3b8"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M8 26H26"
                  stroke="#94a3b8"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M8 32H18"
                  stroke="#94a3b8"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div className="prompt-dropzone-title">
              {t("app.dropSpreadsheet", "Drop a work-report spreadsheet")}
            </div>
            <div className="prompt-dropzone-subtitle">
              or{" "}
              <span
                className="prompt-dropzone-browse"
                onClick={(e) => {
                  e.stopPropagation();
                  handleTriggerFileInput();
                }}
              >
                browse
              </span>{" "}
              — .xlsx exported from the data portal
            </div>
          </div>

          {/* Bottom: Prompt wording (Collapsed by default, expand on click) */}
          <section ref={promptSectionRef} className="prompt-editor-section">
            <button
              type="button"
              className="prompt-toggle-btn"
              aria-expanded={isExpanded}
              onClick={() => {
                setIsExpanded((prev) => {
                  const next = !prev;
                  if (next) {
                    setTimeout(() => {
                      if (modalBodyRef.current) {
                        modalBodyRef.current.scrollTo({
                          top: 140,
                          behavior: "smooth",
                        });
                      }
                    }, 100);
                  }
                  return next;
                });
              }}
            >
              <div className="prompt-toggle-left">
                <b>{LABEL_BOLD}</b>{" "}
                <span className="prompt-toggle-sub">{LABEL_MUTED}</span>
              </div>
              <div className="prompt-toggle-right">
                <span className={`prompt-pill ${isEdited ? "edited" : "original"}`}>
                  {isEdited ? "edited" : "original"}
                </span>
                <span className="prompt-chevron" aria-hidden="true">
                  {isExpanded ? "▲" : "▼"}
                </span>
              </div>
            </button>

            {/* Expanded Prompt Details */}
            {isExpanded && (
              <div className="prompt-expanded-content">
                <div className="prompt-banner">
                  <b>An edit applies to the next run only.</b> Nothing already
                  loaded is reprocessed — existing work items keep the fields
                  they have, so a change here will not correct output you are
                  unhappy with.
                </div>

                {error && <div className="prompt-error">{error}</div>}
                {saved && <div className="prompt-saved">{saved}</div>}

                {/* Integrity warnings */}
                {(prompt?.warnings || []).map((w, i) => (
                  <div key={i} className="prompt-warning">
                    <i className="fas fa-exclamation-triangle mr-1" /> {w}
                  </div>
                ))}

                {/* Segments: Editable textareas & locked code block */}
                <div className="prompt-segments-list">
                  {loading && !prompt ? (
                    <div className="p-8 text-center text-sm text-text-subtle">
                      <i className="fas fa-spinner fa-spin mr-2 text-base text-[#1745c2]" />
                      <span>Loading prompt from API...</span>
                    </div>
                  ) : prompt ? (
                    prompt.segments.map((seg, i) =>
                      seg.locked ? (
                        <div key={i} className="prompt-locked">
                          <div className="prompt-locked-head">
                            <i className="fas fa-lock text-xs text-amber-500" />
                            <span>
                              Fixed Output Schema (Locked)
                            </span>
                            <span className="muted">
                              · read by the pipeline, non-editable
                            </span>
                          </div>
                          <pre className="prompt-locked-pre">{seg.text}</pre>
                        </div>
                      ) : (
                        <div key={i} className="prompt-editable-segment">
                          <div className="prompt-segment-label">
                            <i className="fas fa-edit text-xs text-blue-500" />
                            <span>
                              {i === 0
                                ? "Editable Segment 1 (Preamble & Statistics Rules)"
                                : `Editable Segment 2 (Classification & Naming Rules)`}
                            </span>
                          </div>
                          <textarea
                            className="prompt-textarea"
                            value={drafts[i] ?? seg.text}
                            onChange={(e) => setDraft(i, e.target.value)}
                            rows={Math.min(
                              10,
                              Math.max(
                                5,
                                (drafts[i] ?? seg.text).split("\n").length + 1
                              )
                            )}
                            spellCheck={false}
                          />
                        </div>
                      )
                    )
                  ) : (
                    <div className="p-6 text-center text-sm text-gray-500">
                      <p className="mb-3 text-red-600 dark:text-red-400">
                        {error || "Could not load prompt data from API."}
                      </p>
                      <button
                        type="button"
                        className="prompt-btn"
                        onClick={loadPrompts}
                      >
                        <i className="fas fa-redo mr-1" /> Retry
                      </button>
                    </div>
                  )}
                </div>

                {/* Sub-footer for Prompt Save / Reset */}
                {prompt && (
                  <div className="prompt-sub-footer">
                    <span className="prompt-blurb">
                      {prompt.blurb}{" "}
                      <span className="m">· version {prompt.version}</span>
                    </span>
                    <div className="prompt-actions">
                      <button
                        type="button"
                        className="prompt-btn"
                        onClick={handleResetPrompt}
                        disabled={busy || !isEdited || isUploading}
                      >
                        <i className="fas fa-undo text-xs" />
                        <span>Reset to original</span>
                      </button>
                      <button
                        type="button"
                        className="prompt-btn primary"
                        onClick={handleSavePrompt}
                        disabled={busy || !dirty || isUploading}
                      >
                        {busy ? (
                          <>
                            <i className="fas fa-spinner fa-spin text-xs" />
                            <span>Saving…</span>
                          </>
                        ) : (
                          <>
                            <i className="fas fa-save text-xs" />
                            <span>Save wording</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
