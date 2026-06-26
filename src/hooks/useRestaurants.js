import { useState, useEffect, useRef } from 'react';
import { useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { usePlacesQueue } from './usePlacesQueue';
import AIRPORTS from '../data/airports';

const CACHE_KEY = 'rzflight_restaurants_v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 h

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL_MS) {
      localStorage.removeItem(CACHE_KEY);
      return {};
    }
    return data;
  } catch {
    return {};
  }
}

function saveCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch {}
}

// status values: 'loading' | 'yes' | 'no' | 'error'
// restaurants[icao] = { status, places: [] }
export function useRestaurants() {
  const map = useMap();
  const placesLib = useMapsLibrary('places');
  const { enqueue } = usePlacesQueue();
  const serviceRef = useRef(null);

  const [results, setResults] = useState(() => {
    const cache = loadCache();
    return Object.fromEntries(
      AIRPORTS.map((a) => [
        a.icao,
        cache[a.icao] ?? { status: 'loading', places: [] },
      ]),
    );
  });

  // Track which airports already have a cached result so we skip them.
  const pending = useRef(
    new Set(
      AIRPORTS.filter((a) => {
        const c = loadCache();
        return !c[a.icao];
      }).map((a) => a.icao),
    ),
  );

  useEffect(() => {
    if (!map || !placesLib) return;

    if (!serviceRef.current) {
      serviceRef.current = new placesLib.PlacesService(map);
    }
    const service = serviceRef.current;

    AIRPORTS.forEach((airport) => {
      if (!pending.current.has(airport.icao)) return;

      enqueue(
        () =>
          new Promise((resolve) => {
            service.nearbySearch(
              {
                location: { lat: airport.lat, lng: airport.lng },
                radius: 1000,
                type: 'restaurant',
              },
              (places, status) => {
                const ok =
                  status === window.google.maps.places.PlacesServiceStatus.OK;
                const entry = {
                  status: ok && places.length > 0 ? 'yes' : 'no',
                  places: ok
                    ? places.slice(0, 10).map((p) => ({
                        name: p.name,
                        rating: p.rating ?? null,
                        userRatingsTotal: p.user_ratings_total ?? 0,
                        priceLevel: p.price_level ?? null,
                        vicinity: p.vicinity ?? '',
                        placeId: p.place_id,
                      }))
                    : [],
                };

                setResults((prev) => {
                  const next = { ...prev, [airport.icao]: entry };
                  // Persist to cache every time a result comes in.
                  const cacheData = {};
                  for (const [k, v] of Object.entries(next)) {
                    if (v.status !== 'loading') cacheData[k] = v;
                  }
                  saveCache(cacheData);
                  return next;
                });

                resolve();
              },
            );
          }),
      );
    });
  }, [map, placesLib, enqueue]);

  return results;
}
