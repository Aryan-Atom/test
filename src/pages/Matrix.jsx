import { useMemo, useState } from "react";
import { priorities, effects } from "../data.js";

export default function Matrix({ data, searchText, onOpenDetail }) {
  const [mode, setMode] = useState("date");
  const [proc, setProc] = useState("전체");
  const [part, setPart] = useState("전체");
  const [corp, setCorp] = useState("전체");
  const [priority, setPriority] = useState("전체");
  const [effect, setEffect] = useState("전체");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const processes = ["전체", ...new Set(data.map((item) => item.공정))];
  const parts = [
    "전체",
    ...new Set(
      data
        .filter((item) => proc === "전체" || item.공정 === proc)
        .map((item) => item.보전파트),
    ),
  ];
  const corps = [
    "전체",
    ...new Set(data.map((item) => item.법인).filter(Boolean)),
  ];
  const repTasks = [
    "전체",
    ...new Set(data.map((item) => item["대표 작업명"])),
  ];

  const filtered = useMemo(() => {
    return data.filter((item) => {
      const matchesProc = proc === "전체" || item.공정 === proc;
      const matchesPart = part === "전체" || item.보전파트 === part;
      const matchesCorp = corp === "전체" || item.법인 === corp;
      const matchesPriority =
        priority === "전체" || item["중요도"] === priority;
      const matchesEffect = effect === "전체" || item["효과 유형"] === effect;
      const textForSearch = (
        String(item.설비명 ?? "") +
        String(item["대표 작업명"] ?? "") +
        String(item["문제 현상"] ?? "")
      ).toLowerCase();
      const matchesSearch = searchText
        ? textForSearch.includes(String(searchText).toLowerCase())
        : true;
      const withinDate = (() => {
        if (!startDate && !endDate) return true;
        const date = item["작업완료일"] || "";
        if (startDate && date < startDate) return false;
        if (endDate && date > endDate) return false;
        return true;
      })();
      return (
        matchesProc &&
        matchesPart &&
        matchesCorp &&
        matchesPriority &&
        matchesEffect &&
        matchesSearch &&
        withinDate
      );
    });
  }, [
    data,
    proc,
    part,
    corp,
    priority,
    effect,
    searchText,
    startDate,
    endDate,
  ]);

  const isMatrixEmpty = proc === "전체" || part === "전체";

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-text-default">
            변경 매트릭스
          </h1>
          <p className="mt-2 text-sm text-text-subtle">
            공정과 작업별 변경 이력을 시각적으로 분석합니다.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-2xl bg-surface-strong p-2">
          <button
            type="button"
            className={`btn-base ${mode === "date" ? "btn-primary text-white" : "btn-ghost text-text-subtle"}`}
            onClick={() => setMode("date")}
          >
            날짜 모드
          </button>
          <button
            type="button"
            className={`btn-base ${mode === "task" ? "btn-primary text-white" : "btn-ghost text-text-subtle"}`}
            onClick={() => setMode("task")}
          >
            작업명 모드
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
            보전파트
            <select
              className="input-base"
              value={part}
              onChange={(e) => setPart(e.target.value)}
            >
              {parts.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm text-text-subtle">
            법인
            <select
              className="input-base"
              value={corp}
              onChange={(e) => setCorp(e.target.value)}
            >
              {corps.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm text-text-subtle">
            중요도
            <select
              className="input-base"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="전체">전체</option>
              {priorities.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-4">
          <label className="space-y-2 text-sm text-text-subtle">
            효과 유형
            <select
              className="input-base"
              value={effect}
              onChange={(e) => setEffect(e.target.value)}
            >
              <option value="전체">전체</option>
              {effects.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm text-text-subtle">
            시작일
            <input
              type="date"
              className="input-base"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>
          <label className="space-y-2 text-sm text-text-subtle">
            종료일
            <input
              type="date"
              className="input-base"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </label>
          <label className="space-y-2 text-sm text-text-subtle">
            대표 작업명
            <select className="input-base" value="전체" disabled>
              {repTasks.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="card overflow-hidden">
        {isMatrixEmpty ? (
          <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 p-10 text-center text-text-subtle">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-10 text-brand-60 text-3xl">
              <i className="fas fa-layer-group" />
            </div>
            <h2 className="text-xl font-bold text-text-default">
              공정과 보전파트를 선택하세요
            </h2>
            <p>상단 필터를 선택하면 변경 매트릭스가 표시됩니다.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 p-10 text-center text-text-subtle">
            <h2 className="text-xl font-bold text-text-default">
              해당 조건에 맞는 데이터가 없습니다.
            </h2>
            <p>필터를 조정하거나 추가 데이터를 확인하세요.</p>
          </div>
        ) : (
          <div className="overflow-auto">
            <div className="grid gap-3 p-5 md:grid-cols-2">
              {filtered.map((row, index) => (
                <button
                  key={`${row["W/O코드"]}-${index}`}
                  type="button"
                  className="rounded-3xl border border-border-base bg-surface-strong p-4 text-left shadow-soft transition hover:-translate-y-0.5 hover:shadow-xl"
                  onClick={() => onOpenDetail(row)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-text-default">
                        {mode === "date"
                          ? row["작업완료일"]
                          : row["대표 작업명"]}
                      </div>
                      <div className="mt-2 text-sm text-text-subtle">
                        {row.공정} · {row.보전파트} · {row.법인}
                      </div>
                    </div>
                    <span className="badge badge-primary">{row["중요도"]}</span>
                  </div>
                  <div className="mt-4 grid gap-2 text-sm text-text-subtle">
                    <div>
                      효과 유형:{" "}
                      <span className="font-semibold text-text-default">
                        {row["효과 유형"]}
                      </span>
                    </div>
                    <div>
                      대표 작업명:{" "}
                      <span className="font-semibold text-text-default">
                        {row["대표 작업명"]}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
