import React from "react";
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
    <div className="flex items-center justify-end px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm select-none">
      {/* Pagination controls & Row count */}
      <div className="flex items-center gap-4">
        <span className="text-gray-600 dark:text-gray-300 font-medium text-xs sm:text-sm">
          {rangeText}
        </span>

        <div className="flex items-center gap-1">
          {/* First Page */}
          <button
            type="button"
            className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            onClick={() => onPageChange(1)}
            disabled={safePage <= 1}
            title={t("app.firstPage", "첫 페이지")}
          >
            <i className="fas fa-angle-double-left text-sm" />
          </button>

          {/* Previous Page */}
          <button
            type="button"
            className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            onClick={() => onPageChange(safePage - 1)}
            disabled={safePage <= 1}
            title={t("app.prevPage", "이전 페이지")}
          >
            <i className="fas fa-angle-left text-sm" />
          </button>

          {/* Page indicator */}
          <span className="px-2 text-xs font-semibold text-gray-700 dark:text-gray-200">
            {t("app.page", "페이지")} {safePage} / {totalPages}
          </span>

          {/* Next Page */}
          <button
            type="button"
            className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            onClick={() => onPageChange(safePage + 1)}
            disabled={safePage >= totalPages}
            title={t("app.nextPage", "다음 페이지")}
          >
            <i className="fas fa-angle-right text-sm" />
          </button>

          {/* Last Page */}
          <button
            type="button"
            className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
