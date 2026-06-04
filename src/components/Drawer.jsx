export default function Drawer({ item, onClose }) {
  if (!item) return null;

  const details = Object.entries(item).filter(
    ([key]) => key !== "id" && key !== "type",
  );

  return (
    <div className="fixed inset-0 z-40 bg-surface-inverse/30 backdrop-blur-sm">
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-surface-default shadow-2xl">
        <div className="flex items-center justify-between border-b border-border-base p-5">
          <div>
            <h2 className="text-xl font-bold text-text-default">상세 정보</h2>
            <p className="text-sm text-text-subtle">
              선택한 레코드의 모든 상세 이력
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-base btn-ghost rounded-xl p-3"
          >
            <i className="fas fa-times" />
          </button>
        </div>
        <div className="space-y-4 overflow-y-auto p-5">
          {details.map(([key, value]) => (
            <div key={key} className="rounded-2xl bg-surface-strong p-4">
              <div className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-text-subtle">
                {key}
              </div>
              <div className="text-sm leading-6 text-text-default whitespace-pre-wrap">
                {value || "내용 없음"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
