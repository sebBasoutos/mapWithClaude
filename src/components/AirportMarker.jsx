import { AdvancedMarker } from '@vis.gl/react-google-maps';

const STATUS_STYLE = {
  loading: 'bg-gray-400 border-gray-600',
  yes: 'bg-green-500 border-green-700',
  no: 'bg-red-500 border-red-700',
  error: 'bg-yellow-400 border-yellow-600',
};

export function AirportMarker({ airport, status, onClick }) {
  const color = STATUS_STYLE[status] ?? STATUS_STYLE.loading;

  return (
    <AdvancedMarker
      position={{ lat: airport.lat, lng: airport.lng }}
      onClick={() => onClick(airport)}
      title={airport.name}
    >
      <div className="relative group cursor-pointer">
        {/* Dot */}
        <div
          className={`w-4 h-4 rounded-full border-2 shadow-md transition-transform group-hover:scale-125 ${color}`}
        />
        {/* Tooltip */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap bg-white/90 backdrop-blur text-gray-800 text-xs font-medium px-2 py-1 rounded shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
          <span className="font-bold">{airport.icao}</span> — {airport.name}
        </div>
      </div>
    </AdvancedMarker>
  );
}
