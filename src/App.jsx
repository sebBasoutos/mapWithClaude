import { useState, useEffect, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import AIRPORTS from './data/airports';
import { useRestaurants } from './hooks/useRestaurants';
import { DetailPanel } from './components/DetailPanel';
import { Sidebar } from './components/Sidebar';

const VERSION = 'v2.20260628.3';

const STATUS_COLOR = {
  yes: '#007dbb',
  no: '#c62828',
  error: '#f9a825',
  loading: '#9e9e9e',
};

// Fit the map to the currently shown (filtered) airfields.
function FitToAirports({ airports }) {
  const map = useMap();
  const key = airports.map((a) => a.icao).join(',');
  useEffect(() => {
    if (airports.length === 0) return;
    const bounds = L.latLngBounds(airports.map((a) => [a.lat, a.lng]));
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 12 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}

// Pan/zoom to the selected airfield (e.g. when picked from the list).
function FlyToSelected({ selected }) {
  const map = useMap();
  useEffect(() => {
    if (!selected) return;
    map.setView([selected.lat, selected.lng], Math.max(map.getZoom(), 9), { animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);
  return null;
}

function LegendDot({ color, label }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="w-3 h-3 rounded-full inline-block" style={{ background: color }} />
      {label}
    </span>
  );
}

export default function App() {
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const data = useRestaurants();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return AIRPORTS.filter((a) => {
      // text search: name or ICAO
      if (q && !a.icao.toLowerCase().includes(q) && !a.name.toLowerCase().includes(q)) {
        return false;
      }
      // restaurant-status filter
      const status = data.airports[a.icao]?.status;
      if (statusFilter === 'yes' && status !== 'yes') return false;
      if (statusFilter === 'no' && status !== 'no') return false;
      // (add more filters here as the data grows, e.g. runway length)
      return true;
    });
  }, [search, statusFilter, data]);

  const handleClose = useCallback(() => setSelected(null), []);
  const handleSelect = useCallback((a) => setSelected(a), []);

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="shrink-0 bg-white border-b border-gray-200 px-5 py-3 flex items-center justify-between shadow-sm z-[1100]">
        <div className="flex items-center gap-3">
          <span className="text-2xl">✈️</span>
          <div>
            <h1 className="text-base font-bold text-gray-900 leading-tight">
              Fly-in Dining <span className="text-gray-400 font-normal text-xs">{VERSION}</span>
            </h1>
            <p className="text-xs text-gray-500">
              GA airfields with a restaurant within a 15-min walk
              {data.generatedAt && (
                <span className="text-gray-400">
                  {' '}· updated {new Date(data.generatedAt).toLocaleDateString()}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-4 text-xs text-gray-600">
          <LegendDot color={STATUS_COLOR.yes} label="Has restaurants" />
          <LegendDot color={STATUS_COLOR.no} label="None found" />
          <LegendDot color={STATUS_COLOR.loading} label="No data" />
        </div>
      </header>

      {/* Body: sidebar + map */}
      <div className="flex-1 flex min-h-0">
        <Sidebar
          airports={filtered}
          totalCount={AIRPORTS.length}
          data={data}
          search={search}
          setSearch={setSearch}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          selected={selected}
          onSelect={handleSelect}
        />

        <div className="flex-1 relative">
          <MapContainer className="absolute inset-0" center={[48.5, 1.5]} zoom={6} scrollWheelZoom>
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
              subdomains="abcd"
              maxZoom={20}
            />
            <FitToAirports airports={filtered} />
            <FlyToSelected selected={selected} />
            {filtered.map((airport) => {
              const status = data.loading
                ? 'loading'
                : data.airports[airport.icao]?.status ?? 'loading';
              return (
                <CircleMarker
                  key={airport.icao}
                  center={[airport.lat, airport.lng]}
                  radius={7}
                  pathOptions={{
                    color: '#ffffff',
                    weight: 2,
                    fillColor: STATUS_COLOR[status] ?? STATUS_COLOR.loading,
                    fillOpacity: 1,
                  }}
                  eventHandlers={{ click: () => setSelected(airport) }}
                />
              );
            })}
          </MapContainer>

          {selected && (
            <DetailPanel
              airport={selected}
              entry={data.airports[selected.icao]}
              onClose={handleClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}
