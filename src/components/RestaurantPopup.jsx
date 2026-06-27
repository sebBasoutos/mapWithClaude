const PRICE = ['', '€', '€€', '€€€', '€€€€'];
const BAKERY_TYPES = new Set(['bakery', 'pastry_shop']);

function Stars({ rating }) {
  if (rating == null) return <span className="text-gray-400 text-xs">No rating</span>;
  const full = Math.round(rating);
  return (
    <span className="text-yellow-500 text-sm" title={`${rating}/5`}>
      {'★'.repeat(full)}{'☆'.repeat(5 - full)}
      <span className="text-gray-600 text-xs ml-1">{rating.toFixed(1)}</span>
    </span>
  );
}

function PlaceItem({ place }) {
  return (
    <li className="px-5 py-3 hover:bg-gray-50 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <a
          href={`https://www.google.com/maps/place/?q=place_id:${place.placeId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-blue-700 hover:underline text-sm leading-tight"
        >
          {place.name}
        </a>
        <div className="flex items-center gap-2 shrink-0">
          {place.walkingMinutes != null && (
            <span className="text-xs text-gray-500">🚶 {place.walkingMinutes} min</span>
          )}
          {place.priceLevel != null && (
            <span className="text-xs text-gray-500 font-mono">{PRICE[place.priceLevel]}</span>
          )}
        </div>
      </div>
      <div className="mt-1 flex items-center gap-2 flex-wrap">
        <Stars rating={place.rating} />
        {place.userRatingsTotal > 0 && (
          <span className="text-xs text-gray-400">({place.userRatingsTotal.toLocaleString()})</span>
        )}
      </div>
      {place.vicinity && (
        <p className="text-xs text-gray-400 mt-0.5 truncate">{place.vicinity}</p>
      )}
    </li>
  );
}

export function RestaurantPopup({ airport, entry, onClose }) {
  if (!airport) return null;

  const restaurants = (entry?.places ?? []).filter((p) => !p.types?.some((t) => BAKERY_TYPES.has(t)));
  const bakeries = (entry?.places ?? []).filter((p) => p.types?.some((t) => BAKERY_TYPES.has(t)));

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 pointer-events-none">
      <div
        className="pointer-events-auto w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <div>
            <p className="text-xs font-mono text-blue-600 font-semibold tracking-wider">{airport.icao}</p>
            <h2 className="text-lg font-bold text-gray-900 leading-tight mt-0.5">{airport.name}</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {airport.lat.toFixed(4)}°N, {airport.lng.toFixed(4)}°E
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 text-gray-400 hover:text-gray-700 transition-colors text-2xl leading-none mt-1"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Status badge */}
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
          {entry?.status === 'loading' && (
            <>
              <span className="w-3 h-3 rounded-full bg-gray-400 animate-pulse" />
              <span className="text-sm text-gray-500">Checking nearby restaurants…</span>
            </>
          )}
          {entry?.status === 'yes' && (
            <>
              <span className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-sm font-medium text-green-700">
                {entry.places.length} place{entry.places.length !== 1 ? 's' : ''} within 15 min walk
              </span>
            </>
          )}
          {entry?.status === 'no' && (
            <>
              <span className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-sm font-medium text-red-700">Nothing found within 15 min walk</span>
            </>
          )}
        </div>

        {/* Lists */}
        <div className="max-h-80 overflow-y-auto">
          {restaurants.length > 0 && (
            <>
              {bakeries.length > 0 && (
                <p className="px-5 pt-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Restaurants</p>
              )}
              <ul className="divide-y divide-gray-100">
                {restaurants.map((place) => <PlaceItem key={place.placeId} place={place} />)}
              </ul>
            </>
          )}
          {bakeries.length > 0 && (
            <>
              <p className="px-5 pt-3 text-xs font-semibold text-gray-400 uppercase tracking-wider border-t border-gray-100">Bakeries</p>
              <ul className="divide-y divide-gray-100">
                {bakeries.map((place) => <PlaceItem key={place.placeId} place={place} />)}
              </ul>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-gray-50 text-xs text-gray-400 text-right">
          Data via Google Places · walking distance
        </div>
      </div>
    </div>
  );
}
