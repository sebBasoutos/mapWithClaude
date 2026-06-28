import { useState, useEffect, useCallback } from 'react';
import AIRPORTS from './data/airports';

const PW_KEY = 'flyin_admin_pw';

function StatusPill({ status }) {
  const map = {
    yes: ['bg-green-100 text-green-800', 'Has food'],
    no: ['bg-red-100 text-red-700', 'None'],
    error: ['bg-yellow-100 text-yellow-800', 'Error'],
    missing: ['bg-gray-100 text-gray-500', 'Not fetched'],
  };
  const [cls, label] = map[status] ?? map.missing;
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>;
}

export default function Admin() {
  const [password, setPassword] = useState(() => sessionStorage.getItem(PW_KEY) ?? '');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/restaurants?cb=' + Date.now());
      setData(await res.json());
    } catch (e) {
      setMessage({ type: 'error', text: `Failed to load data: ${e.message}` });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const runRefresh = useCallback(async () => {
    if (!password) {
      setMessage({ type: 'error', text: 'Enter the admin password first.' });
      return;
    }
    setRefreshing(true);
    setMessage(null);
    try {
      const res = await fetch('/api/refresh', {
        method: 'POST',
        headers: { 'x-admin-password': password },
      });
      const body = await res.json();
      if (!res.ok) {
        setMessage({ type: 'error', text: body.error || `Refresh failed (${res.status})` });
      } else {
        sessionStorage.setItem(PW_KEY, password);
        const errNote = body.errors?.length ? ` · errors: ${body.errors.join(', ')}` : '';
        setMessage({ type: 'success', text: `Refreshed ${body.count} airfields${errNote}` });
        await loadData();
      }
    } catch (e) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setRefreshing(false);
    }
  }, [password, loadData]);

  const airportsData = data?.airports ?? {};

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-3xl mx-auto px-5 py-8">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-bold">Admin — Fly-in Dining</h1>
          <a href="/" className="text-sm text-blue-600 hover:underline">← Back to map</a>
        </div>
        <p className="text-sm text-gray-500 mb-6">
          Data last generated:{' '}
          <strong>{data?.generatedAt ? new Date(data.generatedAt).toLocaleString() : 'never'}</strong>
        </p>

        {/* Refresh controls */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6 shadow-sm">
          <label className="block text-sm font-medium text-gray-700 mb-1">Admin password</label>
          <div className="flex gap-2">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={runRefresh}
              disabled={refreshing}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {refreshing ? 'Refreshing…' : 'Refresh now'}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Calls Google for all {AIRPORTS.length} airfields and stores the result. Takes ~10–30s.
          </p>
          {message && (
            <p className={`text-sm mt-3 ${message.type === 'error' ? 'text-red-600' : 'text-green-700'}`}>
              {message.text}
            </p>
          )}
        </div>

        {/* Status table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-2">ICAO</th>
                <th className="text-left px-4 py-2">Airfield</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-right px-4 py-2">Places</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Loading…</td></tr>
              ) : (
                AIRPORTS.map((a) => {
                  const entry = airportsData[a.icao];
                  return (
                    <tr key={a.icao}>
                      <td className="px-4 py-2 font-mono text-blue-700">{a.icao}</td>
                      <td className="px-4 py-2">{a.name}</td>
                      <td className="px-4 py-2"><StatusPill status={entry?.status ?? 'missing'} /></td>
                      <td className="px-4 py-2 text-right text-gray-600">{entry?.places?.length ?? '—'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
