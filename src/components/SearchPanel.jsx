import { useState } from 'react';

const STATUS_DOT = { yes: '#007dbb', no: '#c62828', error: '#f9a825' };

const RUNWAY_OPTIONS = [
  { value: 0, label: 'Any' },
  { value: 800, label: '≥ 800 m' },
  { value: 1000, label: '≥ 1000 m' },
  { value: 1500, label: '≥ 1500 m' },
  { value: 2000, label: '≥ 2000 m' },
];

const AMENITIES = [
  { key: 'avgas', label: 'AVGAS' },
  { key: 'jet', label: 'Jet A1' },
  { key: 'customs', label: 'Customs' },
  { key: 'ifr', label: 'IFR' },
];

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 text-gray-400 shrink-0" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 5h18M6 12h12M10 19h4" />
    </svg>
  );
}

export function SearchPanel({
  airports,
  totalCount,
  data,
  search,
  setSearch,
  filters,
  setFilters,
  defaultFilters,
  selected,
  onSelect,
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const searching = search.trim().length > 0;
  const filterActive =
    filters.status !== 'all' || filters.minRunway > 0 ||
    filters.avgas || filters.jet || filters.customs || filters.ifr;
  const expanded = searching || filtersOpen;

  const set = (patch) => setFilters((f) => ({ ...f, ...patch }));
  const toggle = (key) => setFilters((f) => ({ ...f, [key]: !f[key] }));

  return (
    <div className="absolute top-3 left-16 z-[1000] w-80 max-w-[calc(100%-5rem)]">
      {/* Compact search pill */}
      <div className="flex items-center gap-2 bg-white rounded-full shadow-md border border-gray-200 h-9 px-3">
        <SearchIcon />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search airfield…"
          className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-gray-400"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="text-gray-400 hover:text-gray-700 text-lg leading-none"
            aria-label="Clear search"
          >
            ×
          </button>
        )}
        <span className="w-px h-5 bg-gray-200" />
        <button
          onClick={() => setFiltersOpen((v) => !v)}
          className={`shrink-0 ${filterActive || filtersOpen ? 'text-brand' : 'text-gray-400 hover:text-gray-700'}`}
          aria-label="Filters"
          title="Filters"
        >
          <FilterIcon />
        </button>
      </div>

      {/* Expanded panel: filters and/or results */}
      {expanded && (
        <div className="mt-2 bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
          {filtersOpen && (
            <div className="p-3 border-b border-gray-100 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Filters</span>
                {filterActive && (
                  <button
                    onClick={() => setFilters(defaultFilters)}
                    className="text-xs text-brand hover:underline"
                  >
                    Reset
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-gray-600">
                  Restaurants
                  <select
                    value={filters.status}
                    onChange={(e) => set({ status: e.target.value })}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand"
                  >
                    <option value="all">All</option>
                    <option value="yes">Has restaurants</option>
                    <option value="no">None found</option>
                  </select>
                </label>
                <label className="text-xs text-gray-600">
                  Min runway
                  <select
                    value={filters.minRunway}
                    onChange={(e) => set({ minRunway: Number(e.target.value) })}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand"
                  >
                    {RUNWAY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {AMENITIES.map((a) => (
                  <button
                    key={a.key}
                    onClick={() => toggle(a.key)}
                    className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                      filters[a.key]
                        ? 'bg-brand text-white border-brand'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {searching && (
            <>
              <div className="px-3 py-2 text-xs text-gray-400 border-b border-gray-100">
                {airports.length} of {totalCount} airfields
              </div>
              <ul className="max-h-[60vh] overflow-y-auto">
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
            </>
          )}
        </div>
      )}
    </div>
  );
}
