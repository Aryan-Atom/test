export default function SortableTh({
  label,
  sortKey,
  columnKey,
  currentSort,
  sortConfig,
  onSort,
  className = "px-3.5 py-2.5 text-text-subtle whitespace-nowrap text-xs font-bold border-b border-border-base",
}) {
  const resolvedSortKey = sortKey ?? columnKey;
  const resolvedSort = currentSort ?? sortConfig ?? {};
  const isActive = resolvedSort?.key === resolvedSortKey;
  const direction = isActive ? resolvedSort?.direction : null;

  return (
    <th
      className={`group cursor-pointer select-none hover:bg-surface-strong transition-colors ${className}`}
      onClick={() => onSort?.(resolvedSortKey)}
    >
      <div className="flex items-center gap-1.5">
        <span>{label}</span>
        {isActive && direction ? (
          <i
            className={`fas fa-sort-${direction === "asc" ? "up" : "down"} text-brand-60 text-xs`}
          />
        ) : (
          <i className="fas fa-sort text-text-disabled group-hover:text-text-subtlest text-xs transition-colors" />
        )}
      </div>
    </th>
  );
}
