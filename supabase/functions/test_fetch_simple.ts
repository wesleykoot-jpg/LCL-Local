/**
 * Minimal fetch test that avoids external imports.
 * Usage:
 *   deno run --allow-net supabase/functions/test_fetch_simple.ts <url>
 */

const url = Deno.args[0] || 'https://example.com';

try {
  const start = Date.now();
  const resp = await fetch(url, { redirect: 'follow' });
  const html = await resp.text();
  const duration = Date.now() - start;

  // Normalize and hash using Web Crypto
  const normalized = html.replace(/\s+/g, ' ').trim();
  const enc = new TextEncoder();
  const data = enc.encode(normalized);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const hashHex = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');

  console.log(JSON.stringify({
    ok: true,
    url,
    status: resp.status,
    finalUrl: resp.url,
    durationMs: duration,
    contentHash: hashHex,
    snippet: html.slice(0, 400),
  }, null, 2));
} catch (err) {
  console.error(JSON.stringify({ ok: false, error: String(err) }, null, 2));
  Deno.exit(1);
}
