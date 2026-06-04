import { useMemo, useState, useRef } from "react";

const columns = [
  "공정",
  "보전유형",
  "설비코드",
  "설비명",
  "버전",
  "사양항목",
  "사양값",
];

export default function SpecData({ data, onUpload, onExport, searchText }) {
  const [proc, setProc] = useState("전체");
  const [type, setType] = useState("전체");
  const fileInput = useRef(null);

  const processes = useMemo(
    () => ["전체", ...new Set(data.map((item) => item.공정))],
    [data],
  );
  const types = useMemo(
    () => ["전체", ...new Set(data.map((item) => item.보전유형))],
    [data],
  );
  const filtered = useMemo(() => {
    return data.filter((item) => {
      const matchesProc = proc === "전체" || item.공정 === proc;
      const matchesType = type === "전체" || item.보전유형 === type;
      const text = (
        String(item.설비명 ?? "") +
        String(item.사양항목 ?? "") +
        String(item.사양값 ?? "")
      ).toLowerCase();
      const matchesSearch = searchText
        ? text.includes(searchText.toLowerCase())
        : true;
      return matchesProc && matchesType && matchesSearch;
    });
  }, [data, proc, type, searchText]);

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-text-default">
            사양 데이터
          </h1>
          <p className="mt-2 text-sm text-text-subtle">
            설비 사양 항목 데이터를 관리합니다. 사양 매트릭스용 데이터를 업로드
            및 확인하세요.
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
              if (file) onUpload("spec", file);
              event.target.value = "";
            }}
          />
        </div>
      </header>

      <div className="card p-5">
        <div className="grid gap-4 md:grid-cols-3">
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
          <div className="flex items-end justify-end">
            <span className="badge badge-primary">{filtered.length}건</span>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 p-10 text-center text-text-subtle">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-10 text-brand-60 text-3xl">
              <i className="fas fa-microchip" />
            </div>
            <h2 className="text-xl font-bold text-text-default">
              조건에 맞는 사양 데이터가 없습니다.
            </h2>
            <p>공정과 보전유형을 선택하거나 검색어를 입력해 주세요.</p>
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
                {filtered.map((row, index) => (
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
