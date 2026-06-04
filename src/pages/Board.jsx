import { useMemo, useState } from "react";
import Modal from "../components/Modal.jsx";
import { boardCategories } from "../data.js";

export default function Board({ data, onAddPost, searchText }) {
  const [category, setCategory] = useState("전체");
  const [openModal, setOpenModal] = useState(false);
  const [form, setForm] = useState({
    type: "Q&A",
    author: "Admin",
    title: "",
    content: "",
  });

  const filtered = useMemo(() => {
    return data.filter((item) => {
      const matchesCategory = category === "전체" || item.type === category;
      const text = (
        String(item.title ?? "") +
        String(item.author ?? "") +
        String(item.content ?? "")
      ).toLowerCase();
      const matchesSearch = searchText
        ? text.includes(searchText.toLowerCase())
        : true;
      return matchesCategory && matchesSearch;
    });
  }, [data, category, searchText]);

  const handleSave = () => {
    if (!form.title || !form.content) return;
    onAddPost({ ...form, date: new Date().toISOString().slice(0, 10) });
    setForm({ type: "Q&A", author: "Admin", title: "", content: "" });
    setOpenModal(false);
  };

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-text-default">
            공통 게시판
          </h1>
          <p className="mt-2 text-sm text-text-subtle">
            자유롭게 질문하고 정보를 공유합니다.
          </p>
        </div>
        <button
          type="button"
          className="btn-base btn-primary"
          onClick={() => setOpenModal(true)}
        >
          <i className="fas fa-pen" /> 글 작성
        </button>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {boardCategories.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setCategory(item)}
            className={`card rounded-3xl p-5 text-left transition hover:-translate-y-0.5 ${category === item ? "border-brand-60 border" : "border-border-base border"}`}
          >
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-3xl bg-brand-10 text-brand-60 text-xl">
              <i
                className={
                  item === "FAQ"
                    ? "fas fa-question-circle"
                    : item === "Q&A"
                      ? "fas fa-comments"
                      : item === "제안"
                        ? "fas fa-lightbulb"
                        : "fas fa-bullhorn"
                }
              />
            </div>
            <p className="font-bold text-text-default">{item}</p>
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        <table className="min-w-full text-left text-sm">
          <thead className="table-header">
            <tr>
              <th className="px-4 py-3 text-text-subtle">유형</th>
              <th className="px-4 py-3 text-text-subtle">제목</th>
              <th className="px-4 py-3 text-text-subtle">작성자</th>
              <th className="px-4 py-3 text-text-subtle">날짜</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((post, index) => (
              <tr
                key={`${post.title}-${index}`}
                className="border-t border-border-base hover:bg-fill-active"
              >
                <td className="px-4 py-4 text-text-subtle">{post.type}</td>
                <td className="px-4 py-4 text-text-default">{post.title}</td>
                <td className="px-4 py-4 text-text-subtle">{post.author}</td>
                <td className="px-4 py-4 text-text-subtle">{post.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={openModal}
        title="게시글 작성"
        description="새로운 게시글을 작성합니다."
        onClose={() => setOpenModal(false)}
        footer={
          <button
            type="button"
            className="btn-base btn-primary"
            onClick={handleSave}
          >
            작성하기
          </button>
        }
      >
        <div className="grid gap-4">
          <label className="space-y-2 text-sm text-text-subtle">
            유형
            <select
              className="input-base"
              value={form.type}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, type: e.target.value }))
              }
            >
              {boardCategories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm text-text-subtle">
            작성자
            <input className="input-base" value={form.author} readOnly />
          </label>
          <label className="space-y-2 text-sm text-text-subtle">
            제목
            <input
              className="input-base"
              value={form.title}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, title: e.target.value }))
              }
            />
          </label>
          <label className="space-y-2 text-sm text-text-subtle">
            내용
            <textarea
              className="input-base min-h-[160px] resize-none"
              value={form.content}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, content: e.target.value }))
              }
            />
          </label>
        </div>
      </Modal>
    </section>
  );
}
