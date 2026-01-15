// Fetch recent Supabase admin logs edge function
// Default window: 15 minutes (configurable via ?minutes=15 query param)
// Optional protection: set LOGS_FETCH_SECRET in function env and require request header x-log-fetch-token

const DEFAULT_MINUTES = 15;

Deno.serve(async (req: Request) => {
  try {
    // Simple auth: if LOGS_FETCH_SECRET is present in env, require the header
    const LOGS_FETCH_SECRET = Deno.env.get('LOGS_FETCH_SECRET');
    const incomingToken = req.headers.get('x-log-fetch-token');
    if (LOGS_FETCH_SECRET && incomingToken !== LOGS_FETCH_SECRET) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Parse optional minutes query param
    const url = new URL(req.url);
    const minutesParam = Number(url.searchParams.get('minutes') ?? DEFAULT_MINUTES);
    const minutes = Number.isFinite(minutesParam) && minutesParam > 0 ? Math.min(minutesParam, 60 * 24) : DEFAULT_MINUTES;

    const now = new Date();
    const from = new Date(now.getTime() - minutes * 60 * 1000).toISOString();
    const to = now.toISOString();

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Build admin logs endpoint URL - adjust if your project uses a different path
    const adminLogsUrl = `${SUPABASE_URL.replace(/\/$/, '')}/api/v1/admin/logs`;

    const body = { from, to, limit: 5000 };

    const resp = await fetch(adminLogsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({ ...body })
    });

    if (!resp.ok) {
      const text = await resp.text();
      return new Response(JSON.stringify({ error: 'Admin logs request failed', status: resp.status, body: text }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const logs = await resp.json();

    return new Response(JSON.stringify({ from, to, count: Array.isArray(logs) ? logs.length : undefined, logs }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
