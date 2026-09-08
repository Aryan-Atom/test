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
  const fileInputRef = useRef(null);

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
        {/* Modal Header */}
        <div className="ai-prompt-modal-header">
          <div className="ai-prompt-header-left">
            <h3 className="ai-prompt-modal-title">
              <i className="fas fa-robot text-[#1745c2]" />
              <span>{LABEL_BOLD}</span>
              <span className="ai-prompt-header-sub">{LABEL_MUTED}</span>
            </h3>
            <span className={`prompt-pill ${isEdited ? "edited" : "original"}`}>
              {isEdited ? "edited" : "original"}
            </span>
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
        <div className="ai-prompt-modal-body">
          <div className="prompt-banner">
            <b>An edit applies to the next run only.</b> Nothing already loaded
            is reprocessed — existing work items keep the fields they have, so a
            change here will not correct output you are unhappy with.
          </div>

          {error && <div className="prompt-error">{error}</div>}
          {saved && <div className="prompt-saved">{saved}</div>}

          {/* Integrity warnings — advisory only, never blocks a save */}
          {(prompt?.warnings || []).map((w, i) => (
            <div key={i} className="prompt-warning">
              <i className="fas fa-exclamation-triangle mr-1" /> {w}
            </div>
          ))}

          {/* Render the segments IN ORDER:
              Editable pieces are textareas; locked block is read-only preformatted block */}
          <div className="prompt-segments-list">
            {prompt ? (
              prompt.segments.map((seg, i) =>
                seg.locked ? (
                  <div key={i} className="prompt-locked">
                    <div className="prompt-locked-head">
                      <i className="fas fa-lock text-xs text-gray-500" />
                      <span>
                        Fixed — the output fields and their allowed values
                      </span>
                      <span className="muted">
                        · read by the pipeline, so not editable
                      </span>
                    </div>
                    <pre className="prompt-locked-pre">{seg.text}</pre>
                  </div>
                ) : (
                  <div key={i} className="prompt-editable-segment">
                    <div className="prompt-segment-label">
                      <i className="fas fa-edit text-xs text-blue-500" />
                      <span>Editable Segment {i + 1}</span>
                    </div>
                    <textarea
                      className="prompt-textarea"
                      value={drafts[i] ?? seg.text}
                      onChange={(e) => setDraft(i, e.target.value)}
                      rows={Math.min(
                        14,
                        Math.max(6, (drafts[i] ?? seg.text).split("\n").length + 1)
                      )}
                      spellCheck={false}
                    />
                  </div>
                )
              )
            ) : loading ? (
              <div className="p-8 text-center text-sm text-text-subtle">
                <i className="fas fa-spinner fa-spin mr-2 text-base text-[#1745c2]" />
                <span>Loading prompt from API...</span>
              </div>
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

        {/* Modal Bottom: Upload Section */}
        <div className="ai-prompt-modal-footer">
          {/* Hidden File Input for CSV and Excel (.xlsx, .xls) */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            style={{ display: "none" }}
            onChange={handleFileSelected}
          />

          <div className="upload-instruction">
            <span className="upload-title">
              <i className="fas fa-file-excel text-emerald-600" />
              <span>Import Dataset</span>
            </span>
            <span className="upload-subtitle">
              Click Upload to choose a CSV or XLSX file and run the AI Pipeline.
            </span>
          </div>

          <div className="upload-footer-actions">
            <button
              type="button"
              className="prompt-btn"
              onClick={onClose}
              disabled={isUploading}
            >
              {t("app.cancel", "Cancel")}
            </button>
            <button
              type="button"
              className="btn-upload-file"
              onClick={handleTriggerFileInput}
              disabled={isUploading || busy}
            >
              {isUploading ? (
                <>
                  <i className="fas fa-spinner fa-spin" />
                  <span>{t("app.uploading", "Uploading…")}</span>
                </>
              ) : (
                <>
                  <i className="fas fa-folder-open" />
                  <span>{t("app.aiPipelineUploadBtn", "Upload CSV / XLSX")}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
