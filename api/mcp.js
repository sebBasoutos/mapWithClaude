// POST /api/mcp — Model Context Protocol server (Streamable HTTP transport).
//
// Exposes the Fly-in Dining airfield dataset as MCP tools so Claude (or any MCP
// client) can query it directly. Stateless JSON-RPC 2.0: each POST carries one
// request (or a batch) and gets one response back — no sessions, no SSE stream.
//
// Add it in Claude as a custom connector with URL https://<domain>/api/mcp
// (no authentication — the underlying data is already public via /api/restaurants).
import AIRPORTS from '../data/airports.js';
import { store, RESTAURANTS_KEY } from './_lib/store.js';
import { fetchNotams } from './_lib/notams.js';

const SERVER_INFO = { name: 'flyin-dining', version: '1.0.0' };
const BY_ICAO = new Map(AIRPORTS.map((a) => [a.icao, a]));

function countryOf(icao) {
  if (icao.startsWith('LF')) return 'FR';
  if (icao.startsWith('EG')) return 'UK';
  return 'XX';
}

async function getRestaurantData() {
  try {
    return (await store.get(RESTAURANTS_KEY)) ?? { generatedAt: null, airports: {} };
  } catch {
    return { generatedAt: null, airports: {} };
  }
}

// ---- Tool definitions (advertised via tools/list) -------------------------

const TOOLS = [
  {
    name: 'search_airports',
    description:
      'Search general-aviation airfields in France and the UK by name or ICAO code, with optional filters: country, minimum runway length, AVGAS/Jet A1/customs/IFR availability, and whether a restaurant is within a 15-minute walk. Returns matching airfields with their attributes.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Case-insensitive substring matched against ICAO code or airfield name.' },
        country: { type: 'string', enum: ['FR', 'UK'], description: 'Limit to France (FR) or the United Kingdom (UK).' },
        min_runway_m: { type: 'number', description: 'Only airfields whose longest runway is at least this many metres. Airfields with unknown runway length are excluded when this is set.' },
        avgas: { type: 'boolean', description: 'Only airfields with AVGAS/100LL.' },
        jet: { type: 'boolean', description: 'Only airfields with Jet A1.' },
        customs: { type: 'boolean', description: 'Only airfields with customs / border control.' },
        ifr: { type: 'boolean', description: 'Only airfields with a published instrument approach.' },
        has_restaurants: { type: 'boolean', description: 'Only airfields with at least one restaurant within a 15-minute walk (per the latest data refresh).' },
        limit: { type: 'number', description: 'Maximum results to return (default 50).' },
      },
    },
  },
  {
    name: 'get_airport',
    description:
      'Get full details for one airfield by ICAO code: attributes (runway, fuel, customs, IFR) and the list of restaurants within a 15-minute walk (name, rating, walking time, price, Google Maps link).',
    inputSchema: {
      type: 'object',
      properties: { icao: { type: 'string', description: '4-letter ICAO code, e.g. LFAT.' } },
      required: ['icao'],
    },
  },
  {
    name: 'get_notams',
    description:
      'Get current NOTAMs (Notices to Air Missions) for an airfield by ICAO code, fetched live from the FAA NOTAM API.',
    inputSchema: {
      type: 'object',
      properties: { icao: { type: 'string', description: '4-letter ICAO code, e.g. LFAT.' } },
      required: ['icao'],
    },
  },
];

// ---- Tool implementations -------------------------------------------------

async function toolSearchAirports(args) {
  const q = String(args.query || '').trim().toLowerCase();
  const data = await getRestaurantData();

  const matches = AIRPORTS.filter((a) => {
    if (q && !a.icao.toLowerCase().includes(q) && !a.name.toLowerCase().includes(q)) return false;
    if (args.country && countryOf(a.icao) !== args.country) return false;
    if (args.min_runway_m != null && (a.runwayM == null || a.runwayM < args.min_runway_m)) return false;
    if (args.avgas && !a.avgas) return false;
    if (args.jet && !a.jet) return false;
    if (args.customs && !a.customs) return false;
    if (args.ifr && !a.ifr) return false;
    if (args.has_restaurants && data.airports[a.icao]?.status !== 'yes') return false;
    return true;
  });

  const limit = args.limit != null ? Math.max(1, Math.floor(args.limit)) : 50;
  const shown = matches.slice(0, limit).map((a) => {
    const entry = data.airports[a.icao];
    return {
      icao: a.icao,
      name: a.name,
      country: countryOf(a.icao),
      lat: a.lat,
      lng: a.lng,
      runwayM: a.runwayM,
      avgas: a.avgas,
      jet: a.jet,
      customs: a.customs,
      ifr: a.ifr,
      restaurants: entry?.status === 'yes' ? entry.places?.length ?? 0 : entry?.status ?? 'not_refreshed',
    };
  });

  const header =
    `Found ${matches.length} airfield(s)` +
    (matches.length > shown.length ? `, showing first ${shown.length}` : '') +
    '.';
  return textResult(`${header}\n\n${JSON.stringify(shown, null, 2)}`);
}

async function toolGetAirport(args) {
  const icao = String(args.icao || '').toUpperCase();
  const a = BY_ICAO.get(icao);
  if (!a) throw new Error(`No airfield with ICAO code ${icao}`);

  const data = await getRestaurantData();
  const entry = data.airports[icao];
  const restaurants = (entry?.places ?? []).map((p) => ({
    name: p.name,
    rating: p.rating,
    reviews: p.userRatingsTotal,
    walkingMinutes: p.walkingMinutes,
    priceLevel: p.priceLevel,
    address: p.vicinity,
    mapsUrl: p.placeId ? `https://www.google.com/maps/place/?q=place_id:${p.placeId}` : null,
  }));

  const detail = {
    icao: a.icao,
    name: a.name,
    country: countryOf(a.icao),
    lat: a.lat,
    lng: a.lng,
    runwayM: a.runwayM,
    avgas: a.avgas,
    jet: a.jet,
    customs: a.customs,
    ifr: a.ifr,
    restaurantStatus: entry?.status ?? 'not_refreshed',
    dataGeneratedAt: data.generatedAt,
    restaurants,
    links: {
      skyvector: `https://skyvector.com/airport/${a.icao}`,
      vac: a.icao.startsWith('LF') ? 'https://www.sia.aviation-civile.gouv.fr/atlas-vac.html' : null,
    },
  };
  return textResult(JSON.stringify(detail, null, 2));
}

async function toolGetNotams(args) {
  const icao = String(args.icao || '').toUpperCase();
  if (!/^[A-Z0-9]{4}$/.test(icao)) throw new Error('Invalid ICAO code');

  const { configured, notams } = await fetchNotams(icao);
  if (!configured) {
    return textResult(
      `NOTAM service is not configured (missing FAA API credentials). ` +
        `See https://notams.aim.faa.gov/notamSearch/ for ${icao}.`
    );
  }
  if (notams.length === 0) return textResult(`No current NOTAMs for ${icao}.`);

  const body = notams
    .map((n) => `${n.number}${n.end ? ` (until ${n.end})` : ''}\n${n.text}`)
    .join('\n\n');
  return textResult(`${notams.length} NOTAM(s) for ${icao}:\n\n${body}`);
}

function textResult(text) {
  return { content: [{ type: 'text', text }] };
}

async function callTool(name, args) {
  switch (name) {
    case 'search_airports': return toolSearchAirports(args);
    case 'get_airport': return toolGetAirport(args);
    case 'get_notams': return toolGetNotams(args);
    default: throw new Error(`Unknown tool: ${name}`);
  }
}

// ---- JSON-RPC plumbing ----------------------------------------------------

// Returns a JSON-RPC response object, or null for notifications (no reply).
async function handleMessage(msg) {
  const { id, method, params } = msg || {};
  const isNotification = id === undefined || id === null;

  switch (method) {
    case 'initialize':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: params?.protocolVersion || '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: SERVER_INFO,
        },
      };
    case 'notifications/initialized':
    case 'notifications/cancelled':
      return null;
    case 'ping':
      return { jsonrpc: '2.0', id, result: {} };
    case 'tools/list':
      return { jsonrpc: '2.0', id, result: { tools: TOOLS } };
    case 'tools/call': {
      try {
        const result = await callTool(params?.name, params?.arguments || {});
        return { jsonrpc: '2.0', id, result };
      } catch (e) {
        // Tool errors are reported inside the result, not as protocol errors,
        // so the model can see and react to them.
        return {
          jsonrpc: '2.0',
          id,
          result: { content: [{ type: 'text', text: `Error: ${e?.message || e}` }], isError: true },
        };
      }
    }
    default:
      if (isNotification) return null;
      return { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } };
  }
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body) {
    try { return JSON.parse(req.body); } catch { return null; }
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Mcp-Session-Id, mcp-protocol-version');
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method === 'GET') {
    // We don't offer a server-initiated SSE stream; a stateless server may
    // decline GET per the Streamable HTTP spec.
    res.status(405).json({ jsonrpc: '2.0', id: null, error: { code: -32000, message: 'Method not allowed' } });
    return;
  }
  if (req.method !== 'POST') { res.status(405).end(); return; }

  const body = await readBody(req);
  if (body == null) {
    res.status(400).json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
    return;
  }

  try {
    if (Array.isArray(body)) {
      const responses = [];
      for (const msg of body) {
        const r = await handleMessage(msg);
        if (r) responses.push(r);
      }
      if (responses.length === 0) { res.status(202).end(); return; }
      res.status(200).json(responses);
    } else {
      const r = await handleMessage(body);
      if (!r) { res.status(202).end(); return; }
      res.status(200).json(r);
    }
  } catch (e) {
    res.status(500).json({ jsonrpc: '2.0', id: null, error: { code: -32603, message: String(e?.message || e) } });
  }
}
