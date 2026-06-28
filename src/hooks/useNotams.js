import { useState, useEffect } from 'react';

// Fetches live NOTAMs for an ICAO from our serverless proxy.
export function useNotams(icao) {
  const [state, setState] = useState({ loading: true, notams: [], error: null });

  useEffect(() => {
    if (!icao) return;
    let cancelled = false;
    setState({ loading: true, notams: [], error: null });
    fetch(`/api/notams?icao=${icao}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) {
          setState({ loading: false, notams: d.notams || [], error: d.error || null });
        }
      })
      .catch((e) => {
        if (!cancelled) setState({ loading: false, notams: [], error: String(e) });
      });
    return () => {
      cancelled = true;
    };
  }, [icao]);

  return state;
}
