export default function Navbar({ breadcrumb, searchText, onSearchChange }) {
  return (
    <header className="glass flex items-center justify-between border-b border-border-base px-6 py-4">
      <div className="flex items-center gap-4">
        {/* <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-brand-10 text-brand-60 shadow-sm">
          <i className="fas fa-box-open text-xl" />
        </div> */}
        <div>
          <div className="text-sm font-semibold text-text-default">
          
          </div>
          <div className="text-xs text-text-subtle">{breadcrumb}</div>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-4">
        <div className="hidden w-full max-w-xl items-center gap-3 rounded-2xl bg-surface-strong p-3 shadow-sm sm:flex">
          <i className="fas fa-search text-text-subtle" />
          <input
            type="search"
            value={searchText}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="검색..."
            className="w-full bg-transparent text-text-default placeholder:text-text-subtle outline-none"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-brand-10 text-brand-60 shadow-sm">
          <i className="fas fa-user" />
        </div>
      </div>
    </header>
  );
}
