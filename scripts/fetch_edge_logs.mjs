// Node ESM script to call the deployed Edge Function, redact sensitive fields, and write JSONL
// Expects environment variables: LOGS_FETCH_URL (required), LOGS_FETCH_SECRET (optional), MINUTES (optional)

import fs from 'fs';
import path from 'path';

const LOGS_FETCH_URL = process.env.LOGS_FETCH_URL;
if (!LOGS_FETCH_URL) {
  console.error('Missing LOGS_FETCH_URL environment variable');
  process.exit(2);
}

const headers = { 'Content-Type': 'application/json' };
if (process.env.LOGS_FETCH_SECRET) headers['x-log-fetch-token'] = process.env.LOGS_FETCH_SECRET;

const minutes = Number(process.env.MINUTES ?? 15);
const url = new URL(LOGS_FETCH_URL);
url.searchParams.set('minutes', String(minutes));

function redactRow(row) {
  try {
    const r = JSON.parse(JSON.stringify(row));
    if (r.context && typeof r.context === 'object') {
      const ctx = r.context;
      // redact common tokens/keys
      ['authorization', 'supabase_key', 'token', 'password', 'access_token', 'refresh_token', 'session']
        .forEach(k => { if (k in ctx) ctx[k] = '[REDACTED]'; });
      if (ctx.body && typeof ctx.body === 'string' && ctx.body.length > 1500) {
        ctx.body = ctx.body.slice(0, 1000) + '... [TRUNCATED]';
      }
    }
    return r;
  } catch (e) {
    return row;
  }
}

(async () => {
  try {
    const resp = await fetch(url.toString(), { method: 'GET', headers });
    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`Edge function returned ${resp.status}: ${t}`);
    }
    const payload = await resp.json();
    const logsArray = Array.isArray(payload.logs) ? payload.logs : (Array.isArray(payload) ? payload : (payload.logs || []));
    const now = new Date().toISOString();
    const dir = path.join('logs', 'supabase', now.slice(0,10));
    fs.mkdirSync(dir, { recursive: true });
    const filename = path.join(dir, `${now.replace(/[:.]/g,'-')}.jsonl`);
    const stream = fs.createWriteStream(filename, { flags: 'a' });
    for (const row of logsArray) {
      const safe = redactRow(row);
      stream.write(JSON.stringify(safe) + '\n');
    }
    stream.end();
    console.log(`Wrote ${logsArray.length} rows to ${filename}`);
    process.exit(0);
  } catch (err) {
    console.error('Failed to fetch logs:', err);
    process.exit(1);
  }
})();
