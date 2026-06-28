const STATUS_DOT = { yes: '#007dbb', no: '#c62828', error: '#f9a825' };

export function Sidebar({
  airports,
  totalCount,
  data,
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  selected,
  onSelect,
}) {
  return (
    <aside className="w-72 shrink-0 bg-white border-r border-gray-200 flex flex-col">
      {/* Search + filters */}
      <div className="p-3 border-b border-gray-100 space-y-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or ICAO…"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        />

        {/* Filters — add more controls here as the data grows (runway length, etc.) */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Restaurants
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand"
          >
            <option value="all">All airfields</option>
            <option value="yes">Has restaurants</option>
            <option value="no">None found</option>
          </select>
        </div>
      </div>

      {/* Result count */}
      <div className="px-3 py-2 text-xs text-gray-400 border-b border-gray-100">
        {airports.length} of {totalCount} airfields
      </div>

      {/* Results list */}
      <ul className="flex-1 overflow-y-auto">
        {airports.length === 0 && (
          <li className="px-3 py-4 text-sm text-gray-400">No matches</li>
        )}
        {airports.map((a) => {
          const entry = data.airports[a.icao];
          const status = entry?.status;
          const count = entry?.places?.length;
          const active = selected?.icao === a.icao;
          return (
            <li key={a.icao}>
              <button
                onClick={() => onSelect(a)}
                className={`w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-gray-50 ${
                  active ? 'bg-blue-50' : ''
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: STATUS_DOT[status] ?? '#9e9e9e' }}
                />
                <span className="flex-1 min-w-0">
                  <span className="font-mono text-xs text-brand">{a.icao}</span>
                  <span className="block text-sm text-gray-800 truncate">{a.name}</span>
                </span>
                {status === 'yes' && count != null && (
                  <span className="text-xs text-gray-400">{count}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
