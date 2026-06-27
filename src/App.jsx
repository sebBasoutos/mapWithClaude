import { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import AIRPORTS from './data/airports';
import { useRestaurants } from './hooks/useRestaurants';
import { DetailPanel } from './components/DetailPanel';

const VERSION = 'v2.20260627.2';

const STATUS_COLOR = {
  yes: '#007dbb',
  no: '#c62828',
  error: '#f9a825',
  loading: '#9e9e9e',
};

// Classic Leaflet teardrop marker (matches frenchcustoms), tinted by status.
function pinIcon(color) {
  return L.divIcon({
    className: 'airfield-pin',
    html: `<svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg">
      <path d="M12.5 0C5.6 0 0 5.6 0 12.5 0 21.9 12.5 41 12.5 41S25 21.9 25 12.5C25 5.6 19.4 0 12.5 0z" fill="${color}" stroke="#ffffff" stroke-width="1.5"/>
      <circle cx="12.5" cy="12.5" r="4.5" fill="#ffffff"/>
    </svg>`,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
  });
}

function FitToAirports() {
  const map = useMap();
  useEffect(() => {
    if (AIRPORTS.length === 0) return;
    const bounds = L.latLngBounds(AIRPORTS.map((a) => [a.lat, a.lng]));
    map.fitBounds(bounds, { padding: [60, 60] });
  }, [map]);
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
  const data = useRestaurants();

  const handleClose = useCallback(() => setSelected(null), []);

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

      {/* Map */}
      <div className="flex-1 relative">
        <MapContainer
          className="absolute inset-0"
          center={[48.5, 1.5]}
          zoom={6}
          scrollWheelZoom
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            subdomains="abcd"
            maxZoom={20}
          />
          <FitToAirports />
          {AIRPORTS.map((airport) => {
            const status = data.loading
              ? 'loading'
              : data.airports[airport.icao]?.status ?? 'loading';
            return (
              <Marker
                key={airport.icao}
                position={[airport.lat, airport.lng]}
                icon={pinIcon(STATUS_COLOR[status] ?? STATUS_COLOR.loading)}
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
  );
}
