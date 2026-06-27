import { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { APIProvider, Map, useMap } from '@vis.gl/react-google-maps';
import { AirportMarker } from './components/AirportMarker';
import { RestaurantPopup } from './components/RestaurantPopup';
import { useRestaurants } from './hooks/useRestaurants';
import AIRPORTS from './data/airports';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '';

// Fit the map to show every airfield in the list on first load.
function FitBounds() {
  const map = useMap();
  useEffect(() => {
    if (!map || AIRPORTS.length === 0) return;
    const bounds = new window.google.maps.LatLngBounds();
    AIRPORTS.forEach((a) => bounds.extend({ lat: a.lat, lng: a.lng }));
    map.fitBounds(bounds, 64);
  }, [map]);
  return null;
}

// Must live inside <Map> so useMap() works.
function MapContents({ selected, onMarkerClick, onClose }) {
  const results = useRestaurants();

  return (
    <>
      <FitBounds />
      {AIRPORTS.map((airport) => (
        <AirportMarker
          key={airport.icao}
          airport={airport}
          status={results[airport.icao]?.status ?? 'loading'}
          onClick={onMarkerClick}
        />
      ))}
      {selected &&
        createPortal(
          <RestaurantPopup
            airport={selected}
            entry={results[selected.icao]}
            onClose={onClose}
          />,
          document.body,
        )}
    </>
  );
}

export default function App() {
  const [selected, setSelected] = useState(null);

  const handleMarkerClick = useCallback((airport) => setSelected(airport), []);
  const handleClose = useCallback(() => setSelected(null), []);

  if (!API_KEY) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="max-w-sm text-center p-8 bg-white rounded-2xl shadow-lg border border-red-200">
          <div className="text-4xl mb-4">🗝️</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">API Key Required</h1>
          <p className="text-gray-600 text-sm">
            Copy <code className="bg-gray-100 px-1 rounded">.env.example</code> to{' '}
            <code className="bg-gray-100 px-1 rounded">.env</code> and add your{' '}
            <strong>VITE_GOOGLE_MAPS_API_KEY</strong>.
          </p>
          <p className="text-gray-500 text-xs mt-3">
            Enable these in Google Cloud Console:
            <br />Maps JavaScript API · Places API
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="shrink-0 bg-white border-b border-gray-200 px-5 py-3 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-3">
          <span className="text-2xl">✈️</span>
          <div>
            <h1 className="text-base font-bold text-gray-900 leading-tight">Fly-in Dining <span className="text-gray-400 font-normal text-xs">v2.2330</span></h1>
            <p className="text-xs text-gray-500">GA airfields with a restaurant within a 15-min walk</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-600">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
            Has restaurants
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
            None found
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-yellow-400 inline-block" />
            API error
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-gray-400 inline-block" />
            Checking…
          </span>
          <button
            className="text-xs text-gray-400 hover:text-gray-700 underline ml-2"
            onClick={() => {
              Object.keys(localStorage)
                .filter((k) => k.startsWith('rzflight_restaurants_'))
                .forEach((k) => localStorage.removeItem(k));
              window.location.reload();
            }}
          >
            Clear cache
          </button>
        </div>
      </header>

      {/* Map */}
      <div className="flex-1">
        <APIProvider apiKey={API_KEY} libraries={['places']}>
          <Map
            mapId="france-airports-map"
            defaultCenter={{ lat: 46.6, lng: 2.3 }}
            defaultZoom={6}
            gestureHandling="greedy"
            className="w-full h-full"
            onClick={handleClose}
          >
            <MapContents
              selected={selected}
              onMarkerClick={handleMarkerClick}
              onClose={handleClose}
            />
          </Map>
        </APIProvider>
      </div>
    </div>
  );
}
