// Shared NOTAM fetching — used by both the REST endpoint (/api/notams) and the
// MCP server (/api/mcp). Proxies the FAA NOTAM API server-side so the
// credentials stay hidden.

export async function fetchNotams(icao) {
  const clientId = process.env.FAA_CLIENT_ID;
  const clientSecret = process.env.FAA_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return { configured: false, notams: [] };
  }

  const url =
    `https://external-api.faa.gov/notamapi/v1/notams?icaoLocation=${icao}` +
    `&responseFormat=geoJson&pageSize=50&pageNum=1` +
    `&sortBy=effectiveStartDate&sortOrder=Desc`;

  const r = await fetch(url, {
    headers: { client_id: clientId, client_secret: clientSecret },
  });
  if (!r.ok) throw new Error(`NOTAM API ${r.status}`);
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

  return { configured: true, notams };
}
