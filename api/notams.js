// GET /api/notams?icao=LFAC — live NOTAMs for one airfield.
// Proxies the FAA NOTAM API server-side so the credentials stay hidden.
// NOTAMs change frequently, so this is fetched on demand (lightly cached),
// never baked into the weekly restaurant refresh.

export default async function handler(req, res) {
  const icao = String(req.query.icao || '').toUpperCase();
  if (!/^[A-Z0-9]{4}$/.test(icao)) {
    res.status(400).json({ error: 'Invalid ICAO' });
    return;
  }

  const clientId = process.env.FAA_CLIENT_ID;
  const clientSecret = process.env.FAA_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    res.status(503).json({ error: 'not_configured' });
    return;
  }

  try {
    const url =
      `https://external-api.faa.gov/notamapi/v1/notams?icaoLocation=${icao}` +
      `&responseFormat=geoJson&pageSize=50&pageNum=1` +
      `&sortBy=effectiveStartDate&sortOrder=Desc`;

    const r = await fetch(url, {
      headers: { client_id: clientId, client_secret: clientSecret },
    });
    if (!r.ok) {
      res.status(502).json({ error: `NOTAM API ${r.status}` });
      return;
    }
    const data = await r.json();

    const notams = (data.items || []).map((it) => {
      const core = it.properties?.coreNOTAMData?.notam ?? {};
      const translations = it.properties?.coreNOTAMData?.notamTranslation ?? [];
      const icaoText = translations.find((t) => t.type === 'ICAO')?.formattedText;
      return {
        number: core.number || core.id || '',
        text: (icaoText || core.text || '').trim(),
        start: core.effectiveStart || null,
        end: core.effectiveEnd || null,
      };
    });

    // NOTAMs are valid for hours/days; a short cache keeps them current while
    // limiting calls.
    res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=600');
    res.status(200).json({ icao, count: notams.length, notams });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
}
