// GET /api/notams?icao=LFAC — live NOTAMs for one airfield.
// Fetched on demand (lightly cached), never baked into the weekly refresh.
import { fetchNotams } from './_lib/notams.js';

export default async function handler(req, res) {
  const icao = String(req.query.icao || '').toUpperCase();
  if (!/^[A-Z0-9]{4}$/.test(icao)) {
    res.status(400).json({ error: 'Invalid ICAO' });
    return;
  }

  try {
    const { configured, notams } = await fetchNotams(icao);
    if (!configured) {
      res.status(503).json({ error: 'not_configured' });
      return;
    }
    // NOTAMs are valid for hours/days; a short cache keeps them current while
    // limiting calls.
    res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=600');
    res.status(200).json({ icao, count: notams.length, notams });
  } catch (e) {
    res.status(502).json({ error: String(e?.message || e) });
  }
}
