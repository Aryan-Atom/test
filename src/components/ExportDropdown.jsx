import React, { useState, useRef, useEffect } from "react";
import { useI18n } from "../i18n.jsx";

export default function ExportDropdown({
  onExportCsv,
  onExportExcel,
  onExportZip,
  busy = false,
  selectedCount = 0,
  className = "",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const { t } = useI18n();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (exportFn) => {
    setIsOpen(false);
    if (exportFn) {
      exportFn();
    }
  };

  const labelText =
    selectedCount > 0
      ? `${t("app.export", "내보내기")} (${selectedCount}${t("app.rows", "건")})`
      : t("app.export", "내보내기");

  return (
    <div className="relative inline-block text-left z-50" ref={dropdownRef}>
      <button
        type="button"
        className={`flex items-center justify-center gap-2 px-3.5 h-[36px] text-[13px] font-semibold text-white bg-[#1745c2] hover:bg-[#1239a5] rounded-xl shadow-xs transition-all cursor-pointer border-0 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
        onClick={() => setIsOpen((prev) => !prev)}
        disabled={busy}
      >
        {busy ? (
          <>
            <i className="fas fa-spinner fa-spin mr-1" />
            <span>{t("toast.exporting", "내보내는 중...")}</span>
          </>
        ) : (
          <>
            <i className="fas fa-file-export text-xs" />
            <span>{labelText}</span>
            <i
              className={`fas fa-chevron-down text-[10px] transition-transform duration-200 ml-1 ${
                isOpen ? "rotate-180" : ""
              }`}
            />
          </>
        )}
      </button>

      {isOpen && (
        <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-lg shadow-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 ring-1 ring-black ring-opacity-5 z-[9999] py-1 focus:outline-none transition-all duration-200">
          <button
            type="button"
            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/60 flex items-center gap-3 transition-colors duration-150"
            onClick={() => handleSelect(onExportCsv)}
          >
            <i className="fas fa-file-csv text-blue-600 text-lg w-5 text-center" />
            <span className="font-medium">{t("app.exportCsv", "CSV 내보내기")}</span>
          </button>
          <button
            type="button"
            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/60 flex items-center gap-3 transition-colors duration-150"
            onClick={() => handleSelect(onExportExcel)}
          >
            <i className="fas fa-file-excel text-emerald-600 text-lg w-5 text-center" />
            <span className="font-medium">{t("app.exportExcel", "Excel 내보내기")}</span>
          </button>
          <button
            type="button"
            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/60 flex items-center gap-3 transition-colors duration-150"
            onClick={() => handleSelect(onExportZip)}
          >
            <i className="fas fa-file-archive text-amber-600 text-lg w-5 text-center" />
            <span className="font-medium">{t("app.exportZip", "ZIP 내보내기")}</span>
          </button>
        </div>
      )}
    </div>
  );
}
