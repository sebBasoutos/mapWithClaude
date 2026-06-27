// Server-side data refresh. Runs the Google Places (New) + Routes API calls
// once per refresh (admin/cron), so end users never call Google directly.
// Files/folders under api/ starting with "_" are not exposed as routes.
import AIRPORTS from '../../data/airports.js';

const MAX_WALK_SECONDS = 15 * 60; // 15 min
const KEY = process.env.GOOGLE_MAPS_SERVER_KEY;

const FOOD_TYPES = [
  'restaurant', 'cafe', 'bar', 'bakery', 'meal_takeaway', 'meal_delivery',
  'sandwich_shop', 'fast_food_restaurant', 'pizza_restaurant', 'french_restaurant',
];

// A place is kept only if its PRIMARY type is food-related. This drops venues
// that merely carry a food tag (e.g. a barber with a wine bar, a garden-centre
// café, a karaoke bar) while keeping restaurants, cafés, pubs, bakeries, etc.
const FOOD_PRIMARY = new Set([
  'cafe', 'coffee_shop', 'bakery', 'bar', 'pub', 'bistro', 'diner',
  'sandwich_shop', 'ice_cream_shop', 'wine_bar', 'food_court', 'tea_house',
  'dessert_shop', 'donut_shop', 'bagel_shop', 'meal_takeaway', 'meal_delivery',
  'confectionery', 'breakfast_restaurant', 'brunch_restaurant',
]);

function isFoodPrimary(primaryType) {
  if (!primaryType) return false;
  if (primaryType === 'restaurant' || primaryType.endsWith('_restaurant')) return true;
  return FOOD_PRIMARY.has(primaryType);
}

const PRICE_MAP = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

async function searchNearby(airport) {
  const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': KEY,
      'X-Goog-FieldMask':
        'places.id,places.displayName,places.rating,places.userRatingCount,places.priceLevel,places.formattedAddress,places.location,places.types,places.primaryType',
    },
    body: JSON.stringify({
      includedTypes: FOOD_TYPES,
      maxResultCount: 20,
      rankPreference: 'DISTANCE',
      locationRestriction: {
        circle: { center: { latitude: airport.lat, longitude: airport.lng }, radius: 2000 },
      },
    }),
  });
  if (!res.ok) throw new Error(`Places ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.places ?? [];
}

// Route from the airport's own Google place (entrance), like Google Maps does.
async function findAirportOrigin(airport) {
  try {
    const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': KEY,
        'X-Goog-FieldMask': 'places.id,places.location',
      },
      body: JSON.stringify({
        includedTypes: ['airport'],
        maxResultCount: 1,
        rankPreference: 'DISTANCE',
        locationRestriction: {
          circle: { center: { latitude: airport.lat, longitude: airport.lng }, radius: 3000 },
        },
      }),
    });
    if (res.ok) {
      const d = await res.json();
      if (d.places?.[0]?.id) return { placeId: d.places[0].id };
    }
  } catch {
    // fall through to runway coordinates
  }
  return { location: { latLng: { latitude: airport.lat, longitude: airport.lng } } };
}

async function walkTimes(originWaypoint, places) {
  const res = await fetch('https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': KEY,
      'X-Goog-FieldMask': 'originIndex,destinationIndex,duration,distanceMeters,condition',
    },
    body: JSON.stringify({
      origins: [{ waypoint: originWaypoint }],
      destinations: places.map((p) => ({
        waypoint: {
          location: { latLng: { latitude: p.location.latitude, longitude: p.location.longitude } },
        },
      })),
      travelMode: 'WALK',
    }),
  });
  if (!res.ok) throw new Error(`Routes ${res.status}: ${await res.text()}`);
  const arr = await res.json();
  const byDest = {};
  for (const el of arr) {
    if (el.condition === 'ROUTE_EXISTS' && el.duration) {
      byDest[el.destinationIndex] = {
        seconds: parseInt(el.duration.replace('s', ''), 10),
        meters: el.distanceMeters ?? null,
      };
    }
  }
  return byDest;
}

export async function refreshAirport(airport) {
  const all = await searchNearby(airport);
  const places = all.filter((p) => isFoodPrimary(p.primaryType));
  if (places.length === 0) return { status: 'no', places: [] };

  const origin = await findAirportOrigin(airport);
  const times = await walkTimes(origin, places);

  const withWalk = places.map((p, i) => {
    const r = times[i] ?? null;
    return {
      name: p.displayName?.text ?? '',
      rating: p.rating ?? null,
      userRatingsTotal: p.userRatingCount ?? 0,
      priceLevel: p.priceLevel in PRICE_MAP ? PRICE_MAP[p.priceLevel] : null,
      vicinity: p.formattedAddress ?? '',
      placeId: p.id,
      types: p.types ?? [],
      walkingMinutes: r ? Math.round(r.seconds / 60) : null,
      walkingSeconds: r ? r.seconds : null,
      walkingMeters: r ? r.meters : null,
    };
  });

  const walkable = withWalk
    .filter((p) => p.walkingSeconds != null && p.walkingSeconds <= MAX_WALK_SECONDS)
    .sort((a, b) => a.walkingSeconds - b.walkingSeconds)
    .slice(0, 10);

  return { status: walkable.length > 0 ? 'yes' : 'no', places: walkable };
}

export async function refreshAll() {
  const airports = {};
  for (const a of AIRPORTS) {
    try {
      airports[a.icao] = await refreshAirport(a);
    } catch (e) {
      airports[a.icao] = { status: 'error', places: [], error: String(e?.message || e) };
    }
  }
  return { generatedAt: new Date().toISOString(), airports };
}
