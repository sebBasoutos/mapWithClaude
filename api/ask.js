// POST /api/ask — in-app "Ask Claude" chat about the airfield map.
//
// Calls the Claude API server-side (key stays hidden) with the same airfield
// tools the MCP server exposes, running a manual agentic tool-use loop until
// Claude produces a final text answer. Stateless: the client sends the visible
// conversation history each time.
//
// Guardrails for a public endpoint: per-IP rate limit (via Upstash), capped
// history size/length, capped tool-loop iterations, low effort + small
// max_tokens for short answers.
import Anthropic from '@anthropic-ai/sdk';
import { TOOL_DEFS, runTool } from './_lib/tools.js';
import { store } from './_lib/store.js';

const MODEL = 'claude-opus-4-8';
const MAX_TURNS = 16; // max history messages accepted from the client
const MAX_CHARS = 2000; // per message
const MAX_TOOL_ROUNDS = 5;
const RATE_LIMIT = 10; // requests per IP per minute

const SYSTEM = `You are the in-app assistant for "Fly-in Dining", a map of general-aviation airfields in France and the UK showing restaurants within a 15-minute walk of each field.

- Use the tools to answer questions about airfields (runway length, AVGAS, Jet A1, customs, IFR), nearby restaurants, and live NOTAMs.
- Be concise: a short sentence or a compact list. Plain text only — no markdown headings or tables.
- Always refer to airfields by their 4-letter ICAO code (e.g. LFAT) — the app turns ICAO codes into clickable map links.
- If data is missing (restaurant data not refreshed yet, NOTAM service not configured), say so briefly.
- Politely decline questions unrelated to the app, these airfields, or flying to them.
- This is not a substitute for official pre-flight briefing; add a one-line reminder when discussing NOTAMs or operational decisions.`;

const TOOLS = TOOL_DEFS.map(({ name, description, schema }) => ({
  name,
  description,
  input_schema: schema,
}));

async function allowRequest(ip) {
  try {
    const key = `ask_rl_${ip}`;
    const n = await store.incr(key);
    if (n === 1) await store.expire(key, 60);
    return n <= RATE_LIMIT;
  } catch {
    return true; // don't take the feature down if Redis hiccups
  }
}

// Only accept plain {role, content-string} turns from the client.
function sanitizeHistory(raw) {
  if (!Array.isArray(raw)) return null;
  const msgs = raw
    .filter(
      (m) =>
        m &&
        (m.role === 'user' || m.role === 'assistant') &&
        typeof m.content === 'string' &&
        m.content.trim().length > 0
    )
    .slice(-MAX_TURNS)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
  if (msgs.length === 0 || msgs[msgs.length - 1].role !== 'user') return null;
  return msgs;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(503).json({ error: 'not_configured' });
    return;
  }

  const ip =
    String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0];
  if (!(await allowRequest(ip))) {
    res.status(429).json({ error: 'rate_limited' });
    return;
  }

  const messages = sanitizeHistory(req.body?.messages);
  if (!messages) {
    res.status(400).json({ error: 'Invalid messages' });
    return;
  }

  try {
    const client = new Anthropic();

    let response;
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      response = await client.messages.create({
        model: MODEL,
        max_tokens: 2048,
        thinking: { type: 'adaptive' },
        output_config: { effort: 'low' }, // short lookups; keeps the widget snappy
        system: SYSTEM,
        tools: TOOLS,
        messages,
      });

      if (response.stop_reason !== 'tool_use') break;

      // Echo the assistant turn (incl. thinking blocks) then answer every
      // tool_use with a matching tool_result in a single user turn.
      messages.push({ role: 'assistant', content: response.content });
      const results = [];
      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;
        try {
          const text = await runTool(block.name, block.input);
          results.push({ type: 'tool_result', tool_use_id: block.id, content: text });
        } catch (e) {
          results.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: `Error: ${e?.message || e}`,
            is_error: true,
          });
        }
      }
      messages.push({ role: 'user', content: results });
    }

    const reply = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    res.status(200).json({
      reply: reply || 'Sorry — I could not produce an answer. Please try rephrasing.',
    });
  } catch (e) {
    const status = e?.status === 429 ? 429 : 502;
    res.status(status).json({ error: String(e?.message || e) });
  }
}
