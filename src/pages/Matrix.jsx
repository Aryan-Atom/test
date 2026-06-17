import { useMemo, useState, useEffect, useCallback } from "react";
import { APIcallGet } from "../axios/apiCall";
import { pocEndPoints } from "../axios/endPoints";
import { useI18n } from "../i18n.jsx";

function excelSerialToDate(serial) {
  if (serial === null || serial === undefined || serial === "") return "";
  if (typeof serial === "string" && serial.includes("-")) return serial;
  const num = Number(serial);
  if (isNaN(num) || num <= 0) return "";
  const ms = Math.round((num - 25569) * 86400 * 1000);
  const date = new Date(ms);
  if (isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
}

const CELL_COLORS = [
  "bg-red-800",
  "bg-purple-800",
  "bg-blue-800",
  "bg-green-800",
  "bg-yellow-800",
  "bg-pink-800",
];

export default function Matrix({ onOpenDetail }) {
  const { t } = useI18n();
  const [mode, setMode] = useState("date");
  const [filterData, setFilterData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [procId, setProcId] = useState("전체");
  const [maintId, setMaintId] = useState("전체");
  const [siteId, setSiteId] = useState("전체");
  const [priorityId, setPriorityId] = useState("전체");
  const [categoryId, setCategoryId] = useState("전체");
  const [repWorkId, setRepWorkId] = useState("전체");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const getFilterData = useCallback(() => {
    setLoading(true);
    APIcallGet(`${pocEndPoints?.GET_FILTER_DATA}`, {}, (responseData, status) => {
      try {
        if (status === 200 && responseData) {
          const raw = responseData?.data ?? responseData;
          const parsedChanges = (raw.changedDataJson ?? []).flatMap((item) => {
            try {
              return JSON.parse(item.content);
            } catch {
              return [];
            }
          });
          setFilterData({ ...raw, parsedChanges });
        }
      } catch (e) {
        console.error("Matrix filter data error:", e);
      } finally {
        setLoading(false);
      }
    });
  }, [pocEndPoints, APIcallGet]);

  useEffect(() => {
    getFilterData();
  }, [getFilterData]);

  const processes = useMemo(() => filterData?.process ?? [], [filterData]);

  const maintenanceGroups = useMemo(() => {
    if (!filterData?.maintenance) return [];
    if (procId === "전체") return filterData.maintenance;
    return filterData.maintenance.filter((m) => m.processId === Number(procId));
  }, [filterData, procId]);

  const sites = useMemo(() => {
    if (!filterData?.site) return [];
    if (procId === "전체") return filterData.site;
    return filterData.site.filter((s) => s.processId === Number(procId));
  }, [filterData, procId]);

  const priorities = useMemo(() => filterData?.priority ?? [], [filterData]);
  const categories = useMemo(() => filterData?.category ?? [], [filterData]);

  const representations = useMemo(() => {
    if (!filterData?.representations) return [];
    return filterData.representations.filter((r) => {
      if (procId !== "전체" && r.processId !== Number(procId)) return false;
      if (maintId !== "전체" && r.maintenanceGroupId !== Number(maintId)) return false;
      if (siteId !== "전체" && r.siteId !== Number(siteId)) return false;
      return true;
    });
  }, [filterData, procId, maintId, siteId]);

  const filtered = useMemo(() => {
    if (!filterData?.parsedChanges) return [];
    return filterData.parsedChanges.filter((item) => {
      if (procId !== "전체") {
        const p = processes.find((p) => p.id === Number(procId));
        if (!p || item.process !== p.processName) return false;
      }
      if (maintId !== "전체") {
        const m = maintenanceGroups.find((m) => m.id === Number(maintId));
        if (!m || item.maintGroup !== m.maintenanceGroupName) return false;
      }
      if (siteId !== "전체") {
        const s = sites.find((s) => s.id === Number(siteId));
        if (!s || item.site !== s.siteName) return false;
      }
      if (priorityId !== "전체") {
        const p = priorities.find((p) => p.id === Number(priorityId));
        if (!p || item.priority !== p.priorityName) return false;
      }
      if (categoryId !== "전체") {
        const c = categories.find((c) => c.id === Number(categoryId));
        if (!c || item.category !== c.categoryName) return false;
      }
      if (repWorkId !== "전체") {
        const r = representations.find((r) => r.id === Number(repWorkId));
        if (!r || item.representativeWork !== r.representativeWorkName) return false;
      }
      const dateStr = excelSerialToDate(item.workedOn);
      if (dateStr) {
        if (startDate && dateStr < startDate) return false;
        if (endDate && dateStr > endDate) return false;
      }
      return true;
    });
  }, [
    filterData,
    procId,
    maintId,
    siteId,
    priorityId,
    categoryId,
    repWorkId,
    startDate,
    endDate,
    processes,
    maintenanceGroups,
    sites,
    priorities,
    categories,
    representations,
  ]);

  const { columns, equipmentRows } = useMemo(() => {
    if (filtered.length === 0) return { columns: [], equipmentRows: [] };

    const colSet = new Set();
    const equipMap = new Map();
    filtered.forEach((item) => {
      const dateStr = excelSerialToDate(item.workedOn);
      const col = mode === "date" ? dateStr : item.representativeWork;
      colSet.add(col);

      const eqKey = `${item.equipmentCode}||${item.equipmentName}`;
      if (!equipMap.has(eqKey)) {
        equipMap.set(eqKey, {
          equipmentCode: item.equipmentCode,
          equipmentName: item.equipmentName,
          cells: new Map(),
        });
      }
      const eq = equipMap.get(eqKey);
      if (!eq.cells.has(col)) eq.cells.set(col, []);
      eq.cells.get(col).push(item);
    });

    const columns = [...colSet].sort();
    const equipmentRows = [...equipMap.values()];

    return { columns, equipmentRows };
  }, [filtered, mode]);

  const { colCompletion, colColors } = useMemo(() => {
    if (filtered.length === 0) return { colCompletion: {}, colColors: {} };
    const colSet = new Set();
    const equipMap = new Map();
    filtered.forEach((item) => {
      const dateStr = excelSerialToDate(item.workedOn);
      const col = mode === "date" ? dateStr : item.representativeWork;
      colSet.add(col);
      const eqKey = `${item.equipmentCode}||${item.equipmentName}`;
      if (!equipMap.has(eqKey)) equipMap.set(eqKey, new Set());
      equipMap.get(eqKey).add(col);
    });
    const cols = [...colSet].sort();
    const totalEquip = equipMap.size;
    const colCompletion = {};
    const colColors = {};
    cols.forEach((col, i) => {
      let count = 0;
      equipMap.forEach((colsSet) => {
        if (colsSet.has(col)) count++;
      });
      colCompletion[col] = totalEquip > 0 ? Math.round((count / totalEquip) * 100) : 0;
      colColors[col] = CELL_COLORS[i % CELL_COLORS.length];
    });
    return { colCompletion, colColors };
  }, [filtered, mode]);

  const handleProcChange = (val) => {
    setProcId(val);
    setMaintId("전체");
    setSiteId("전체");
    setRepWorkId("전체");
  };

  const handleResetDates = () => {
    setStartDate("");
    setEndDate("");
  };

  if (loading) {
    return (
      <section className="space-y-6">
        <div className="flex min-h-[240px] items-center justify-center text-text-subtle">
          <i className="fas fa-spinner fa-spin mr-2" /> {t("app.loadingData", "데이터를 불러오는 중...")}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-text-default">{t("page.matrix.title", "변경 매트릭스")}</h1>
          <p className="mt-2 text-sm text-text-subtle">
            {t("page.matrix.desc", "공정과 작업별 변경 이력을 시각적으로 분석합니다.")}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-2xl bg-surface-strong p-2">
          <button
            type="button"
            className={`btn-base ${
              mode === "date" ? "btn-primary text-white" : "btn-ghost text-text-subtle"
            }`}
            onClick={() => setMode("date")}
          >
            {t("matrix.dateMode", "날짜 모드")}
          </button>
          <button
            type="button"
            className={`btn-base ${
              mode === "task" ? "btn-primary text-white" : "btn-ghost text-text-subtle"
            }`}
            onClick={() => setMode("task")}
          >
            {t("matrix.taskMode", "작업명 모드")}
          </button>
        </div>
      </header>

      <div className="card p-5">
        <div className="grid gap-4 xl:grid-cols-4">
          <label className="space-y-2 text-sm text-text-subtle">
            {t("field.process", "공정")}
            <select
              className="input-base"
              value={procId}
              onChange={(e) => handleProcChange(e.target.value)}
            >
              <option value="전체">{t("app.all", "전체")}</option>
              {processes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.processName}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm text-text-subtle">
            {t("field.maintenance", "보전파트")}
            <select
              className="input-base"
              value={maintId}
              onChange={(e) => setMaintId(e.target.value)}
            >
              <option value="전체">{t("app.all", "전체")}</option>
              {maintenanceGroups.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.maintenanceGroupName}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm text-text-subtle">
            {t("field.site", "법인")}
            <select
              className="input-base"
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
            >
              <option value="전체">{t("app.all", "전체")}</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.siteName}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm text-text-subtle">
            {t("field.priority", "중요도")}
            <select
              className="input-base"
              value={priorityId}
              onChange={(e) => setPriorityId(e.target.value)}
            >
              <option value="전체">{t("app.all", "전체")}</option>
              {priorities.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.priorityName}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-4">
          <label className="space-y-2 text-sm text-text-subtle">
            {t("field.category", "효과 유형")}
            <select
              className="input-base"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="전체">{t("app.all", "전체")}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.categoryName}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm text-text-subtle">
            {t("field.startDate", "시작일")}
            <input
              type="date"
              className="input-base"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>

          <label className="space-y-2 text-sm text-text-subtle">
            {t("field.endDate", "종료일")}
            <input
              type="date"
              className="input-base"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </label>

          <label className="space-y-2 text-sm text-text-subtle">
            {t("field.repWork", "대표 작업명")}
            <select
              className="input-base"
              value={repWorkId}
              onChange={(e) => setRepWorkId(e.target.value)}
            >
              <option value="전체">{t("app.all", "전체")} ({representations.length} {t("app.rows", "건")})</option>
              {representations.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.representativeWorkName}
                </option>
              ))}
            </select>
          </label>
        </div>

        {(startDate || endDate) && (
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              className="btn-base btn-ghost text-xs text-text-subtle"
              onClick={handleResetDates}
            >
              <i className="fas fa-times mr-1" />
              {t("matrix.resetDate", "날짜 초기화")}
            </button>
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 p-10 text-center text-text-subtle">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-10 text-brand-60 text-3xl">
              <i className="fas fa-layer-group" />
            </div>
            <h2 className="text-xl font-bold text-text-default">
              {t("matrix.noData", "해당 조건에 맞는 데이터가 없습니다.")}
            </h2>
            <p>{t("matrix.adjustFilter", "필터를 조정하거나 추가 데이터를 확인하세요.")}</p>
          </div>
        ) : (
          <div className="overflow-auto " style={{ height: "calc(100vh - 445px)" }}>
            <table className="w-full min-w-max text-sm">
              <thead>
                <tr className="border-b border-border-base">
                  <th className="sticky left-0 z-10 bg-surface-strong px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-subtle">
                    {t("field.equipmentCode", "Equipment Code")}
                  </th>
                  <th className="sticky left-[140px] z-10 bg-surface-strong px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-subtle">
                    {t("field.equipmentName", "Equipment Name")}
                  </th>
                  {columns.map((col) => (
                    <th
                      key={col}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-subtle"
                    >
                      {col}
                      {mode === "task" && (
                        <div className="mt-0.5 font-normal normal-case text-text-subtle">
                          {colCompletion?.[col] ?? 0}.0%
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {equipmentRows.map((eq, rowIdx) => (
                  <tr
                    key={`${eq.equipmentCode}-${rowIdx}`}
                    className="border-b border-border-base last:border-0"
                  >
                    <td className="sticky left-0 z-10 bg-surface-base px-4 py-3 font-semibold text-text-default">
                      {eq.equipmentCode}
                    </td>
                    <td className="sticky left-[140px] z-10 bg-surface-base px-4 py-3 text-text-default">
                      {eq.equipmentName}
                    </td>
                    {columns.map((col) => {
                      const items = eq.cells.get(col);
                      if (!items || items.length === 0) {
                        return <td key={col} className="px-4 py-3" />;
                      }
                      return (
                        <td key={col} className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            {items.map((item, i) => (
                              <button
                                key={i}
                                type="button"
                                className={`rounded px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-80 ${
                                  colColors?.[col] ?? "bg-blue-800"
                                }`}
                                onClick={() => onOpenDetail?.(item)}
                              >
                                {mode === "date"
                                  ? item.representativeWork
                                  : excelSerialToDate(item.workedOn)}
                              </button>
                            ))}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
