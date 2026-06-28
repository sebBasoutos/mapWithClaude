// Shared airfield list — imported by both the client (src) and the API (api).
//
// Attribute data (runwayM = longest runway in metres, avgas/jet fuel, customs,
// ifr = published instrument approach) is best-effort from public sources and
// should be VERIFIED against the official AIP/VAC before operational use.
// Fields flagged below are the least certain.
const AIRPORTS = [
  { icao: 'LFAT', name: 'Le Touquet-Côte d\'Opale', lat: 50.5174, lng: 1.6206, runwayM: 1850, avgas: true, jet: true, customs: true, ifr: true },
  { icao: 'LFAC', name: 'Calais-Dunkerque', lat: 50.9621, lng: 1.9546, runwayM: 1535, avgas: true, jet: false, customs: true, ifr: true },
  { icao: 'LFRG', name: 'Deauville-Normandie', lat: 49.3650, lng: 0.1540, runwayM: 2550, avgas: true, jet: true, customs: true, ifr: true },
  { icao: 'LFKO', name: 'Propriano-Tavaria', lat: 41.6608, lng: 8.8897, runwayM: 1400, avgas: true, jet: false, customs: false, ifr: true },
  { icao: 'LFPN', name: 'Toussus-le-Noble', lat: 48.7519, lng: 2.1061, runwayM: 1110, avgas: true, jet: true, customs: false, ifr: true },
  { icao: 'LFBH', name: 'La Rochelle-Île de Ré', lat: 46.1792, lng: -1.1953, runwayM: 2255, avgas: true, jet: true, customs: true, ifr: true },
  { icao: 'EGSG', name: 'Stapleford', lat: 51.6525, lng: 0.1558, runwayM: 1077, avgas: true, jet: true, customs: true, ifr: false },
  { icao: 'EGSU', name: 'Duxford (IWM)', lat: 52.0911, lng: 0.1314, runwayM: 1199, avgas: true, jet: true, customs: true, ifr: false },
  { icao: 'EGHJ', name: 'Bembridge (Isle of Wight)', lat: 50.6781, lng: -1.1094, runwayM: 827, avgas: false, jet: false, customs: false, ifr: false },
  { icao: 'EGHN', name: 'Sandown (Isle of Wight)', lat: 50.6531, lng: -1.1819, runwayM: 884, avgas: true, jet: false, customs: true, ifr: false },
];

export default AIRPORTS;
