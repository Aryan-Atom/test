import { useMemo, useState, useRef } from "react";

const columns = [
  "법인",
  "공정",
  "보전파트",
  "설비명",
  "W/O코드",
  "대표 작업명",
  "중요도",
  "효과 유형",
  "작업완료일",
];

export default function ChangeHistory({
  data,
  onUpload,
  onExport,
  onOpenDetail,
  searchText,
}) {
  const [proc, setProc] = useState("전체");
  const [part, setPart] = useState("전체");
  const [filter, setFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const fileInput = useRef(null);

  const processes = useMemo(
    () => ["전체", ...new Set(data.map((item) => item.공정))],
    [data],
  );
  const parts = useMemo(() => {
    const items = data.filter((item) => proc === "전체" || item.공정 === proc);
    return ["전체", ...new Set(items.map((item) => item.보전파트))];
  }, [data, proc]);
  const filtered = useMemo(() => {
    return data.filter((item) => {
      const matchesProc = proc === "전체" || item.공정 === proc;
      const matchesPart = part === "전체" || item.보전파트 === part;
      const text = (
        String(item.설비명 ?? "") +
        String(item["대표 작업명"] ?? "") +
        String(item["문제 현상"] ?? "") +
        String(item["문제 원인"] ?? "")
      ).toLowerCase();
      const matchesSearch = searchText
        ? text.includes(searchText.toLowerCase())
        : true;
      const matchesFilter = filter ? text.includes(filter.toLowerCase()) : true;
      return matchesProc && matchesPart && matchesSearch && matchesFilter;
    });
  }, [data, proc, part, filter, searchText]);

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
    setSelectedIds(new Set(filtered.map((_, index) => index)));
  };

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-text-default">
            변경 이력 데이터
          </h1>
          <p className="mt-2 text-sm text-text-subtle">
            설비 변경 이력 데이터를 관리합니다. 변경 매트릭스 및 MP List용
            데이터를 다룹니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="btn-base btn-secondary"
            onClick={() => fileInput.current?.click()}
          >
            <i className="fas fa-file-import" /> CSV 불러오기
          </button>
          <button
            type="button"
            className="btn-base btn-primary"
            onClick={onExport}
          >
            <i className="fas fa-file-export" /> CSV 내보내기
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onUpload("change", file);
              event.target.value = "";
            }}
          />
        </div>
      </header>

      <div className="card p-5">
        <div className="grid gap-4 lg:grid-cols-5">
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
          <label className="space-y-2 text-sm text-text-subtle lg:col-span-2">
            검색
            <input
              className="input-base"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="설비명, 작업명, 문제 상황..."
            />
          </label>
          <div className="flex items-end justify-between gap-3">
            <span className="badge badge-primary">{filtered.length}건</span>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 p-10 text-center text-text-subtle">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-10 text-brand-60 text-3xl">
              <i className="fas fa-history" />
            </div>
            <h2 className="text-xl font-bold text-text-default">
              조건에 맞는 데이터가 없습니다.
            </h2>
            <p>
              공정과 보전파트를 선택하거나 검색어를 입력해서 데이터를
              확인하세요.
            </p>
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="table-header">
                <tr>
                  <th className="px-4 py-3 w-12">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filtered.length}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  {columns.map((column) => (
                    <th key={column} className="px-4 py-3 text-text-subtle">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, index) => (
                  <tr
                    key={`${row["W/O코드"]}-${index}`}
                    className="table-row border-t border-border-base hover:bg-fill-active cursor-pointer"
                    onClick={() => onOpenDetail(row)}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(index)}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleSelect(index);
                        }}
                      />
                    </td>
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
