// POST /api/refresh?offset=0&limit=25 — recompute restaurant data for one slice
// of airfields and merge it into the stored result.
//
// Auth: either the Vercel Cron bearer token (CRON_SECRET) or the admin password
// header (x-admin-password). Never callable anonymously.
//
// Why slices? 566 airfields × ~3 Google calls each is far longer than Vercel's
// 60s limit, so a single call can't refresh everything. The admin panel pages
// through slices with a progress bar; the weekly cron self-chains slice by slice.
import { store, RESTAURANTS_KEY } from './_lib/store.js';
import { refreshSlice, TOTAL_AIRPORTS } from './_lib/refresh.js';

const DEFAULT_LIMIT = 25;

// Kick off the next slice without waiting for it to finish. Once the request
// has been dispatched, we abort the client side — the downstream serverless
// invocation keeps running independently, so batches don't nest and time out.
async function triggerNext(base, offset, limit) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 2500);
  try {
    await fetch(`${base}/api/refresh?offset=${offset}&limit=${limit}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
      signal: ctrl.signal,
    });
  } catch {
    // Expected: aborted after dispatch. The downstream batch runs on its own.
  } finally {
    clearTimeout(t);
  }
}

export default async function handler(req, res) {
  const cronOk =
    !!process.env.CRON_SECRET &&
    req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`;
  const adminOk =
    !!process.env.ADMIN_PASSWORD &&
    req.headers['x-admin-password'] === process.env.ADMIN_PASSWORD;

  if (!cronOk && !adminOk) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const q = req.query || {};
  const offset = Math.max(0, parseInt(q.offset ?? '0', 10) || 0);
  const limit = Math.min(
    50,
    Math.max(1, parseInt(q.limit ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
  );

  try {
    const existing = (await store.get(RESTAURANTS_KEY)) ?? { generatedAt: null, airports: {} };
    const sliceResults = await refreshSlice(offset, limit);

    const nextOffset = offset + limit;
    const done = nextOffset >= TOTAL_AIRPORTS;
    const now = new Date().toISOString();
    const data = {
      // generatedAt marks a fully completed pass; hold the old value until done.
      generatedAt: done ? now : existing.generatedAt ?? null,
      lastBatchAt: now,
      airports: { ...(existing.airports || {}), ...sliceResults },
    };
    await store.set(RESTAURANTS_KEY, data);

    // The weekly cron fires only once; keep the chain going slice by slice.
    if (cronOk && !done && process.env.VERCEL_URL) {
      await triggerNext(`https://${process.env.VERCEL_URL}`, nextOffset, limit);
    }

    const errors = Object.entries(sliceResults)
      .filter(([, v]) => v.status === 'error')
      .map(([icao]) => icao);

    res.status(200).json({
      ok: true,
      processed: Object.keys(sliceResults).length,
      offset,
      nextOffset,
      total: TOTAL_AIRPORTS,
      done,
      generatedAt: data.generatedAt,
      errors,
    });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
}
