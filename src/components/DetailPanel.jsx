import { useNotams } from '../hooks/useNotams';

const PRICE = ['', '€', '€€', '€€€', '€€€€'];
const BAKERY_TYPES = new Set(['bakery', 'pastry_shop']);

const FAA_NOTAM_SEARCH = 'https://notams.aim.faa.gov/notamSearch/';

function fmtDate(dt) {
  if (!dt) return '';
  const d = new Date(dt);
  return isNaN(d.getTime()) ? dt : d.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
}

function LinkPill({ href, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="px-3 py-1.5 rounded-full bg-brand text-white text-xs font-medium hover:bg-brand-dark transition-colors"
    >
      {children} ↗
    </a>
  );
}

function Badge({ children }) {
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-brand border border-blue-100">
      {children}
    </span>
  );
}

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
          className="font-medium text-brand hover:underline text-sm leading-tight"
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

function NotamsSection({ icao }) {
  const { loading, notams, error } = useNotams(icao);
  const fallback = (
    <a className="text-brand hover:underline" href={FAA_NOTAM_SEARCH} target="_blank" rel="noopener noreferrer">
      FAA NOTAM Search ↗
    </a>
  );

  return (
    <section className="mt-5 pt-4 border-t border-gray-100">
      <h3 className="text-sm font-semibold italic text-brand mb-2">NOTAMs</h3>
      {loading && <p className="text-sm text-gray-400">Loading NOTAMs…</p>}
      {!loading && error === 'not_configured' && (
        <p className="text-sm text-gray-500">NOTAM service not configured. {fallback}</p>
      )}
      {!loading && error && error !== 'not_configured' && (
        <p className="text-sm text-yellow-700">Couldn’t load NOTAMs. {fallback}</p>
      )}
      {!loading && !error && notams.length === 0 && (
        <p className="text-sm text-gray-500">No current NOTAMs.</p>
      )}
      {!loading && !error && notams.length > 0 && (
        <ul className="space-y-2">
          {notams.map((n, i) => (
            <li key={n.number || i}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-semibold text-gray-700">{n.number}</span>
                {n.end && <span className="text-xs text-gray-400">until {fmtDate(n.end)}</span>}
              </div>
              <pre className="mt-0.5 whitespace-pre-wrap font-mono text-[11px] text-gray-600 leading-snug">
                {n.text}
              </pre>
            </li>
          ))}
        </ul>
      )}
    </section>
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
        <p className="text-sm font-semibold tracking-wide text-brand uppercase mt-1">
          {airport.name}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          {airport.lat.toFixed(4)}°, {airport.lng.toFixed(4)}°
        </p>

        {/* Airfield attributes */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {airport.runwayM != null && <Badge>{airport.runwayM} m</Badge>}
          {airport.ifr && <Badge>IFR</Badge>}
          {airport.customs && <Badge>Customs</Badge>}
          {airport.avgas && <Badge>AVGAS</Badge>}
          {airport.jet && <Badge>Jet A1</Badge>}
        </div>

        {/* External links */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {airport.icao.startsWith('LF') && (
            <LinkPill href="https://www.sia.aviation-civile.gouv.fr/atlas-vac.html">VAC</LinkPill>
          )}
          <LinkPill href={`https://skyvector.com/airport/${airport.icao}`}>AIP</LinkPill>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {status === 'yes' && (
          <>
            {restaurants.length > 0 && (
              <section className="mb-4">
                <h3 className="text-sm font-semibold italic text-brand mb-1">Restaurants</h3>
                <ul>{restaurants.map((p) => <PlaceItem key={p.placeId} place={p} />)}</ul>
              </section>
            )}
            {bakeries.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold italic text-brand mb-1">Bakeries</h3>
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

        <NotamsSection icao={airport.icao} />
      </div>
    </div>
  );
}
