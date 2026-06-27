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
    <li className="py-3 border-b border-gray-100 last:border-0">
      <div className="flex items-start justify-between gap-2">
        <a
          href={`https://www.google.com/maps/place/?q=place_id:${place.placeId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-[#2d6db5] hover:underline text-sm leading-tight"
        >
          {place.name}
        </a>
        <div className="flex items-center gap-2 shrink-0">
          {place.walkingMinutes != null && (
            <span className="text-xs text-gray-500 whitespace-nowrap">🚶 {place.walkingMinutes} min</span>
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
      {place.vicinity && <p className="text-xs text-gray-400 mt-0.5">{place.vicinity}</p>}
    </li>
  );
}

export function DetailPanel({ airport, entry, onClose }) {
  if (!airport) return null;

  const places = entry?.places ?? [];
  const restaurants = places.filter((p) => !p.types?.some((t) => BAKERY_TYPES.has(t)));
  const bakeries = places.filter((p) => p.types?.some((t) => BAKERY_TYPES.has(t)));
  const status = entry?.status;

  return (
    <div className="absolute top-0 right-0 h-full w-full sm:w-[400px] bg-white shadow-2xl z-[1000] flex flex-col">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-gray-100 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 text-2xl leading-none"
          aria-label="Close"
        >
          ×
        </button>
        <h2 className="text-2xl font-bold text-gray-900 leading-none">{airport.icao}</h2>
        <p className="text-sm font-semibold tracking-wide text-[#2d6db5] uppercase mt-1">
          {airport.name}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          {airport.lat.toFixed(4)}°, {airport.lng.toFixed(4)}°
        </p>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {status === 'yes' && (
          <>
            {restaurants.length > 0 && (
              <section className="mb-4">
                <h3 className="text-sm font-semibold italic text-[#2d6db5] mb-1">Restaurants</h3>
                <ul>{restaurants.map((p) => <PlaceItem key={p.placeId} place={p} />)}</ul>
              </section>
            )}
            {bakeries.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold italic text-[#2d6db5] mb-1">Bakeries</h3>
                <ul>{bakeries.map((p) => <PlaceItem key={p.placeId} place={p} />)}</ul>
              </section>
            )}
          </>
        )}
        {status === 'no' && (
          <p className="text-sm text-gray-500">No restaurants within a 15-minute walk.</p>
        )}
        {status === 'error' && (
          <p className="text-sm text-yellow-700">Couldn’t fetch data for this airfield.</p>
        )}
        {!status && <p className="text-sm text-gray-400">No data yet — run a refresh in the admin panel.</p>}
      </div>
    </div>
  );
}
