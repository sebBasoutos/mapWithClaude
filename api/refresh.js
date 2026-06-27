// POST /api/refresh — recompute restaurant data for every airfield and store it.
// Auth: either the Vercel Cron bearer token (CRON_SECRET) or the admin password
// header (x-admin-password). Never callable anonymously.
import { store, RESTAURANTS_KEY } from './_lib/store.js';
import { refreshAll } from './_lib/refresh.js';

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

  try {
    const data = await refreshAll();
    await store.set(RESTAURANTS_KEY, data);
    const errors = Object.entries(data.airports)
      .filter(([, v]) => v.status === 'error')
      .map(([icao]) => icao);
    res.status(200).json({
      ok: true,
      generatedAt: data.generatedAt,
      count: Object.keys(data.airports).length,
      errors,
    });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
}
