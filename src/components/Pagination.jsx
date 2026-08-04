import { useI18n } from "../i18n.jsx";

export default function Pagination({
  currentPage = 1,
  pageSize = 20,
  totalItems = 0,
  onPageChange,
}) {
  const { t } = useI18n();

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const startRow = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endRow = Math.min(safePage * pageSize, totalItems);

  const formatNum = (num) => String(num).padStart(2, "0");

  const rangeText =
    totalItems === 0
      ? `0 ${t("app.rows", "건")}`
      : `${formatNum(startRow)}-${formatNum(endRow)} / ${totalItems}${t("app.rows", "건")}`;

  return (
    <div className="table-pagination">
      <div className="table-pagination-controls">
        <span className="table-pagination-range">{rangeText}</span>

        <div className="table-pagination-buttons">
          <button
            type="button"
            className="table-pagination-btn"
            onClick={() => onPageChange(1)}
            disabled={safePage <= 1}
            title={t("app.firstPage", "첫 페이지")}
          >
            <i className="fas fa-angle-double-left text-sm" />
          </button>

          <button
            type="button"
            className="table-pagination-btn"
            onClick={() => onPageChange(safePage - 1)}
            disabled={safePage <= 1}
            title={t("app.prevPage", "이전 페이지")}
          >
            <i className="fas fa-angle-left text-sm" />
          </button>

          <span className="table-pagination-page">
            {t("app.page", "페이지")} {safePage} / {totalPages}
          </span>

          <button
            type="button"
            className="table-pagination-btn"
            onClick={() => onPageChange(safePage + 1)}
            disabled={safePage >= totalPages}
            title={t("app.nextPage", "다음 페이지")}
          >
            <i className="fas fa-angle-right text-sm" />
          </button>

          <button
            type="button"
            className="table-pagination-btn"
            onClick={() => onPageChange(totalPages)}
            disabled={safePage >= totalPages}
            title={t("app.lastPage", "마지막 페이지")}
          >
            <i className="fas fa-angle-double-right text-sm" />
          </button>
        </div>
      </div>
    </div>
  );
}
