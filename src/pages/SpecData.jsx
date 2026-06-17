import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import AnimatedActionButton from "../components/AnimatedActionButton.jsx";
import { OperationStatus } from "../components/OperationStatus.jsx";
import { withMinimumDelay } from "../utils/actionTiming.js";
import { pocEndPoints } from "../axios/endPoints.js";
import { getUserInfo } from "../utils/cookieUtils.js";
import { APIcallGet, APIcallPost, APIcallPostFile } from "../axios/apiCall.js";
import * as XLSX from "xlsx";
import { useI18n } from "../i18n.jsx";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function buildExcelToJsonKeyMap(columnDefs) {
  const list = Array.isArray(columnDefs)
    ? columnDefs
    : Array.isArray(columnDefs?.data)
      ? columnDefs.data
      : [];
  return list.reduce((acc, col) => {
    if (col.excelColumnName && col.jsonKey) {
      acc[col.excelColumnName.trim()] = col.jsonKey;
    }
    return acc;
  }, {});
}

function remapRowKeys(row, excelToJsonKey) {
  return Object.entries(row).reduce((acc, [key, value]) => {
    const mappedKey = excelToJsonKey[key.trim()] ?? key;
    acc[mappedKey] = value;
    return acc;
  }, {});
}

// Stable composite key — immune to duplicate `id` values in test/real data.
function rowKey(row, index) {
  return `${index}__${row.id ?? ""}__${row.equipmentCode ?? row.설비코드 ?? ""}__${row.specName ?? row.사양항목 ?? ""}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// SelectSkeleton — prevents white-flash while dropdown options are loading
// ─────────────────────────────────────────────────────────────────────────────
function SelectSkeleton({ width = "100%" }) {
  return (
    <div
      style={{
        width: width,
        height: "38px",
        borderRadius: "6px",
        background: "linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.4s infinite",
        border: "1px solid var(--color-border-base, #e5e7eb)",
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EditableCell
// ─────────────────────────────────────────────────────────────────────────────
function EditableCell({ value, isEditing, col, onChange }) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  if (!isEditing) {
    return (
      <span
        style={{
          display: "block",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: "220px",
          color:
            value == null || value === ""
              ? "var(--color-text-subtle, #9ca3af)"
              : "var(--color-text-default, #111827)",
        }}
        title={String(value ?? "")}
      >
        {value == null || value === "" ? "—" : String(value)}
      </span>
    );
  }

  return (
    <input
      ref={inputRef}
      style={{
        width: "100%",
        minWidth: "80px",
        padding: "4px 8px",
        fontSize: "12px",
        border: "1.5px solid #2563eb",
        borderRadius: "4px",
        background: "#fff",
        color: "#111",
        outline: "none",
        boxSizing: "border-box",
      }}
      value={value ?? ""}
      onChange={(e) => onChange(col, e.target.value)}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EditableModalRow — inside the upload preview modal
// ─────────────────────────────────────────────────────────────────────────────
function EditableModalRow({ row, index, columns, editingRowIndex, onStartEdit, onSave, onCancel }) {
  const isEditing = editingRowIndex === index;
  const [draft, setDraft] = useState({});
  const rowRef = useRef(null);

  const handleStartEdit = (e) => {
    e.stopPropagation();
    setDraft({ ...row });
    onStartEdit(index);
  };

  const handleDraftChange = useCallback((col, value) => {
    setDraft((prev) => ({ ...prev, [col]: value }));
  }, []);

  const handleSave = useCallback(
    (e) => {
      e?.stopPropagation();
      onSave(index, { ...row, ...draft });
    },
    [index, draft, row, onSave],
  );

  const handleCancel = (e) => {
    e?.stopPropagation();
    setDraft({});
    onCancel();
  };

  useEffect(() => {
    if (!isEditing) return;
    const handler = (e) => {
      if (rowRef.current && !rowRef.current.contains(e.target)) handleSave();
    };
    const t = setTimeout(() => document.addEventListener("mousedown", handler), 80);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", handler);
    };
  }, [isEditing, handleSave]);

  useEffect(() => {
    if (!isEditing) return;
    const handler = (e) => {
      if (e.key === "Enter") handleSave(e);
      if (e.key === "Escape") handleCancel(e);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isEditing, handleSave]);

  return (
    <tr
      ref={rowRef}
      style={{
        borderBottom: "1px solid var(--color-border-base, #e5e7eb)",
        background: isEditing
          ? "#eff6ff"
          : index % 2 === 0
            ? "var(--color-surface-default, #fff)"
            : "var(--color-surface-raised, #f9fafb)",
        outline: isEditing ? "2px solid #2563eb" : "none",
        outlineOffset: "-1px",
        transition: "background 0.1s",
      }}
    >
      <td
        className="px-4 py-2.5 text-xs tabular-nums"
        style={{
          color: "var(--color-text-subtle, #9ca3af)",
          whiteSpace: "nowrap",
          userSelect: "none",
        }}
      >
        {index + 1}
      </td>

      <td className="px-3 py-2" style={{ whiteSpace: "nowrap" }}>
        {isEditing ? (
          <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
            <button
              type="button"
              onClick={handleSave}
              title="저장 (Enter)"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "26px",
                height: "26px",
                borderRadius: "5px",
                border: "none",
                background: "#16a34a",
                color: "#fff",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              <i className="fas fa-check" style={{ fontSize: "10px" }} />
            </button>
            <button
              type="button"
              onClick={handleCancel}
              title="취소 (Esc)"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "26px",
                height: "26px",
                borderRadius: "5px",
                border: "none",
                background: "#e5e7eb",
                color: "#6b7280",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              <i className="fas fa-times" style={{ fontSize: "10px" }} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleStartEdit}
            title="행 편집"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "26px",
              height: "26px",
              borderRadius: "5px",
              border: "none",
              background: "var(--color-brand-10, #eff6ff)",
              color: "var(--color-brand-60, #2563eb)",
              cursor: "pointer",
            }}
          >
            <i className="fas fa-pencil-alt" style={{ fontSize: "10px" }} />
          </button>
        )}
      </td>

      {columns.map((col) => (
        <td
          key={col}
          style={{
            padding: isEditing ? "4px 6px" : "8px 16px",
            minWidth: isEditing ? "100px" : undefined,
            maxWidth: "240px",
          }}
        >
          <EditableCell
            value={isEditing ? draft[col] : row[col]}
            isEditing={isEditing}
            col={col}
            onChange={handleDraftChange}
          />
        </td>
      ))}
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// UploadPreviewModal
// ─────────────────────────────────────────────────────────────────────────────
export function UploadPreviewModal({ rows: initialRows, columns, onClose, onConfirm }) {
  const { t } = useI18n();
  const [rows, setRows] = useState(() => initialRows ?? []);
  const [editingRowIndex, setEditingRowIndex] = useState(null);

  useEffect(() => {
    setRows(initialRows ?? []);
    setEditingRowIndex(null);
  }, [initialRows]);

  const detectedColumns = columns?.length ? columns : rows.length > 0 ? Object.keys(rows[0]) : [];

  const handleSaveRow = useCallback((index, payload) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = payload;
      return next;
    });
    setEditingRowIndex(null);
  }, []);

  const handleCancelEdit = useCallback(() => setEditingRowIndex(null), []);

  const handleConfirm = () => {
    const confirmedRows = [...rows];
    onClose();
    window.setTimeout(() => onConfirm?.(confirmedRows), 0);
  };

  if (!initialRows) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)" }}
    >
      <div
        className="flex flex-col rounded-2xl shadow-2xl overflow-hidden"
        style={{
          background: "var(--color-surface-default, #fff)",
          border: "1px solid var(--color-border-base, #e5e7eb)",
          width: "min(95vw, 1200px)",
          maxHeight: "88vh",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{
            borderBottom: "1px solid var(--color-border-base, #e5e7eb)",
            background: "var(--color-surface-raised, #f9fafb)",
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg text-sm"
              style={{
                background: "var(--color-brand-10, #eff6ff)",
                color: "var(--color-brand-60, #2563eb)",
              }}
            >
              <i className="fas fa-table" />
            </div>
            <div>
              <h2
                className="text-base font-bold"
                style={{ color: "var(--color-text-default, #111827)" }}
              >
                {t("preview.title")}
              </h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--color-text-subtle, #6b7280)" }}>
                {t("preview.total")} <span className="font-semibold">{rows.length}{t("preview.row")}</span>
                {" · "}
                {detectedColumns.length}{t("preview.subtitle")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
            style={{ color: "var(--color-text-subtle, #6b7280)", background: "transparent" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "var(--color-fill-active, #f3f4f6)")
            }
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            aria-label={t("app.close")}
          >
            <i className="fas fa-times text-sm" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto">
          {rows.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center gap-3 py-16 text-center"
              style={{ color: "var(--color-text-subtle, #6b7280)" }}
            >
              <i className="fas fa-inbox text-4xl opacity-30" />
              <p className="text-sm">{t("preview.noData")}</p>
            </div>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead
                style={{
                  background: "var(--color-surface-raised, #f9fafb)",
                  position: "sticky",
                  top: 0,
                  zIndex: 1,
                }}
              >
                <tr>
                  <th
                    className="px-4 py-3 text-xs font-semibold tracking-wide"
                    style={{
                      color: "var(--color-text-subtle, #6b7280)",
                      borderBottom: "1px solid var(--color-border-base, #e5e7eb)",
                      minWidth: "40px",
                    }}
                  >
                    #
                  </th>
                  <th
                    className="px-3 py-3 text-xs font-semibold tracking-wide"
                    style={{
                      color: "var(--color-text-subtle, #6b7280)",
                      borderBottom: "1px solid var(--color-border-base, #e5e7eb)",
                      width: "64px",
                    }}
                  >
                    {t("preview.edit")}
                  </th>
                  {detectedColumns.map((col) => (
                    <th
                      key={col}
                      className="px-4 py-3 text-xs font-semibold tracking-wide"
                      style={{
                        color: "var(--color-text-subtle, #6b7280)",
                        borderBottom: "1px solid var(--color-border-base, #e5e7eb)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {t(COLUMN_LABEL_KEYS[col] ?? `field.${col}`, col)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <EditableModalRow
                    key={rowKey(row, index)}
                    row={row}
                    index={index}
                    columns={detectedColumns}
                    editingRowIndex={editingRowIndex}
                    onStartEdit={setEditingRowIndex}
                    onSave={handleSaveRow}
                    onCancel={handleCancelEdit}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between gap-3 px-6 py-4 shrink-0"
          style={{
            borderTop: "1px solid var(--color-border-base, #e5e7eb)",
            background: "var(--color-surface-raised, #f9fafb)",
          }}
        >
          <p className="text-xs" style={{ color: "var(--color-text-subtle, #6b7280)" }}>
            <i className="fas fa-info-circle mr-1" />
            {t("preview.tip")}
          </p>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn-base btn-secondary">
              <i className="fas fa-times mr-1.5" />
              {t("app.cancel")}
            </button>
            {onConfirm && rows.length > 0 && (
              <button type="button" onClick={handleConfirm} className="btn-base btn-primary">
                <i className="fas fa-check mr-1.5" />
                {t("preview.saveCount").replace("{count}", rows.length)}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EditableRow — inline editable row in the main table
// ─────────────────────────────────────────────────────────────────────────────
function EditableRow({
  row,
  index,
  columns,
  isEditing,
  onStartEdit,
  onSave,
  onCancel,
  isSelected,
  onToggleSelect,
}) {
  const [draft, setDraft] = useState({});
  const rowRef = useRef(null);

  const handleStartEdit = (e) => {
    e.stopPropagation();
    setDraft({ ...row });
    onStartEdit(index);
  };

  const handleSave = useCallback(
    (e) => {
      e?.stopPropagation();
      onSave(index, draft);
    },
    [index, draft, onSave],
  );

  const handleCancel = (e) => {
    e?.stopPropagation();
    onCancel();
  };

  // Enter / Escape
  useEffect(() => {
    if (!isEditing) return;
    const handler = (e) => {
      if (e.key === "Enter") handleSave(e);
      if (e.key === "Escape") handleCancel(e);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isEditing, handleSave]);

  // Save on outside click
  useEffect(() => {
    if (!isEditing) return;
    const handleOutsideClick = (e) => {
      if (rowRef.current && !rowRef.current.contains(e.target)) handleSave();
    };
    const timer = setTimeout(() => document.addEventListener("mousedown", handleOutsideClick), 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isEditing, handleSave]);

  return (
    <tr
      ref={rowRef}
      style={{
        borderBottom: "1px solid var(--color-border-base, #e5e7eb)",
        background: isEditing
          ? "#eff6ff"
          : isSelected
            ? "rgba(79, 70, 229, 0.05)"
            : index % 2 === 0
              ? "var(--color-surface-default, #fff)"
              : "var(--color-surface-raised, #f9fafb)",
        outline: isEditing ? "2px solid #2563eb" : "none",
        outlineOffset: "-1px",
      }}
    >
      {/* Checkbox */}
      <td className="px-4 py-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => {
            e.stopPropagation();
            onToggleSelect(index);
          }}
        />
      </td>

      {/* Edit controls */}
      <td className="px-3 py-2" style={{ whiteSpace: "nowrap" }}>
        {isEditing ? (
          <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
            <button
              type="button"
              onClick={handleSave}
              title="저장 (Enter)"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "28px",
                height: "28px",
                borderRadius: "5px",
                border: "none",
                background: "#16a34a",
                color: "#fff",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              <i className="fas fa-check" style={{ fontSize: "11px" }} />
            </button>
            <button
              type="button"
              onClick={handleCancel}
              title="취소 (Esc)"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "28px",
                height: "28px",
                borderRadius: "5px",
                border: "none",
                background: "#e5e7eb",
                color: "#6b7280",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              <i className="fas fa-times" style={{ fontSize: "11px" }} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleStartEdit}
            title="행 편집"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "28px",
              height: "28px",
              borderRadius: "5px",
              border: "none",
              background: "var(--color-brand-10, #eff6ff)",
              color: "var(--color-brand-60, #2563eb)",
              cursor: "pointer",
            }}
          >
            <i className="fas fa-pencil-alt" style={{ fontSize: "11px" }} />
          </button>
        )}
      </td>

      {columns.map((col) =>
        isEditing ? (
          <td key={col} style={{ padding: "4px 6px", minWidth: "100px" }}>
            <input
              style={{
                width: "100%",
                minWidth: "80px",
                padding: "5px 8px",
                fontSize: "12px",
                border: "1.5px solid #2563eb",
                borderRadius: "4px",
                background: "#fff",
                color: "#111",
                outline: "none",
              }}
              value={draft[col] ?? ""}
              onChange={(e) => setDraft((prev) => ({ ...prev, [col]: e.target.value }))}
              onClick={(e) => e.stopPropagation()}
            />
          </td>
        ) : (
          <td
            key={col}
            className="px-4 py-3 text-text-subtle whitespace-nowrap"
            style={{ maxWidth: "240px", overflow: "hidden", textOverflow: "ellipsis" }}
            title={String(row[col] ?? "")}
          >
            {row[col] == null || row[col] === "" ? "—" : String(row[col])}
          </td>
        ),
      )}
    </tr>
  );
}

const COLUMN_LABEL_KEYS = {
  process: "field.process",
  maintGroup: "field.maintenanceType",
  site: "field.site",
  representativeWork: "field.repWork",
  priority: "field.priority",
  category: "field.category",
  period: "field.period",
  work: "field.work",
  report: "field.report",
  equipmentCode: "field.equipmentCode",
  equipmentName: "field.equipmentName",
  situation: "field.situation",
  cause: "field.cause",
  bom: "field.bom",
  sparePart: "field.sparePart",
  hwBefore: "field.hwBefore",
  hwAfter: "field.hwAfter",
  swBefore: "field.swBefore",
  swAfter: "field.swAfter",
  woCode: "field.woCode",
  workedOn: "field.workedOn",
  type: "field.type",
  title: "field.title",
  author: "field.author",
  date: "field.date",
  role: "field.role",
  management: "field.management",
  maintId: "field.maintenance",
  maintGroupName: "field.maintenanceType",
  processName: "field.process",
  siteName: "field.site",
  representativeWorkName: "field.repWork",
  priorityName: "field.priority",
  categoryName: "field.category",
  version: "field.version",
};

// ─────────────────────────────────────────────────────────────────────────────
// Main SpecData component
// ─────────────────────────────────────────────────────────────────────────────
export default function SpecData({ data, onUpload, onExport, searchText }) {
  const { t } = useI18n();
  // null = "전체" (no filter applied); a number = selected id
  const [selectedProcessId, setSelectedProcessId] = useState(null);
  const [selectedMaintenanceId, setSelectedMaintenanceId] = useState(null);

  const fileInput = useRef(null);

  const [changeDataColumns, setChangeDataColumns] = useState([]);
  // null means still loading; object means loaded (may have empty arrays)
  const [filterPayload, setFilterPayload] = useState(null);
  const [filterError, setFilterError] = useState(null);
  const [changedRecords, setChangedRecords] = useState([]);

  // FIX 1: specDataId now has TWO sources:
  //   - columnDefsId: the `id` from the CHANGE_DATA_COLUMNS response root (initially 0)
  //   - specDataJsonId: the `id` captured from GET_SPEC_DATA specDataJson items
  // The POST payload uses specDataId which is resolved from these in priority order:
  //   specDataJsonId (if > 0) → columnDefsId (if > 0) → 0
  const [columnDefsId, setColumnDefsId] = useState(0);
  const [specDataJsonId, setSpecDataJsonId] = useState(0);

  // Derived: the id to use when POSTing — prefer the specDataJson id if available
  const specDataId = specDataJsonId > 0 ? specDataJsonId : columnDefsId;

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [editingIndex, setEditingIndex] = useState(null);
  const [previewRows, setPreviewRows] = useState(null);
  const [previewColumns, setPreviewColumns] = useState(null);
  const [importBusy, setImportBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [operationStatus, setOperationStatus] = useState({
    isVisible: false,
    status: "loading",
    message: "",
    autoClose: true,
  });

  // Show skeleton while filterPayload hasn't arrived yet
  const filterLoading = filterPayload === null && filterError === null;

  // ── Process list (flat) ───────────────────────────────────────────────────
  const processList = useMemo(() => filterPayload?.process ?? [], [filterPayload]);

  // ── Maintenance list — cascade-filtered by selected process ───────────────
  const maintenanceList = useMemo(() => {
    const all = filterPayload?.maintenance ?? [];
    if (!selectedProcessId) return all;
    return all.filter((m) => m.processId === selectedProcessId);
  }, [filterPayload, selectedProcessId]);

  // ── Process change → reset maintenance selection ──────────────────────────
  const handleProcessChange = (e) => {
    const val = e.target.value;
    setSelectedProcessId(val === "" ? null : Number(val));
    setSelectedMaintenanceId(null);
  };

  const handleMaintenanceChange = (e) => {
    const val = e.target.value;
    setSelectedMaintenanceId(val === "" ? null : Number(val));
  };

  // ── excelColumnName → jsonKey map ─────────────────────────────────────────
  const excelToJsonKey = useMemo(
    () => buildExcelToJsonKeyMap(changeDataColumns),
    [changeDataColumns],
  );

  // ── Helper to sort keys by mockup order ───────────────────────────────────
  const getColumnGroupIndex = useCallback((key) => {
    const groups = [
      ["process", "공정"],
      ["maintGroup", "maintType", "maintenanceType", "보전유형", "보전그룹", "보전파트"],
      ["equipmentCode", "설비코드"],
      ["equipmentName", "설비명"],
      ["version", "버전"],
      ["specName", "사양항목"],
      ["specValue", "사양값"]
    ];
    const idx = groups.findIndex(g => g.includes(key));
    return idx !== -1 ? idx : 999;
  }, []);

  // FIX 2: Columns ordered by `sequence` from changeDataColumns.
  // Falls back to dynamic key order if changeDataColumns is empty.
  const orderedJsonKeys = useMemo(() => {
    if (changeDataColumns.length === 0) return null; // signal: not ready yet
    return [...changeDataColumns]
      .sort((a, b) => a.sequence - b.sequence)
      .map((col) => col.jsonKey)
      .filter(Boolean);
  }, [changeDataColumns]);

  // ── Merge API-saved records with prop data (newest first, no duplicates) ──
  // We also remap all rows to English jsonKeys to keep keys consistent
  const combinedData = useMemo(() => {
    const remapRow = (row) => {
      if (!row) return row;
      return Object.entries(row).reduce((acc, [key, value]) => {
        const mappedKey = excelToJsonKey[key.trim()] ?? key;
        acc[mappedKey] = value;
        return acc;
      }, {});
    };

    const remappedData = data.map(remapRow);
    const remappedChangedRecords = changedRecords.map(remapRow);

    if (remappedChangedRecords.length === 0) return remappedData;
    const existingIds = new Set(remappedData.map((item) => item.id));
    const newRecords = remappedChangedRecords.filter((record) => !existingIds.has(record.id));
    return [...newRecords, ...remappedData];
  }, [data, changedRecords, excelToJsonKey]);

  // Columns to hide from the table display (used internally only)
  const HIDDEN_COLUMNS = new Set(["id"]);

  // FIX 2 (cont.): dynamicColumns respects sequence order when available;
  // falls back to Object.keys order when changeDataColumns hasn't loaded yet.
  // `id` and other internal keys are always excluded from display.
  const dynamicColumns = useMemo(() => {
    if (orderedJsonKeys && orderedJsonKeys.length > 0) {
      // Only include keys that actually exist in the data (avoid phantom columns)
      const dataKeys = combinedData.length > 0 ? new Set(Object.keys(combinedData[0])) : new Set();
      const sequenced = orderedJsonKeys.filter(
        (key) => dataKeys.has(key) && !HIDDEN_COLUMNS.has(key),
      );
      // Append any extra keys present in data but not in column defs, excluding hidden keys
      const extra =
        combinedData.length > 0
          ? Object.keys(combinedData[0]).filter(
              (k) => !orderedJsonKeys.includes(k) && !HIDDEN_COLUMNS.has(k),
            )
          : [];
      const merged = [...sequenced, ...extra];
      return merged.sort((a, b) => getColumnGroupIndex(a) - getColumnGroupIndex(b));
    }
    if (combinedData.length > 0) {
      const keys = Object.keys(combinedData[0]).filter((k) => !HIDDEN_COLUMNS.has(k));
      return keys.sort((a, b) => getColumnGroupIndex(a) - getColumnGroupIndex(b));
    }
    return [];
  }, [combinedData, orderedJsonKeys, getColumnGroupIndex]);

  // ── Filtered rows ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!selectedProcessId || !selectedMaintenanceId) {
      return [];
    }
    const selectedProcess = processList.find((p) => p.id === selectedProcessId);
    const selectedMaint = (filterPayload?.maintenance ?? []).find(
      (m) => m.id === selectedMaintenanceId,
    );

    return combinedData.filter((item) => {
      const matchesProc =
        (item.process ?? item.공정) === (selectedProcess?.processName ?? "");

      const matchesMaint =
        (item.maintGroup ?? item.보전파트 ?? item.보전그룹 ?? item.보전유형) ===
          (selectedMaint?.maintenanceGroupName ?? "");

      const text = Object.values(item)
        .map((v) => String(v ?? ""))
        .join(" ")
        .toLowerCase();
      const matchesSearch = searchText ? text.includes(searchText.toLowerCase()) : true;

      return matchesProc && matchesMaint && matchesSearch;
    });
  }, [
    combinedData,
    processList,
    filterPayload,
    selectedProcessId,
    selectedMaintenanceId,
    searchText,
  ]);

  // ── Multi-select ──────────────────────────────────────────────────────────
  const toggleSelect = (index) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(filtered.map((_, i) => i)));
  };

  useEffect(() => {
    setSelectedIds(new Set());
  }, [selectedProcessId, selectedMaintenanceId, searchText]);

  // ── Ref so handleModalConfirm / handleSaveRow can call getFilterData
  //    without a stale closure
  const getFilterDataRef = useRef(null);

  // ── Shared helper: build changeDataList from an array of rows ─────────────
  const buildChangeDataList = useCallback(
    (rows) => {
      const requiredFields = ["Site", "SpecName"];
      return rows.map((row) => {
        const remapped = remapRowKeys(row, excelToJsonKey);
        const defaultFields = requiredFields.reduce((acc, key) => {
          acc[key] = remapped[key] ?? "";
          return acc;
        }, {});
        return { ...remapped, ...defaultFields, id: remapped.id ?? 0 };
      });
    },
    [excelToJsonKey],
  );

  // ── Inline row save ────────────────────────────────────────────────────────
  const handleSaveRow = useCallback(
    (filteredIndex, draft) => {
      const originalRow = filtered[filteredIndex];
      const mergedRow = { ...originalRow, ...draft };

      const updatedRows = filtered.map((row, i) => (i === filteredIndex ? mergedRow : row));

      const SpecDataList = buildChangeDataList(updatedRows);
      const payload = { SpecDataList, id: specDataId };

      setOperationStatus({
        isVisible: true,
        status: "loading",
        message: t("toast.saving"),
        autoClose: false,
      });

      APIcallPost(pocEndPoints?.SAVE_SPEC_DATA, payload, {}, (responseData, status) => {
        if (status === 200) {
          setEditingIndex(null);
          setOperationStatus({
            isVisible: true,
            status: "success",
            message: `${SpecDataList.length} ${t("app.rows")} - ${t("toast.saveSuccess")}`,
            autoClose: true,
          });
          onUpload?.("spec_rows", payload);
          getFilterDataRef.current?.();
        } else {
          console.error("행 저장 실패:", responseData);
          setOperationStatus({
            isVisible: true,
            status: "error",
            message: t("toast.rowSaveError"),
            autoClose: true,
          });
        }
      });
    },
    [filtered, buildChangeDataList, onUpload, specDataId, t],
  );

  const handleCancelEdit = useCallback(() => setEditingIndex(null), []);

  // ── Modal confirm → POST ──────────────────────────────────────────────────
  const handleModalConfirm = useCallback(
    (updatedRows) => {
      const SpecDataList = buildChangeDataList(updatedRows);
      const payload = { SpecDataList, id: specDataId };

      APIcallPost(pocEndPoints?.SAVE_SPEC_DATA, payload, {}, (responseData, status) => {
        if (status === 200) {
          setPreviewRows(null);
          setPreviewColumns(null);
          setOperationStatus({
            isVisible: true,
            status: "success",
            message: `${SpecDataList.length} ${t("app.rows")} - ${t("toast.saveSuccess")}`,
            autoClose: true,
          });
          onUpload?.("spec_rows", payload);
          getFilterDataRef.current?.();
        } else {
          console.error("일괄 저장 실패:", responseData);
          setOperationStatus({
            isVisible: true,
            status: "error",
            message: t("toast.saveError"),
            autoClose: true,
          });
        }
      });
    },
    [buildChangeDataList, onUpload, specDataId, t],
  );

  // ── Upload Excel → parse via API → show preview modal ────────────────────
  const uploadExcelFile = useCallback(
    async (file, callback) => {
      const filterColumns = changeDataColumns
        .map((item) => item.excelColumnName)
        .filter(Boolean)
        .join(",");

      const url = `${pocEndPoints?.UPLOAD_EXCEL}?FilterColumns=${encodeURIComponent(
        filterColumns,
      )}&SheetName=sheet1`;

      const formData = new FormData();
      formData.append("UploadedBy", getUserInfo()?.name || "");
      formData.append("File", file);

      await APIcallPostFile(url, formData, {}, callback);
    },
    [changeDataColumns],
  );

  const handleUploadExcel = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";
    setImportBusy(true);
    setOperationStatus({
      isVisible: true,
      status: "loading",
      message: `${file.name} ${t("toast.uploading")}`,
      autoClose: false,
    });

    try {
      await withMinimumDelay(async () => {
        await uploadExcelFile(file, (res, statusCode) => {
          if (statusCode === 200) {
            setPreviewColumns(Array.isArray(res?.columnNames) ? res.columnNames : null);
            setPreviewRows(Array.isArray(res?.rows) ? res.rows : []);
            setOperationStatus({
              isVisible: true,
              status: "success",
              message: `${res?.rows?.length || 0} ${t("toast.rowsLoaded")}`,
              autoClose: true,
            });
          } else {
            setOperationStatus({
              isVisible: true,
              status: "error",
              message: t("toast.uploadFailed"),
              autoClose: true,
            });
          }
        });
      });
    } finally {
      setImportBusy(false);
    }
  };

  // ── Export filtered rows ──────────────────────────────────────────────────
  const handleExport = async () => {
    if (!filtered || filtered.length === 0) {
      setOperationStatus({
        isVisible: true,
        status: "error",
        message: t("toast.noRecordsExport"),
        autoClose: true,
      });
      return;
    }

    setExportBusy(true);
    setOperationStatus({
      isVisible: true,
      status: "loading",
      message: `${filtered.length} ${t("toast.exporting")}`,
      autoClose: false,
    });

    try {
      await withMinimumDelay(async () => {
        // FIX 2 (export): use sequence-ordered keys, same as table columns
        const exportCols =
          orderedJsonKeys && orderedJsonKeys.length > 0 ? orderedJsonKeys : dynamicColumns;

        const exportData = filtered.map((row) => {
          const orderedRow = {};
          exportCols.forEach((key) => {
            orderedRow[key] = row[key] ?? "";
          });
          return orderedRow;
        });

        const worksheet = XLSX.utils.json_to_sheet(exportData, { header: exportCols });
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Spec Data");
        XLSX.writeFile(workbook, "spec-data.xlsx");

        setOperationStatus({
          isVisible: true,
          status: "success",
          message: `${filtered.length} ${t("toast.exportSuccess")}`,
          autoClose: true,
        });
      });
    } catch (error) {
      console.error("Excel export failed:", error);
      setOperationStatus({
        isVisible: true,
        status: "error",
        message: t("toast.exportFailed"),
        autoClose: true,
      });
    } finally {
      setExportBusy(false);
    }
  };

  // ── Fetch filter data + specDataJson ──────────────────────────────────────
  const getFilterData = useCallback(() => {
    APIcallGet(`${pocEndPoints?.GET_SPEC_DATA}`, {}, (responseData, status) => {
      try {
        if (status === 200 && responseData) {
          const payload = responseData?.data || responseData;

          setFilterPayload(payload);

          if (Array.isArray(payload?.specDataJson)) {
            const allRecords = [];
            let capturedId = 0;

            payload.specDataJson.forEach((item) => {
              try {
                if (item.content) {
                  capturedId = item.id ?? capturedId;
                  const parsed =
                    typeof item.content === "string" ? JSON.parse(item.content) : item.content;
                  if (Array.isArray(parsed)) allRecords.push(...parsed);
                }
              } catch (parseError) {
                console.warn("[SpecData] Failed to parse specDataJson content:", parseError);
              }
            });

            allRecords.sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
            setChangedRecords(allRecords);
            setSpecDataJsonId(capturedId);
          } else {
            setChangedRecords([]);
            setSpecDataJsonId(0);
          }

          setFilterError(null);
        } else {
          console.warn("[SpecData] Filter API invalid status:", status);
          setFilterPayload({ process: [], maintenance: [] });
          setChangedRecords([]);
          setSpecDataJsonId(0);
          setFilterError(t("toast.filterLoadError"));
        }
      } catch (error) {
        console.error("[SpecData] Error processing filter data:", error);
        setFilterPayload({ process: [], maintenance: [] });
        setChangedRecords([]);
        setSpecDataJsonId(0);
        setFilterError(t("toast.filterError"));
      }
    });
  }, []);

  // Keep ref in sync
  useEffect(() => {
    getFilterDataRef.current = getFilterData;
  }, [getFilterData]);

  // ── Fetch column definitions on mount ────────────────────────────────────
  useEffect(() => {
    APIcallGet(`${pocEndPoints?.CHANGE_DATA_COLUMNS}/2`, {}, (responseData, status) => {
      if (status !== 200 || !responseData) return;

      // FIX 1: Capture `id` from the column definitions response root level.
      // The API returns { data: [...], id: 0, statusCode: 200, ... }
      // Even if id is 0 here, we store it; specDataJsonId from GET_SPEC_DATA
      // will take priority via the `specDataId` derived value above.
      const rootId = responseData?.id ?? 0;
      setColumnDefsId(rootId);

      if (Array.isArray(responseData) && responseData.length > 0) {
        setChangeDataColumns(responseData);
        return;
      }
      if (Array.isArray(responseData?.data) && responseData.data.length > 0) {
        setChangeDataColumns(responseData.data);
        return;
      }
      console.warn("[SpecData] Unexpected column API shape:", responseData);
    });
    getFilterData();
  }, [getFilterData]);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Shimmer animation for skeleton loaders */}
      <style>{`
        @keyframes shimmer {
          0%   { background-position:  200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      <section className="space-y-6">
        {/* Page header */}
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold text-text-default">{t("page.specData.title")}</h1>
            <p className="mt-2 text-sm text-text-subtle">
              {t("page.specData.desc")}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <AnimatedActionButton
              className="btn-secondary"
              onClick={() => fileInput.current?.click()}
              busy={importBusy}
              busyLabel="Loading..."
              icon="fas fa-file-import"
            >
              {t("app.importCsv")}
            </AnimatedActionButton>

            <input
              ref={fileInput}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={handleUploadExcel}
            />

            <AnimatedActionButton
              className="btn-primary"
              onClick={handleExport}
              busy={exportBusy}
              busyLabel="Exporting..."
              icon="fas fa-file-export"
            >
              {t("app.exportCsv")}
            </AnimatedActionButton>
          </div>
        </header>

        {/* Filters */}
        <div className="card p-4 mb-4">
          {filterError && (
            <div
              className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-start gap-2"
              role="alert"
            >
              <i className="fas fa-exclamation-circle mt-0.5 flex-shrink-0" />
              <div>{filterError}</div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              {/* 공정 (Process) */}
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold uppercase text-text-subtle">
                  {t("field.process")}
                </label>
                {filterLoading ? (
                  <SelectSkeleton width="120px" />
                ) : (
                  <select
                    className="input-base"
                    value={selectedProcessId ?? ""}
                    onChange={handleProcessChange}
                    style={{ width: "120px", marginTop: 0 }}
                  >
                    <option value="">{t("app.all")}</option>
                    {processList.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.processName}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* 보전유형 */}
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold uppercase text-text-subtle">
                  {t("field.maintenanceType")}
                </label>
                {filterLoading ? (
                  <SelectSkeleton width="140px" />
                ) : (
                  <select
                    className="input-base"
                    value={selectedMaintenanceId ?? ""}
                    onChange={handleMaintenanceChange}
                    disabled={maintenanceList.length === 0}
                    style={{ width: "140px", marginTop: 0 }}
                  >
                    <option value="">{t("app.all")}</option>
                    {maintenanceList.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.maintenanceGroupName}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Spacer + row count */}
            <div className="flex items-center">
              <span className="badge badge-primary">{filtered.length}{t("app.rows")}</span>
            </div>
          </div>
        </div>

        {/* Data table */}
        <div className="card overflow-hidden">
          {filtered.length === 0 ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 p-10 text-center text-text-subtle">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-10 text-brand-60 text-3xl">
                <i className="fas fa-microchip" />
              </div>
              <h2 className="text-xl font-bold text-text-default">
                {t("empty.noSpecMatch")}
              </h2>
              <p>{t("empty.specHint")}</p>
            </div>
          ) : (
            <div className="overflow-auto" style={{ height: "calc(100vh - 39vh)" }}>
              <table className="min-w-full text-left text-sm">
                <thead className="table-header">
                  <tr>
                    {/* Select-all */}
                    <th className="px-4 py-3 w-12">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === filtered.length && filtered.length > 0}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    {/* Edit column header */}
                    <th
                      className="px-3 py-3 text-text-subtle whitespace-nowrap"
                      style={{ fontSize: "11px", fontWeight: 600, width: "72px" }}
                    >
                      {t("app.edit")}
                    </th>
                    {dynamicColumns.map((col) => (
                      <th key={col} className="px-4 py-3 text-text-subtle whitespace-nowrap">
                        {t(COLUMN_LABEL_KEYS[col] ?? `field.${col}`, col)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row, index) => (
                    <EditableRow
                      key={rowKey(row, index)}
                      row={row}
                      index={index}
                      columns={dynamicColumns}
                      isEditing={editingIndex === index}
                      onStartEdit={setEditingIndex}
                      onSave={handleSaveRow}
                      onCancel={handleCancelEdit}
                      isSelected={selectedIds.has(index)}
                      onToggleSelect={toggleSelect}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Upload preview modal */}
      <UploadPreviewModal
        rows={previewRows}
        columns={previewColumns}
        onClose={() => {
          setPreviewRows(null);
          setPreviewColumns(null);
        }}
        onConfirm={handleModalConfirm}
      />

      {/* Operation status toast */}
      <OperationStatus
        isVisible={operationStatus.isVisible}
        status={operationStatus.status}
        message={operationStatus.message}
        autoClose={operationStatus.autoClose}
        onClose={() =>
          setOperationStatus({ isVisible: false, status: "loading", message: "", autoClose: true })
        }
      />
    </>
  );
}
