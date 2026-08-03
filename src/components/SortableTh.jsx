import React from "react";

export default function SortableTh({
  columnKey,
  label,
  sortConfig,
  onSort,
  className = "px-3.5 py-2.5 text-text-subtle whitespace-nowrap text-xs font-bold border-b border-border-base dark:border-gray-700/60",
  style,
}) {
  const isSorted = sortConfig?.key === columnKey;
  const direction = isSorted ? sortConfig.direction : null;

  return (
    <th
      className={`group cursor-pointer select-none hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors ${className}`}
      style={style}
      onClick={() => onSort(columnKey)}
    >
      <div className="inline-flex items-center gap-1.5">
        <span>{label}</span>
        <span className="inline-flex flex-col text-[10px] leading-none">
          {direction === "asc" ? (
            <i className="fas fa-sort-up text-blue-600 text-sm" />
          ) : direction === "desc" ? (
            <i className="fas fa-sort-down text-blue-600 text-sm" />
          ) : (
            <i className="fas fa-sort text-gray-300 dark:text-gray-600 group-hover:text-gray-500 text-xs transition-colors" />
          )}
        </span>
      </div>
    </th>
  );
}
