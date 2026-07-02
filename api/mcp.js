// POST /api/mcp — Model Context Protocol server (Streamable HTTP transport).
//
// Exposes the Fly-in Dining airfield dataset as MCP tools so Claude (or any MCP
// client) can query it directly. Stateless JSON-RPC 2.0: each POST carries one
// request (or a batch) and gets one response back — no sessions, no SSE stream.
//
// Add it in Claude as a custom connector with URL https://<domain>/api/mcp
// (no authentication — the underlying data is already public via /api/restaurants).
//
// Tool definitions and implementations live in _lib/tools.js, shared with the
// in-app chat endpoint (/api/ask).
import { TOOL_DEFS, runTool } from './_lib/tools.js';

const SERVER_INFO = { name: 'flyin-dining', version: '1.0.0' };

// MCP wire format uses camelCase `inputSchema`.
const TOOLS = TOOL_DEFS.map(({ name, description, schema }) => ({
  name,
  description,
  inputSchema: schema,
}));

function textResult(text) {
  return { content: [{ type: 'text', text }] };
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
        const text = await runTool(params?.name, params?.arguments || {});
        return { jsonrpc: '2.0', id, result: textResult(text) };
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
