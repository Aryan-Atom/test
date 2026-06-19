import { useMemo, useState, useEffect, useCallback } from "react";
import { pocEndPoints } from "../axios/endPoints.js";
import { APIcallGet } from "../axios/apiCall.js";
import { useI18n } from "../i18n.jsx";
import { isStaticDataMode } from "../utils/staticDataMode.js";
import { specFilterDataAndTableData } from "./static-data/SpecData.js";

// ─────────────────────────────────────────────────────────────────────────────
// Version Sort Helpers
// ─────────────────────────────────────────────────────────────────────────────
const vkey = (v) => {
  const s = String(v).replace(/^V/i, "");
  if (s.includes("-")) {
    const p = s.split("-");
    const bp = p[0].split(".");
    return [
      parseInt(bp[0]) || 0,
      bp.length > 1 ? parseInt(bp[1]) : 0,
      parseInt(p[1]) || 0,
    ];
  }
  const p = s.split(".");
  return [parseInt(p[0]) || 0, p.length > 1 ? parseInt(p[1]) : 0, 0];
};

const vsort = (a, b) => {
  const ka = vkey(a);
  const kb = vkey(b);
  return ka[0] - kb[0] || ka[1] - kb[1] || ka[2] - kb[2];
};

// ─────────────────────────────────────────────────────────────────────────────
// SelectSkeleton
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
// Change indicator helpers (VIEW2)
// ─────────────────────────────────────────────────────────────────────────────
function ChangeIndicator({ curr, prev }) {
  const { t } = useI18n();
  if (prev == null || prev === "") return null; // first version — no comparison

  const currNum = parseFloat(String(curr).replace(/,/g, ""));
  const prevNum = parseFloat(String(prev).replace(/,/g, ""));

  // Numeric comparison
  if (!isNaN(currNum) && !isNaN(prevNum)) {
    if (currNum > prevNum)
      return (
        <span
          className="text-[#16a34a] font-bold text-[10px] ml-1 select-none"
          title={t("specMatrix.inc", "이전 대비 증가")}
        >
          ▲
        </span>
      );
    if (currNum < prevNum)
      return (
        <span
          className="text-[#dc2626] font-bold text-[10px] ml-1 select-none"
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
        className="inline-block w-[5px] h-[5px] rounded-full bg-[#ef4444] ml-1 align-middle animate-pulse"
        title={t("specMatrix.mod", "이전 버전에서 변경됨")}
      />
    );

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// VIEW1 — Equipment rows × spec columns
// ─────────────────────────────────────────────────────────────────────────────
function View1Table({ rows }) {
  const { t } = useI18n();
  
  // Collect all unique spec item names (column headers)
  const specCols = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => {
      if (r.specName ?? r.사양항목) set.add(r.specName ?? r.사양항목);
    });
    return [...set].sort();
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
    return [...map.values()].sort((a, b) => 
      a.eqName.localeCompare(b.eqName) || 
      a.eqCode.localeCompare(b.eqCode) || 
      vsort(a.ver, b.ver)
    );
  }, [rows]);

  const headerMap = {
    "설비ID": "field.equipmentId",
    "설비명": "field.equipmentName",
    "사양버전": "field.specVersion"
  };

  if (pivoted.length === 0) return null;

  return (
    <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 360px)" }}>
      <table className="w-full text-left text-sm" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
        <thead className="sticky top-0 z-10 bg-[#f8fafc]">
          <tr>
            {["설비ID", "설비명", "사양버전", ...specCols].map((col) => (
              <th
                key={col}
                className="px-4 py-3 text-xs font-bold text-[#475569] uppercase tracking-wider border-b-2 border-[#e2e8f0] whitespace-nowrap"
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
              className="border-b border-[#e2e8f0] last:border-0 hover:bg-[#f1f5f9] transition-colors"
            >
              <td className="px-4 py-3 font-bold text-[#1e293b] whitespace-nowrap">
                {row.eqCode || "—"}
              </td>
              <td className="px-4 py-3 font-bold text-[#1e293b] whitespace-nowrap">
                {row.eqName || "—"}
              </td>
              <td className="px-4 py-3 whitespace-nowrap align-middle">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#eff6ff] text-[#4f46e5]">
                  {row.ver || "—"}
                </span>
              </td>
              {specCols.map((col) => (
                <td
                  key={col}
                  className="px-4 py-3 text-[#475569] whitespace-nowrap max-w-[160px] overflow-hidden text-overflow-ellipsis"
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
// VIEW2 — Spec items as rows × versions as columns
// ─────────────────────────────────────────────────────────────────────────────
function View2Table({ rows, changedOnly }) {
  // Collect sorted unique versions
  const versions = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => set.add(r.version ?? r.버전 ?? ""));
    return [...set].sort(vsort);
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
    const changedRows = new Set();
    pivoted.forEach((row) => {
      for (let i = 1; i < versions.length; i++) {
        const prev = row.vals[versions[i - 1]] || "";
        const curr = row.vals[versions[i]] || "";
        if (prev && curr && String(curr) !== String(prev)) {
          changedRows.add(row.specName);
        }
      }
    });

    const result = pivoted.map((row) => ({
      ...row,
      isChanged: changedRows.has(row.specName)
    }));

    return {
      displayRows: changedOnly ? result.filter((r) => r.isChanged) : result,
      changedCount: changedRows.size,
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

  // ── Fetch spec data ──────────────────────────────────────────────────────
  const fetchData = useCallback(() => {
    if (isStaticDataMode) {
      const payload = specFilterDataAndTableData;
      setFilterPayload(payload);
      setFilterError(null);

      let allRecords = [];
      if (Array.isArray(payload?.specDataJson)) {
        payload.specDataJson.forEach((item) => {
          try {
            if (item.content) {
              const parsed =
                typeof item.content === "string" ? JSON.parse(item.content) : item.content;
              if (Array.isArray(parsed)) allRecords.push(...parsed);
            }
          } catch (e) {
            console.warn("[SpecMatrix] Failed to parse static specDataJson:", e);
          }
        });
      }

      const hasValidSpecs = allRecords.some((r) => r.specName && r.specName.trim() !== "");
      if (false && !hasValidSpecs) {
        const generatedSpecs = [];
        const numItems = ["온도", "압력", "전압", "전류", "RPM", "진동", "유량", "토크"];
        const txtItems = ["재질", "규격", "인증", "방식"];

        const getSpecValue = (p, t, it, v) => {
          const normalizedProc = p === "03.성형" || p === "BMS" ? "03.성형" : "04.성형";
          const normalizedMaint = t === "0307. ut coater" || t === "제어" ? "0307. ut coater" : "1307. ut coater";
          const normalizedVer = v === "1.0" || v === "V1.0" ? "V1.0" : v === "1.1" || v === "V2.0" ? "V2.0" : "V3.0";

          if (normalizedProc === '03.성형' && normalizedMaint === '0307. ut coater') {
            if (normalizedVer === 'V1.0') {
              const bmsMap = { 온도: '61.1', 압력: '56.9', 전압: '19.6', 전류: '26.2', RPM: '55.8', 진동: '77.3', 유량: '77.3', 토크: '95.5' };
              if (bmsMap[it] !== undefined) return bmsMap[it];
            }
            if (normalizedVer === 'V2.0') {
              const bmsMap2 = { 온도: '63.5', 압력: '56.9', 전압: '19.6', 전류: '25.8', RPM: '55.8', 진동: '77.3', 유량: '78.2', 토크: '95.5' };
              if (bmsMap2[it] !== undefined) return bmsMap2[it];
            }
            if (normalizedVer === 'V3.0') {
              const bmsMap3 = { 온도: '65.2', 압력: '57.4', 전압: '19.6', 전류: '25.8', RPM: '56.1', 진동: '77.3', 유량: '78.2', 토크: '95.5' };
              if (bmsMap3[it] !== undefined) return bmsMap3[it];
            }
          }

          const txtVals = {
            재질: ['SUS304', 'SUS316', 'SUS630'],
            규격: ['A급', 'B급', 'S급'],
            인증: ['CE', 'UL', 'KC'],
            방식: ['수동', '자동', '반자동']
          };
          if (txtVals[it]) {
            const idx = (normalizedVer === 'V1.0' ? 0 : normalizedVer === 'V2.0' ? 1 : 2);
            return txtVals[it][idx];
          }

          const str = `${p}-${t}-${it}-${v}`;
          let hash = 0;
          for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
          }
          const val = Math.abs(hash % 1000) / 10;
          return val.toFixed(1);
        };

        const procs = payload.process ?? [];
        const maints = payload.maintenance ?? [];
        const equipments = payload.equipments ?? [];

        equipments.forEach((eq) => {
          if (!eq.equipmentCode) return;

          const proc = procs.find((p) => p.id === eq.processId);
          const maint = maints.find((m) => m.processId === eq.processId);

          if (proc && maint) {
            ["1.0", "1.1", "1.2"].forEach((v) => {
              numItems.forEach((it) => {
                generatedSpecs.push({
                  process: proc.processName,
                  maintGroup: maint.maintenanceGroupName,
                  equipmentName: eq.equipmentName,
                  equipmentCode: eq.equipmentCode,
                  specName: it,
                  version: v,
                  specValue: getSpecValue(proc.processName, maint.maintenanceGroupName, it, v),
                });
              });
              txtItems.forEach((it) => {
                generatedSpecs.push({
                  process: proc.processName,
                  maintGroup: maint.maintenanceGroupName,
                  equipmentName: eq.equipmentName,
                  equipmentCode: eq.equipmentCode,
                  specName: it,
                  version: v,
                  specValue: getSpecValue(proc.processName, maint.maintenanceGroupName, it, v),
                });
              });
            });
          }
        });
        allRecords = generatedSpecs;
      }

      setSpecRows(allRecords);
      return;
    }

    APIcallGet(`${pocEndPoints?.GET_SPEC_DATA}`, {}, (responseData, status) => {
      try {
        if (status === 200 && responseData) {
          const payload = responseData?.data || responseData;
          setFilterPayload(payload);
          setFilterError(null);

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
    return ["전체", ...[...set].sort(vsort)];
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
        (item.maintGroup ?? item.보전파트 ?? item.보전그룹 ?? item.보전유형) ===
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
        .row-changed td {
          background-color: rgba(239, 68, 68, 0.05) !important;
        }
        .row-changed:hover td {
          background-color: rgba(239, 68, 68, 0.09) !important;
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
          <div className="flex border-b border-[#e2e8f0]">
            <button
              type="button"
              className={`px-5 py-2.5 text-sm font-bold border-b-2 transition-all duration-150 ${
                view === "view1"
                  ? "border-[#4f46e5] text-[#4f46e5]"
                  : "border-transparent text-[#6b7280] hover:text-[#4f46e5]"
              }`}
              onClick={() => setView("view1")}
            >
              {t("specMatrix.view1", "장비별 사양 (VIEW1)")}
            </button>
            <button
              type="button"
              className={`px-5 py-2.5 text-sm font-bold border-b-2 transition-all duration-150 ${
                view === "view2"
                  ? "border-[#4f46e5] text-[#4f46e5]"
                  : "border-transparent text-[#6b7280] hover:text-[#4f46e5]"
              }`}
              onClick={() => setView("view2")}
            >
              {t("specMatrix.view2", "버전별 비교 (VIEW2)")}
            </button>
          </div>
        </header>

        {/* Filters */}
        <div className="bg-white border border-[#e2e8f0] rounded-[16px] shadow-sm p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-6">
            {/* 공정 */}
            <div className="flex items-center gap-2">
              <label className="text-[11px] font-extrabold uppercase text-[#475569] tracking-wider">
                {t("field.process", "공정")}
              </label>
              {filterLoading ? (
                <SelectSkeleton width="110px" />
              ) : (
                <select
                  className="input-base bg-white border border-[#e2e8f0] focus:border-[#4f46e5] focus:ring-1 focus:ring-[#4f46e5] outline-none rounded-lg px-3 py-1.5 text-sm font-medium transition-all"
                  style={{ width: "110px" }}
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
            </div>

            {/* 보전유형 */}
            <div className="flex items-center gap-2">
              <label className="text-[11px] font-extrabold uppercase text-[#475569] tracking-wider">
                {t("field.maintenanceType", "보전유형")}
              </label>
              {filterLoading ? (
                <SelectSkeleton width="130px" />
              ) : (
                <select
                  className="input-base bg-white border border-[#e2e8f0] focus:border-[#4f46e5] focus:ring-1 focus:ring-[#4f46e5] outline-none rounded-lg px-3 py-1.5 text-sm font-medium transition-all"
                  style={{ width: "130px" }}
                  value={selectedTypeId ?? ""}
                  onChange={handleTypeChange}
                  disabled={!selectedProcessId}
                >
                  <option value="">{t("app.all", "전체")}</option>
                  {maintenanceList.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.maintenanceGroupName}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* 버전 */}
            <div className="flex items-center gap-2">
              <label className="text-[11px] font-extrabold uppercase text-[#475569] tracking-wider">
                {t("field.version", "버전")}
              </label>
              {filterLoading ? (
                <SelectSkeleton width="110px" />
              ) : (
                <select
                  className="input-base bg-white border border-[#e2e8f0] focus:border-[#4f46e5] focus:ring-1 focus:ring-[#4f46e5] outline-none rounded-lg px-3 py-1.5 text-sm font-medium transition-all"
                  style={{ width: "110px" }}
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
            </div>

            {/* 변경 항목만 toggle */}
            <div className="flex items-center gap-3">
              <label className="text-[11px] font-extrabold uppercase text-[#475569] tracking-wider">
                {t("specMatrix.changesOnly", "변경 항목만")}
              </label>
              <button
                type="button"
                onClick={() => setChangedOnly((p) => !p)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  changedOnly ? "bg-[#4f46e5]" : "bg-slate-200"
                }`}
                aria-pressed={changedOnly}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    changedOnly ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Badges */}
          <div className="flex items-center gap-2">
            <span className="badge badge-primary">
              {totalCount}
              {t("app.rows", "건")}
            </span>
            {view === "view2" && changedCount > 0 && (
              <span className="badge badge-danger">
                {changedCount} {t("specMatrix.changed", "변경")}
              </span>
            )}
          </div>
        </div>

        {/* Data table card */}
        <div className="card overflow-hidden bg-white border border-[#e2e8f0] rounded-[16px] shadow-sm" style={{ minHeight: "360px" }}>
          {filterError && (
            <div className="p-5">
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-start gap-2">
                <i className="fas fa-exclamation-circle mt-0.5 flex-shrink-0" />
                <div>{filterError}</div>
              </div>
            </div>
          )}

          {view === "view1" ? (
            filtered.length === 0 ? (
              <div className="flex min-h-[360px] flex-col items-center justify-center gap-4 p-10 text-center relative flex-1">
                <div className="flex h-20 w-20 items-center justify-center rounded-full mx-auto mb-2 bg-[#eff6ff]">
                  <i className="fas fa-inbox text-4xl text-[#93c5fd]" />
                </div>
                <h3 className="text-lg font-bold text-text-default mb-1">
                  {t("app.noData", "조건에 맞는 데이터가 없습니다.")}
                </h3>
              </div>
            ) : (
              <View1Table rows={filtered} />
            )
          ) : (
            view2Rows.length === 0 ? (
              <div className="flex min-h-[360px] flex-col items-center justify-center gap-4 p-10 text-center relative flex-1">
                <div className="flex h-20 w-20 items-center justify-center rounded-full mx-auto mb-2 bg-[#eff6ff]">
                  <i className="fas fa-inbox text-4xl text-[#93c5fd]" />
                </div>
                <h3 className="text-lg font-bold text-text-default mb-1">
                  {t("app.noData", "조건에 맞는 데이터가 없습니다.")}
                </h3>
              </div>
            ) : (
              <View2TableRender rows={view2Rows} versions={view2Versions} />
            )
          )}
        </div>
      </section>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VIEW2 render component
// ─────────────────────────────────────────────────────────────────────────────
function View2TableRender({ rows, versions }) {
  const { t } = useI18n();
  return (
    <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 360px)" }}>
      <table className="w-full text-left text-sm" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
        <thead className="sticky top-0 z-10 bg-[#f8fafc]">
          <tr>
            <th
              className="px-4 py-3 text-xs font-bold text-[#475569] uppercase tracking-wider border-b-2 border-[#e2e8f0]"
              style={{ minWidth: "120px" }}
            >
              {t("field.specName", "사양항목")}
            </th>
            {versions.map((ver) => (
              <th
                key={ver}
                className="px-4 py-3 text-xs font-bold tracking-wider text-center border-b-2 border-[#e2e8f0] text-[#4f46e5] whitespace-nowrap min-w-[100px]"
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
              className={`border-b border-[#e2e8f0] last:border-0 transition-colors ${
                row.isChanged ? "row-changed" : "hover:bg-[#f1f5f9]"
              }`}
            >
              <td className="px-4 py-3 font-bold text-[#1e293b] whitespace-nowrap">
                {row.specName || "—"}
              </td>
              {versions.map((ver, i) => {
                const curr = row.vals[ver];
                const prev = i > 0 ? row.vals[versions[i - 1]] : null;
                return (
                  <td
                    key={ver}
                    className="px-4 py-3 text-center text-[#475569] whitespace-nowrap"
                    title={String(curr ?? "")}
                  >
                    {curr != null && curr !== "" ? (
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
// eslint-disable-next-line no-unused-vars
function EmptyState() {
  const { t } = useI18n();
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center gap-4 p-10 text-center relative flex-1">
      <div
        className="flex h-20 w-20 items-center justify-center rounded-full mx-auto mb-2"
        style={{
          backgroundColor: "var(--brand-10, #eff6ff)",
          animation: "float 4s ease-in-out infinite",
        }}
      >
        <i className="fas fa-microscope text-4xl text-brand-60" style={{ color: "var(--primary-light, #93c5fd)" }} />
      </div>
      <h3 className="text-lg font-bold text-text-default mb-1">
        {t("specMatrix.emptyTitle", "공정 및 보전유형을 선택하세요")}
      </h3>
      <p className="text-sm text-text-subtle max-w-[360px] mx-auto">
        {t("specMatrix.emptyDesc", "상단 필터에서 공정과 보전유형을 먼저 선택하면 사양 매트릭스가 표시됩니다.")}
      </p>
    </div>
  );
}
