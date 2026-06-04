import { useMemo, useState } from "react";
import Modal from "../components/Modal.jsx";
import { priorities, effects } from "../data.js";

const columns = ["대표작업명", "작업완료일", "중요도", "효과 유형", "W/O코드"];

export default function MPList({ data, onAddRow, onExport, searchText }) {
  const [proc, setProc] = useState("전체");
  const [part, setPart] = useState("전체");
  const [priority, setPriority] = useState("전체");
  const [effect, setEffect] = useState("전체");
  const [showModal, setShowModal] = useState(false);
  const [newRow, setNewRow] = useState({
    대표작업명: "",
    "작업 목적": "",
    "문제 현상": "",
    "문제 원인": "",
    BOM: "",
    자재명: "",
    "HW 변경 전": "",
    "HW 변경 후": "",
    "SW 변경 전": "",
    "SW 변경 후": "",
    중요도: "일반",
    "효과 유형": "기타",
    "W/O코드": "",
    작업완료일: "",
  });

  const processes = useMemo(
    () => ["전체", ...new Set(data.map((item) => item.공정 || "전체"))],
    [data],
  );
  const parts = useMemo(
    () => [
      "전체",
      ...new Set(
        data
          .filter((item) => proc === "전체" || item.공정 === proc)
          .map((item) => item.보전파트 || "전체"),
      ),
    ],
    [data, proc],
  );

  const filtered = useMemo(() => {
    return data.filter((item) => {
      const matchesProc = proc === "전체" || item.공정 === proc;
      const matchesPart = part === "전체" || item.보전파트 === part;
      const matchesPriority =
        priority === "전체" || item["중요도"] === priority;
      const matchesEffect = effect === "전체" || item["효과 유형"] === effect;
      const text = (
        String(item["대표작업명"] ?? "") +
        String(item["작업 목적"] ?? "") +
        String(item["문제 현상"] ?? "") +
        String(item["문제 원인"] ?? "")
      ).toLowerCase();
      const matchesSearch = searchText
        ? text.includes(searchText.toLowerCase())
        : true;
      return (
        matchesProc &&
        matchesPart &&
        matchesPriority &&
        matchesEffect &&
        matchesSearch
      );
    });
  }, [data, proc, part, priority, effect, searchText]);

  const handleSave = () => {
    if (!newRow["대표작업명"] || !newRow["작업 목적"] || !newRow["작업완료일"])
      return;
    onAddRow(newRow);
    setNewRow({
      대표작업명: "",
      "작업 목적": "",
      "문제 현상": "",
      "문제 원인": "",
      BOM: "",
      자재명: "",
      "HW 변경 전": "",
      "HW 변경 후": "",
      "SW 변경 전": "",
      "SW 변경 후": "",
      중요도: "일반",
      "효과 유형": "기타",
      "W/O코드": "",
      작업완료일: "",
    });
    setShowModal(false);
  };

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-text-default">
            MP List 조회
          </h1>
          <p className="mt-2 text-sm text-text-subtle">
            보전파트별 대표 작업명을 최신순으로 조회하고 필요한 항목을
            추가합니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="btn-base btn-secondary"
            onClick={() => setShowModal(true)}
          >
            <i className="fas fa-plus" /> 행 추가
          </button>
          <button
            type="button"
            className="btn-base btn-primary"
            onClick={onExport}
          >
            <i className="fas fa-file-export" /> CSV 내보내기
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
        </div>
      </div>

      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 p-10 text-center text-text-subtle">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-10 text-brand-60 text-3xl">
              <i className="fas fa-clipboard-list" />
            </div>
            <h2 className="text-xl font-bold text-text-default">
              MP List를 찾을 수 없습니다.
            </h2>
            <p>필터를 조정하거나 새 항목을 추가해 보세요.</p>
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
                    key={`${row["대표작업명"]}-${index}`}
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

      <Modal
        open={showModal}
        title="MP List 항목 추가"
        description="새로운 항목을 추가하고 저장하세요."
        onClose={() => setShowModal(false)}
        footer={
          <button
            type="button"
            className="btn-base btn-primary"
            onClick={handleSave}
          >
            추가하기
          </button>
        }
      >
        <div className="grid gap-4">
          <label className="space-y-2 text-sm text-text-subtle">
            대표작업명
            <input
              className="input-base"
              value={newRow["대표작업명"]}
              onChange={(e) =>
                setNewRow((prev) => ({ ...prev, 대표작업명: e.target.value }))
              }
            />
          </label>
          <label className="space-y-2 text-sm text-text-subtle">
            작업 목적
            <input
              className="input-base"
              value={newRow["작업 목적"]}
              onChange={(e) =>
                setNewRow((prev) => ({ ...prev, "작업 목적": e.target.value }))
              }
            />
          </label>
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="space-y-2 text-sm text-text-subtle">
              문제 현상
              <input
                className="input-base"
                value={newRow["문제 현상"]}
                onChange={(e) =>
                  setNewRow((prev) => ({
                    ...prev,
                    "문제 현상": e.target.value,
                  }))
                }
              />
            </label>
            <label className="space-y-2 text-sm text-text-subtle">
              문제 원인
              <input
                className="input-base"
                value={newRow["문제 원인"]}
                onChange={(e) =>
                  setNewRow((prev) => ({
                    ...prev,
                    "문제 원인": e.target.value,
                  }))
                }
              />
            </label>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="space-y-2 text-sm text-text-subtle">
              BOM
              <input
                className="input-base"
                value={newRow.BOM}
                onChange={(e) =>
                  setNewRow((prev) => ({ ...prev, BOM: e.target.value }))
                }
              />
            </label>
            <label className="space-y-2 text-sm text-text-subtle">
              자재명
              <input
                className="input-base"
                value={newRow.자재명}
                onChange={(e) =>
                  setNewRow((prev) => ({ ...prev, 자재명: e.target.value }))
                }
              />
            </label>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="space-y-2 text-sm text-text-subtle">
              HW 변경 전
              <input
                className="input-base"
                value={newRow["HW 변경 전"]}
                onChange={(e) =>
                  setNewRow((prev) => ({
                    ...prev,
                    "HW 변경 전": e.target.value,
                  }))
                }
              />
            </label>
            <label className="space-y-2 text-sm text-text-subtle">
              HW 변경 후
              <input
                className="input-base"
                value={newRow["HW 변경 후"]}
                onChange={(e) =>
                  setNewRow((prev) => ({
                    ...prev,
                    "HW 변경 후": e.target.value,
                  }))
                }
              />
            </label>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="space-y-2 text-sm text-text-subtle">
              SW 변경 전
              <input
                className="input-base"
                value={newRow["SW 변경 전"]}
                onChange={(e) =>
                  setNewRow((prev) => ({
                    ...prev,
                    "SW 변경 전": e.target.value,
                  }))
                }
              />
            </label>
            <label className="space-y-2 text-sm text-text-subtle">
              SW 변경 후
              <input
                className="input-base"
                value={newRow["SW 변경 후"]}
                onChange={(e) =>
                  setNewRow((prev) => ({
                    ...prev,
                    "SW 변경 후": e.target.value,
                  }))
                }
              />
            </label>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <label className="space-y-2 text-sm text-text-subtle">
              중요도
              <select
                className="input-base"
                value={newRow["중요도"]}
                onChange={(e) =>
                  setNewRow((prev) => ({ ...prev, 중요도: e.target.value }))
                }
              >
                {priorities.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm text-text-subtle">
              효과 유형
              <select
                className="input-base"
                value={newRow["효과 유형"]}
                onChange={(e) =>
                  setNewRow((prev) => ({
                    ...prev,
                    "효과 유형": e.target.value,
                  }))
                }
              >
                {effects.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm text-text-subtle">
              작업완료일
              <input
                className="input-base"
                type="date"
                value={newRow["작업완료일"]}
                onChange={(e) =>
                  setNewRow((prev) => ({ ...prev, 작업완료일: e.target.value }))
                }
              />
            </label>
          </div>
          <label className="space-y-2 text-sm text-text-subtle">
            W/O코드
            <input
              className="input-base"
              value={newRow["W/O코드"]}
              onChange={(e) =>
                setNewRow((prev) => ({ ...prev, "W/O코드": e.target.value }))
              }
            />
          </label>
        </div>
      </Modal>
    </section>
  );
}
