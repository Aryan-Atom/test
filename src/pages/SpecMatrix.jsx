import { useMemo, useState } from "react";

const columns = ["설비명", "설비코드", "버전", "사양항목", "사양값"];

export default function SpecMatrix({ data, searchText }) {
  const [view, setView] = useState("view1");
  const [proc, setProc] = useState("전체");
  const [type, setType] = useState("전체");
  const [version, setVersion] = useState("전체");
  const [changedOnly, setChangedOnly] = useState(false);

  const processes = ["전체", ...new Set(data.map((item) => item.공정))];
  const types = ["전체", ...new Set(data.map((item) => item.보전유형))];
  const versions = ["전체", ...new Set(data.map((item) => item.버전))];

  const filtered = useMemo(() => {
    return data.filter((item) => {
      const matchesProc = proc === "전체" || item.공정 === proc;
      const matchesType = type === "전체" || item.보전유형 === type;
      const matchesVersion = version === "전체" || item.버전 === version;
      const text = (
        String(item.설비명 ?? "") +
        String(item.사양항목 ?? "") +
        String(item.사양값 ?? "")
      ).toLowerCase();
      const matchesSearch = searchText
        ? text.includes(searchText.toLowerCase())
        : true;
      return matchesProc && matchesType && matchesVersion && matchesSearch;
    });
  }, [data, proc, type, version, searchText]);

  const changedRows = useMemo(() => {
    if (!changedOnly || view !== "view2") return filtered;
    const grouped = new Map();
    filtered.forEach((item) => {
      const key = `${item.공정}|${item.보전유형}|${item.설비코드}|${item.사양항목}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(item);
    });
    return [...grouped.values()].flatMap((items) => {
      const values = new Set(items.map((row) => row.사양값));
      return values.size > 1 ? items : [];
    });
  }, [filtered, changedOnly, view]);

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-text-default">
            사양 매트릭스
          </h1>
          <p className="mt-2 text-sm text-text-subtle">
            설비별 사양 항목과 버전 간 비교를 확인합니다.
          </p>
        </div>
        <div className="flex rounded-2xl bg-surface-strong p-2">
          <button
            type="button"
            className={`btn-base ${view === "view1" ? "btn-primary text-white" : "btn-ghost text-text-subtle"}`}
            onClick={() => setView("view1")}
          >
            장비별 사양 (VIEW1)
          </button>
          <button
            type="button"
            className={`btn-base ${view === "view2" ? "btn-primary text-white" : "btn-ghost text-text-subtle"}`}
            onClick={() => setView("view2")}
          >
            버전별 비교 (VIEW2)
          </button>
        </div>
      </header>

      <div className="card p-5">
        <div className="grid gap-4 xl:grid-cols-4">
          <label className="space-y-2 text-sm text-text-subtle">
            공정
            <select
              className="input-base"
              value={proc}
              onChange={(e) => setProc(e.target.value)}
            >
              {processes.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm text-text-subtle">
            보전유형
            <select
              className="input-base"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {types.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm text-text-subtle">
            버전
            <select
              className="input-base"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
            >
              {versions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end justify-end">
            <button
              type="button"
              className="btn-base btn-secondary"
              onClick={() => setChangedOnly((prev) => !prev)}
            >
              {changedOnly ? "변경 항목 숨기기" : "변경 항목만 보기"}
            </button>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        {changedRows.length === 0 ? (
          <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 p-10 text-center text-text-subtle">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-10 text-brand-60 text-3xl">
              <i className="fas fa-microscope" />
            </div>
            <h2 className="text-xl font-bold text-text-default">
              매칭되는 사양 데이터가 없습니다.
            </h2>
            <p>필터 또는 보기 모드를 조정해 보세요.</p>
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="table-header">
                <tr>
                  {columns.map((column) => (
                    <th key={column} className="px-4 py-3 text-text-subtle">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {changedRows.map((row, index) => (
                  <tr
                    key={`${row.설비코드}-${index}`}
                    className="border-t border-border-base hover:bg-fill-active"
                  >
                    {columns.map((column) => (
                      <td key={column} className="px-4 py-3 text-text-subtle">
                        {row[column] ?? "—"}
                      </td>
                    ))}
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
