import { useMemo, useState } from "react";
import Modal from "../components/Modal.jsx";
import { boardCategories } from "../data.js";
import { useI18n } from "../i18n.jsx";

const CATEGORY_KEYS = {
  "FAQ": "board.faq",
  "Q&A": "board.qna",
  "제안": "board.suggestion",
  "공지": "board.notice",
  "전체": "app.all"
};

export default function Board({ data, onAddPost, searchText }) {
  const { t } = useI18n();
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
      const text = `${item.title ?? ""}${item.author ?? ""}${item.content ?? ""}`.toLowerCase();
      const matchesSearch = searchText ? text.includes(searchText.toLowerCase()) : true;
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
          <h1 className="text-3xl font-extrabold text-text-default">{t("page.board.title")}</h1>
          <p className="mt-2 text-sm text-text-subtle">{t("page.board.desc")}</p>
        </div>
        <button type="button" className="btn-base btn-primary" onClick={() => setOpenModal(true)}>
          <i className="fas fa-pen" /> {t("page.board.write")}
        </button>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {boardCategories.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setCategory(item)}
            className={`card p-5 text-left transition hover:-translate-y-0.5 ${
              category === item ? "border border-brand-60" : "border border-border-base"
            }`}
          >
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-3xl bg-brand-10 text-xl text-brand-60">
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
            <p className="font-bold text-text-default">{t(CATEGORY_KEYS[item] ?? item)}</p>
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        <table className="min-w-full text-left text-sm">
          <thead className="table-header">
            <tr>
              <th className="px-4 py-3 text-text-subtle">{t("field.type")}</th>
              <th className="px-4 py-3 text-text-subtle">{t("field.title")}</th>
              <th className="px-4 py-3 text-text-subtle">{t("field.author")}</th>
              <th className="px-4 py-3 text-text-subtle">{t("field.date")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((post, index) => (
              <tr key={`${post.title}-${index}`} className="border-t border-border-base hover:bg-fill-active">
                <td className="px-4 py-4 text-text-subtle">{t(CATEGORY_KEYS[post.type] ?? post.type)}</td>
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
        title={t("page.board.modalTitle")}
        description={t("page.board.modalDesc")}
        onClose={() => setOpenModal(false)}
        footer={
          <button type="button" className="btn-base btn-primary" onClick={handleSave}>
            {t("page.board.write")}
          </button>
        }
      >
        <div className="grid gap-4">
          <label className="space-y-2 text-sm text-text-subtle">
            {t("field.type")}
            <select
              className="input-base"
              value={form.type}
              onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
            >
              {boardCategories.map((item) => (
                <option key={item} value={item}>
                  {t(CATEGORY_KEYS[item] ?? item)}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm text-text-subtle">
            {t("field.author")}
            <input className="input-base" value={form.author} readOnly />
          </label>
          <label className="space-y-2 text-sm text-text-subtle">
            {t("field.title")}
            <input
              className="input-base"
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            />
          </label>
          <label className="space-y-2 text-sm text-text-subtle">
            {t("field.content")}
            <textarea
              className="input-base min-h-[160px] resize-none"
              value={form.content}
              onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
            />
          </label>
        </div>
      </Modal>
    </section>
  );
}
