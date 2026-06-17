import { useMemo, useState, useEffect, useCallback } from "react";
import { pocEndPoints } from "../axios/endPoints.js";
import { APIcallGet } from "../axios/apiCall.js";
import { useI18n } from "../i18n.jsx";

// ─────────────────────────────────────────────────────────────────────────────
// SelectSkeleton
// ─────────────────────────────────────────────────────────────────────────────
function SelectSkeleton() {
  return (
    <div
      style={{
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
// Change indicator helpers (VIEW2)
// ─────────────────────────────────────────────────────────────────────────────
function ChangeIndicator({ curr, prev }) {
  const { t } = useI18n();
  if (prev == null) return null; // first version — no comparison

  const currNum = parseFloat(curr);
  const prevNum = parseFloat(prev);

  // Numeric comparison
  if (!isNaN(currNum) && !isNaN(prevNum)) {
    if (currNum > prevNum)
      return (
        <span
          style={{ color: "#16a34a", fontSize: "10px", marginLeft: "3px", fontWeight: 700 }}
          title={t("specMatrix.inc", "이전 대비 증가")}
        >
          ▲
        </span>
      );
    if (currNum < prevNum)
      return (
        <span
          style={{ color: "#dc2626", fontSize: "10px", marginLeft: "3px", fontWeight: 700 }}
          title={t("specMatrix.dec", "이전 대비 감소")}
        >
          ▼
        </span>
      );
    return null; // same value
  }

  // String comparison
  if (String(curr) !== String(prev))
    return (
      <span
        style={{
          display: "inline-block",
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: "#f59e0b",
          marginLeft: "4px",
          verticalAlign: "middle",
        }}
        title={t("specMatrix.mod", "이전 버전에서 변경됨")}
      />
    );

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// VIEW1 — Equipment rows × spec columns
// Each unique (설비코드, 설비명, 버전) → one row
// Spec items become dynamic columns
// ─────────────────────────────────────────────────────────────────────────────
function View1Table({ rows }) {
  const { t } = useI18n();
  // Collect all unique spec item names (column headers)
  const specCols = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => {
      if (r.specName ?? r.사양항목) set.add(r.specName ?? r.사양항목);
    });
    return [...set];
  }, [rows]);

  // Pivot: group by (equipmentCode, equipmentName, version) → map of specName→value
  const pivoted = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => {
      const eqCode = r.equipmentCode ?? r.설비코드 ?? "";
      const eqName = r.equipmentName ?? r.설비명 ?? "";
      const ver = r.version ?? r.버전 ?? "";
      const key = `${eqCode}||${eqName}||${ver}`;
      if (!map.has(key)) map.set(key, { eqCode, eqName, ver, specs: {} });
      const specName = r.specName ?? r.사양항목 ?? "";
      const specVal = r.specValue ?? r.사양값 ?? "";
      map.get(key).specs[specName] = specVal;
    });
    return [...map.values()];
  }, [rows]);

  const headerMap = {
    "설비ID": "field.equipmentId",
    "설비명": "field.equipmentName",
    "사양버전": "field.specVersion"
  };

  if (pivoted.length === 0) return null;

  return (
    <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 42vh)" }}>
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
            {["설비ID", "설비명", "사양버전", ...specCols].map((col) => (
              <th
                key={col}
                className="px-4 py-3 text-xs font-semibold tracking-wide whitespace-nowrap"
                style={{
                  color: "var(--color-text-subtle, #6b7280)",
                  borderBottom: "1px solid var(--color-border-base, #e5e7eb)",
                }}
              >
                {headerMap[col] ? t(headerMap[col], col) : col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pivoted.map((row, idx) => (
            <tr
              key={`${row.eqCode}-${row.ver}-${idx}`}
              style={{
                borderBottom: "1px solid var(--color-border-base, #e5e7eb)",
                background:
                  idx % 2 === 0
                    ? "var(--color-surface-default, #fff)"
                    : "var(--color-surface-raised, #f9fafb)",
              }}
            >
              <td
                className="px-4 py-3 font-bold whitespace-nowrap"
                style={{ color: "var(--color-text-default, #111827)" }}
              >
                {row.eqCode || "—"}
              </td>
              <td
                className="px-4 py-3 font-bold whitespace-nowrap"
                style={{ color: "var(--color-text-default, #111827)" }}
              >
                {row.eqName || "—"}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "2px 10px",
                    borderRadius: "9999px",
                    fontSize: "11px",
                    fontWeight: 600,
                    background: "var(--color-brand-10, #eff6ff)",
                    color: "var(--color-brand-60, #2563eb)",
                  }}
                >
                  {row.ver || "—"}
                </span>
              </td>
              {specCols.map((col) => (
                <td
                  key={col}
                  className="px-4 py-3 whitespace-nowrap"
                  style={{
                    color: "var(--color-text-subtle, #6b7280)",
                    maxWidth: "160px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                  title={String(row.specs[col] ?? "")}
                >
                  {row.specs[col] ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VIEW2 — Spec items as rows × versions as columns with change indicators
// Groups by (equipmentCode, specName) — versions become column headers
// ─────────────────────────────────────────────────────────────────────────────
function View2Table({ rows, changedOnly }) {
  // Collect sorted unique versions
  const versions = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => set.add(r.version ?? r.버전 ?? ""));
    return [...set].sort();
  }, [rows]);

  // Pivot: group by (equipmentCode, specName) → { ver: value }
  const pivoted = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => {
      const eqCode = r.equipmentCode ?? r.설비코드 ?? "";
      const specName = r.specName ?? r.사양항목 ?? "";
      const ver = r.version ?? r.버전 ?? "";
      const val = r.specValue ?? r.사양값 ?? "";
      const key = `${eqCode}||${specName}`;
      if (!map.has(key)) map.set(key, { eqCode, specName, vals: {} });
      map.get(key).vals[ver] = val;
    });
    return [...map.values()];
  }, [rows]);

  // Count changed cells (value differs from previous version)
  const { displayRows, changedCount } = useMemo(() => {
    let changed = 0;
    const result = pivoted.map((row) => {
      let isChanged = false;
      versions.forEach((ver, i) => {
        if (i === 0) return;
        const prev = row.vals[versions[i - 1]];
        const curr = row.vals[ver];
        if (prev != null && curr != null && String(curr) !== String(prev)) {
          isChanged = true;
          changed++;
        }
      });
      return { ...row, isChanged };
    });
    return {
      displayRows: changedOnly ? result.filter((r) => r.isChanged) : result,
      changedCount: changed,
    };
  }, [pivoted, versions, changedOnly]);

  return { displayRows, changedCount, versions };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main SpecMatrix component
// ─────────────────────────────────────────────────────────────────────────────
export default function SpecMatrix({ searchText }) {
  const { t } = useI18n();
  const [view, setView] = useState("view1");
  const [filterPayload, setFilterPayload] = useState(null);
  const [filterError, setFilterError] = useState(null);
  const [specRows, setSpecRows] = useState([]);

  const [selectedProcessId, setSelectedProcessId] = useState(null);
  const [selectedTypeId, setSelectedTypeId] = useState(null);
  const [selectedVersion, setSelectedVersion] = useState("전체");
  const [changedOnly, setChangedOnly] = useState(false);

  const filterLoading = filterPayload === null && filterError === null;

  // ── Fetch filter + spec data ──────────────────────────────────────────────
  const fetchData = useCallback(() => {
    APIcallGet(`${pocEndPoints?.GET_SPEC_DATA}`, {}, (responseData, status) => {
      try {
        if (status === 200 && responseData) {
          const payload = responseData?.data || responseData;
          setFilterPayload(payload);
          setFilterError(null);

          // Parse specDataJson into flat rows (same pattern as SpecData)
          if (Array.isArray(payload?.specDataJson)) {
            const allRecords = [];
            payload.specDataJson.forEach((item) => {
              try {
                if (item.content) {
                  const parsed =
                    typeof item.content === "string" ? JSON.parse(item.content) : item.content;
                  if (Array.isArray(parsed)) allRecords.push(...parsed);
                }
              } catch (e) {
                console.warn("[SpecMatrix] Failed to parse specDataJson content:", e);
              }
            });
            setSpecRows(allRecords);
          } else {
            setSpecRows([]);
          }
        } else {
          setFilterPayload({ process: [], maintenance: [] });
          setSpecRows([]);
          setFilterError(t("toast.filterLoadError", "필터 데이터를 불러올 수 없습니다."));
        }
      } catch (err) {
        console.error("[SpecMatrix] Error processing data:", err);
        setFilterPayload({ process: [], maintenance: [] });
        setSpecRows([]);
        setFilterError(t("toast.filterError", "데이터 처리 중 오류가 발생했습니다."));
      }
    });
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Filter option lists ───────────────────────────────────────────────────
  const processList = useMemo(() => filterPayload?.process ?? [], [filterPayload]);

  // Maintenance list cascades from selected process
  const maintenanceList = useMemo(() => {
    const all = filterPayload?.maintenance ?? [];
    if (!selectedProcessId) return all;
    return all.filter((m) => m.processId === selectedProcessId);
  }, [filterPayload, selectedProcessId]);

  // All unique versions from spec rows
  const versionList = useMemo(() => {
    const set = new Set(specRows.map((r) => r.version ?? r.버전 ?? "").filter(Boolean));
    return ["전체", ...[...set].sort()];
  }, [specRows]);

  // ── Reset maintenance when process changes ────────────────────────────────
  const handleProcessChange = (e) => {
    const val = e.target.value;
    setSelectedProcessId(val === "" ? null : Number(val));
    setSelectedTypeId(null);
  };

  const handleTypeChange = (e) => {
    const val = e.target.value;
    setSelectedTypeId(val === "" ? null : Number(val));
  };

  // ── Apply all filters to spec rows ────────────────────────────────────────
  const filtered = useMemo(() => {
    const selectedProcess = processList.find((p) => p.id === selectedProcessId);
    const selectedMaint = (filterPayload?.maintenance ?? []).find((m) => m.id === selectedTypeId);

    return specRows.filter((item) => {
      const matchesProc =
        !selectedProcessId || (item.process ?? item.공정) === (selectedProcess?.processName ?? "");

      const matchesMaint =
        !selectedTypeId ||
        (item.maintGroup ?? item.보전파트 ?? item.보전그룹) ===
          (selectedMaint?.maintenanceGroupName ?? "");

      const matchesVer =
        selectedVersion === "전체" || (item.version ?? item.버전) === selectedVersion;

      const text = (
        String(item.equipmentName ?? item.설비명 ?? "") +
        String(item.specName ?? item.사양항목 ?? "") +
        String(item.specValue ?? item.사양값 ?? "")
      ).toLowerCase();
      const matchesSearch = searchText ? text.includes(searchText.toLowerCase()) : true;

      return matchesProc && matchesMaint && matchesVer && matchesSearch;
    });
  }, [
    specRows,
    processList,
    filterPayload,
    selectedProcessId,
    selectedTypeId,
    selectedVersion,
    searchText,
  ]);

  // ── VIEW2 pivot + change counts ───────────────────────────────────────────
  // We call the View2Table function as a hook-like helper to get derived data
  const view2Data = View2Table({ rows: filtered, changedOnly });
  const { displayRows: view2Rows, changedCount, versions: view2Versions } = view2Data;

  // ── Counts for badges ─────────────────────────────────────────────────────
  const totalCount = view === "view1" ? filtered.length : view2Rows.length;

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes shimmer {
          0%   { background-position:  200% 0; }
          100% { background-position: -200% 0; }
        }
        .spec-tab-btn {
          padding: 8px 18px;
          font-size: 13px;
          font-weight: 600;
          border: none;
          background: transparent;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          color: var(--color-text-subtle, #6b7280);
          transition: color 0.15s, border-color 0.15s;
          white-space: nowrap;
        }
        .spec-tab-btn.active {
          color: var(--color-brand-60, #2563eb);
          border-bottom-color: var(--color-brand-60, #2563eb);
        }
        .row-changed-bg {
          background: #fffbeb !important;
        }
      `}</style>

      <section className="space-y-6">
        {/* Page header */}
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold text-text-default">{t("page.specMatrix.title", "사양 매트릭스")}</h1>
            <p className="mt-2 text-sm text-text-subtle">
              {t("page.specMatrix.desc", "설비별 사양 항목과 버전 간 비교를 확인합니다.")}
            </p>
          </div>

          {/* Tab switcher */}
          <div
            style={{
              display: "flex",
              borderBottom: "1px solid var(--color-border-base, #e5e7eb)",
            }}
          >
            <button
              type="button"
              className={`spec-tab-btn ${view === "view1" ? "active" : ""}`}
              onClick={() => setView("view1")}
            >
              {t("specMatrix.view1", "장비별 사양 (VIEW1)")}
            </button>
            <button
              type="button"
              className={`spec-tab-btn ${view === "view2" ? "active" : ""}`}
              onClick={() => setView("view2")}
            >
              {t("specMatrix.view2", "버전별 비교 (VIEW2)")}
            </button>
          </div>
        </header>

        {/* Filters */}
        <div className="card p-5">
          {filterError && (
            <div
              className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-start gap-2"
              role="alert"
            >
              <i className="fas fa-exclamation-circle mt-0.5 flex-shrink-0" />
              <div>{filterError}</div>
            </div>
          )}

          <div className="flex flex-wrap items-end gap-4">
            {/* 공정 */}
            <label className="space-y-1.5 text-xs font-bold uppercase text-text-subtle">
              {t("field.process", "공정")}
              {filterLoading ? (
                <SelectSkeleton />
              ) : (
                <select
                  className="input-base"
                  style={{ minWidth: "120px" }}
                  value={selectedProcessId ?? ""}
                  onChange={handleProcessChange}
                >
                  <option value="">{t("app.all", "전체")}</option>
                  {processList.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.processName}
                    </option>
                  ))}
                </select>
              )}
            </label>

            {/* 보전유형 */}
            <label className="space-y-1.5 text-xs font-bold uppercase text-text-subtle">
              {t("field.maintenanceGroup", "보전유형")}
              {filterLoading ? (
                <SelectSkeleton />
              ) : (
                <select
                  className="input-base"
                  style={{ minWidth: "150px" }}
                  value={selectedTypeId ?? ""}
                  onChange={handleTypeChange}
                  disabled={maintenanceList.length === 0}
                >
                  <option value="">{t("app.all", "전체")}</option>
                  {maintenanceList.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.maintenanceGroupName}
                    </option>
                  ))}
                </select>
              )}
            </label>

            {/* 버전 — hidden in VIEW2 since versions become columns */}
            {view === "view1" && (
              <label className="space-y-1.5 text-xs font-bold uppercase text-text-subtle">
                {t("field.version", "버전")}
                {filterLoading ? (
                  <SelectSkeleton />
                ) : (
                  <select
                    className="input-base"
                    style={{ minWidth: "140px" }}
                    value={selectedVersion}
                    onChange={(e) => setSelectedVersion(e.target.value)}
                  >
                    {versionList.map((v) => (
                      <option key={v} value={v}>
                        {v === "전체" ? t("app.all", "전체") : v}
                      </option>
                    ))}
                  </select>
                )}
              </label>
            )}

            {/* 변경 항목만 toggle — VIEW2 only */}
            {view === "view2" && (
              <label className="space-y-1.5 text-xs font-bold uppercase text-text-subtle">
                {t("specMatrix.changesOnly", "변경 항목만")}
                <div style={{ paddingTop: "4px" }}>
                  <button
                    type="button"
                    onClick={() => setChangedOnly((p) => !p)}
                    style={{
                      position: "relative",
                      display: "inline-flex",
                      alignItems: "center",
                      width: "44px",
                      height: "24px",
                      borderRadius: "9999px",
                      border: "none",
                      cursor: "pointer",
                      background: changedOnly
                        ? "var(--color-brand-60, #2563eb)"
                        : "var(--color-border-base, #d1d5db)",
                      transition: "background 0.2s",
                      padding: 0,
                    }}
                    aria-pressed={changedOnly}
                  >
                    <span
                      style={{
                        position: "absolute",
                        left: changedOnly ? "22px" : "2px",
                        width: "20px",
                        height: "20px",
                        borderRadius: "50%",
                        background: "#fff",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                        transition: "left 0.2s",
                      }}
                    />
                  </button>
                </div>
              </label>
            )}

            {/* Badges */}
            <div className="ml-auto flex items-end gap-2 pb-0.5">
              <span className="badge badge-primary">{totalCount}{t("app.rows", "건")}</span>
              {view === "view2" && changedCount > 0 && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "2px 10px",
                    borderRadius: "9999px",
                    fontSize: "11px",
                    fontWeight: 600,
                    background: "#fee2e2",
                    color: "#dc2626",
                  }}
                >
                  {changedCount} {t("specMatrix.changed", "변경")}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Data table */}
        <div className="card overflow-hidden" style={{ minHeight: "300px" }}>
          {view === "view1" && (
            <>{filtered.length === 0 ? <EmptyState /> : <View1Table rows={filtered} />}</>
          )}

          {view === "view2" && (
            <>
              {view2Rows.length === 0 ? (
                <EmptyState />
              ) : (
                <View2TableRender rows={view2Rows} versions={view2Versions} />
              )}
            </>
          )}
        </div>
      </section>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VIEW2 render component (separate from the hook-like helper above)
// ─────────────────────────────────────────────────────────────────────────────
function View2TableRender({ rows, versions }) {
  const { t } = useI18n();
  return (
    <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 42vh)" }}>
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
                textAlign: "left",
                minWidth: "120px",
              }}
            >
              {t("field.specName", "사양항목")}
            </th>
            {versions.map((ver) => (
              <th
                key={ver}
                className="px-4 py-3 text-xs font-semibold tracking-wide text-center"
                style={{
                  color: "var(--color-brand-60, #2563eb)",
                  borderBottom: "1px solid var(--color-border-base, #e5e7eb)",
                  whiteSpace: "nowrap",
                  minWidth: "100px",
                }}
              >
                {ver}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={`${row.eqCode}-${row.specName}-${idx}`}
              className={row.isChanged ? "row-changed-bg" : ""}
              style={{
                borderBottom: "1px solid var(--color-border-base, #e5e7eb)",
                background: row.isChanged
                  ? "#fffbeb"
                  : idx % 2 === 0
                    ? "var(--color-surface-default, #fff)"
                    : "var(--color-surface-raised, #f9fafb)",
              }}
            >
              <td
                className="px-4 py-3 font-bold whitespace-nowrap"
                style={{ color: "var(--color-text-default, #111827)" }}
              >
                {row.specName || "—"}
              </td>
              {versions.map((ver, i) => {
                const curr = row.vals[ver];
                const prev = i > 0 ? row.vals[versions[i - 1]] : null;
                return (
                  <td
                    key={ver}
                    className="px-4 py-3 text-center whitespace-nowrap"
                    style={{ color: "var(--color-text-subtle, #6b7280)" }}
                    title={String(curr ?? "")}
                  >
                    {curr != null ? (
                      <>
                        {String(curr)}
                        <ChangeIndicator curr={curr} prev={prev} />
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EmptyState
// ─────────────────────────────────────────────────────────────────────────────
function EmptyState() {
  const { t } = useI18n();
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 p-10 text-center text-text-subtle">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-10 text-brand-60 text-3xl">
        <i className="fas fa-microscope" />
      </div>
      <h2 className="text-xl font-bold text-text-default">{t("specMatrix.emptyTitle", "공정 및 보전유형을 선택하세요")}</h2>
      <p>{t("specMatrix.emptyDesc", "상단 필터에서 공정과 보전유형을 먼저 선택하면 사양 매트릭스가 표시됩니다.")}</p>
    </div>
  );
}
