import { useState, useEffect, useRef } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { usePlacesQueue } from './usePlacesQueue';
import AIRPORTS from '../data/airports';

const CACHE_KEY = 'rzflight_restaurants_v11';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 h
const MAX_WALK_SECONDS = 15 * 60; // 15 min
const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

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

// Walking times from one origin waypoint to many destination waypoints.
// Waypoints are Routes API waypoint objects, e.g. { placeId } or
// { location: { latLng: { latitude, longitude } } }.
async function getWalkingTimes(originWaypoint, destinationWaypoints) {
  const body = {
    origins: [{ waypoint: originWaypoint }],
    destinations: destinationWaypoints.map((w) => ({ waypoint: w })),
    travelMode: 'WALK',
  };

  const res = await fetch('https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': 'originIndex,destinationIndex,duration,distanceMeters,condition',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error('[Routes] HTTP', res.status, await res.text());
    return null;
  }
  const elements = await res.json();
  // computeRouteMatrix returns an array of elements. A route is only valid
  // when condition === 'ROUTE_EXISTS'; duration is like "1234s".
  const byDest = {};
  for (const el of elements) {
    if (el.condition === 'ROUTE_EXISTS' && el.duration) {
      byDest[el.destinationIndex] = {
        seconds: parseInt(el.duration.replace('s', ''), 10),
        meters: el.distanceMeters ?? null,
      };
    }
  }
  return byDest;
}

// Find the airport's own Google place so we can route from the entrance/terminal
// the way Google Maps does, instead of from the runway reference point.
async function findAirportWaypoint(placesLib, airport) {
  try {
    const { places } = await placesLib.Place.searchNearby({
      fields: ['id', 'displayName', 'location'],
      locationRestriction: {
        center: { lat: airport.lat, lng: airport.lng },
        radius: 3000,
      },
      includedTypes: ['airport'],
      maxResultCount: 1,
      rankPreference: 'DISTANCE',
    });
    if (places[0]?.id) {
      console.log(`[Origin] ${airport.icao}: routing from place "${places[0].displayName}" (${places[0].id})`);
      return { placeId: places[0].id };
    }
  } catch (err) {
    console.warn(`[Origin] ${airport.icao}: airport place lookup failed`, err);
  }
  // Fallback: runway reference point.
  console.log(`[Origin] ${airport.icao}: routing from runway coordinates (no airport place found)`);
  return { location: { latLng: { latitude: airport.lat, longitude: airport.lng } } };
}

export function useRestaurants() {
  const placesLib = useMapsLibrary('places');
  const { enqueue } = usePlacesQueue();
  const initiated = useRef(false);

  const [results, setResults] = useState(() => {
    const cache = loadCache();
    return Object.fromEntries(
      AIRPORTS.map((a) => [
        a.icao,
        cache[a.icao] ?? { status: 'loading', places: [] },
      ]),
    );
  });

  useEffect(() => {
    if (!placesLib || initiated.current) return;
    initiated.current = true;

    const cache = loadCache();

    AIRPORTS.forEach((airport) => {
      if (cache[airport.icao]) return;

      enqueue(
        () =>
          new Promise((resolve) => {
            placesLib.Place.searchNearby({
              fields: ['displayName', 'rating', 'userRatingCount', 'priceLevel', 'formattedAddress', 'id', 'location', 'types'],
              locationRestriction: {
                center: { lat: airport.lat, lng: airport.lng },
                radius: 2000,
              },
              includedTypes: ['restaurant', 'cafe', 'bar', 'bakery', 'meal_takeaway', 'meal_delivery', 'sandwich_shop', 'fast_food_restaurant', 'pizza_restaurant', 'french_restaurant'],
              maxResultCount: 20,
              rankPreference: 'DISTANCE',
            })
              .then(async ({ places }) => {
                if (places.length === 0) return { status: 'no', places: [] };

                // Route from the airport place (entrance), like Google Maps does,
                // to each restaurant's exact coordinates.
                const originWaypoint = await findAirportWaypoint(placesLib, airport);
                const destinationWaypoints = places.map((p) => ({
                  location: {
                    latLng: {
                      latitude: p.location?.lat() ?? airport.lat,
                      longitude: p.location?.lng() ?? airport.lng,
                    },
                  },
                }));

                const walkTimes = await getWalkingTimes(originWaypoint, destinationWaypoints);

                const withWalk = places.map((p, i) => {
                  const route = walkTimes?.[i] ?? null;
                  return {
                    name: p.displayName ?? '',
                    rating: p.rating ?? null,
                    userRatingsTotal: p.userRatingCount ?? 0,
                    priceLevel: p.priceLevel ?? null,
                    vicinity: p.formattedAddress ?? '',
                    placeId: p.id,
                    types: p.types ?? [],
                    walkingMinutes: route ? Math.round(route.seconds / 60) : null,
                    walkingSeconds: route ? route.seconds : null,
                    walkingMeters: route ? route.meters : null,
                  };
                });

                // If the Routes API call failed entirely, don't go all-red:
                // show candidates without walking times rather than dropping them.
                const apiWorked = walkTimes !== null;

                const walkable = withWalk
                  .filter((p) =>
                    apiWorked
                      ? p.walkingSeconds != null && p.walkingSeconds <= MAX_WALK_SECONDS
                      : true,
                  )
                  .sort((a, b) => (a.walkingSeconds ?? 1e9) - (b.walkingSeconds ?? 1e9))
                  .slice(0, 10);

                console.log(`[Places] ${airport.icao}: ${places.length} candidates from Places API`);
                withWalk.forEach((p) =>
                  console.log(`  ${p.walkingSeconds != null ? p.walkingSeconds + 's' : 'no route'}  ${p.name}`),
                );
                console.log(`[Places] ${airport.icao}: ${walkable.length} kept (apiWorked=${apiWorked})`);
                return { status: walkable.length > 0 ? 'yes' : 'no', places: walkable };
              })
              .catch((err) => {
                console.error(`[Places] ${airport.icao}: ERROR`, err);
                return { status: 'error', places: [] };
              })
              .then((entry) => {
                setResults((prev) => {
                  const next = { ...prev, [airport.icao]: entry };
                  const cacheData = {};
                  for (const [k, v] of Object.entries(next)) {
                    if (v.status !== 'loading') cacheData[k] = v;
                  }
                  saveCache(cacheData);
                  return next;
                });
                resolve();
              });
          }),
      );
    });
  }, [placesLib, enqueue]);

  return results;
}
