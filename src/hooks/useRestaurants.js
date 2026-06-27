import { useState, useEffect } from 'react';

// Reads the precomputed data produced by the admin/cron refresh.
// End users never call Google directly anymore.
export function useRestaurants() {
  const [data, setData] = useState({ generatedAt: null, airports: {}, loading: true });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/restaurants')
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setData({ ...d, loading: false });
      })
      .catch(() => {
        if (!cancelled) setData({ generatedAt: null, airports: {}, loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return data;
}
