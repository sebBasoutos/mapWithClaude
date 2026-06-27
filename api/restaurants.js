// GET /api/restaurants — public, returns the precomputed restaurant data.
// Cached at the edge so end users hit Google never and our function rarely.
import { store, RESTAURANTS_KEY } from './_lib/store.js';

export default async function handler(req, res) {
  try {
    const data = await store.get(RESTAURANTS_KEY);
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400');
    res.status(200).json(data ?? { generatedAt: null, airports: {} });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
}
