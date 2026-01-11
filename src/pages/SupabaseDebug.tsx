import React, { useState } from 'react';
import { healthCheck, getSupabase } from '@/integrations/supabase/client';

export default function SupabaseDebug() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function runCheck() {
    setLoading(true);
    try {
      const res = await healthCheck();
      setResult(res);
    } catch (err: any) {
      setResult({ ok: false, status: 'unhealthy', error: err?.message || String(err) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: 'Inter, system-ui, Arial' }}>
      <h2>Supabase Dev Debug</h2>
      <p style={{ color: '#6b7280' }}>This page is for dev/stage testing only. It performs a small read to verify connectivity.</p>
      <div style={{ marginTop: 12 }}>
        <button onClick={runCheck} disabled={loading} style={{ padding: '8px 12px', borderRadius: 8 }}>
          {loading ? 'Checking...' : 'Run Health Check'}
        </button>
      </div>

      {result && (
        <div style={{ marginTop: 16, background: '#f8fafc', padding: 12, borderRadius: 8 }}>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <small style={{ color: '#9ca3af' }}>Supabase URL: {Boolean((getSupabase() as any).url) ? 'configured' : 'not configured'}</small>
      </div>
    </div>
  );
}
