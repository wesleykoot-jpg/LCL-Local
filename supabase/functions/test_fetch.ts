/**
 * Small test harness to exercise the PageFetcher fetchPage helper.
 * Usage:
 *   deno run --allow-net --allow-env supabase/functions/test_fetch.ts <url> [strategy]
 */

import { fetchPage } from "./_shared/page-fetcher.ts";

const url = Deno.args[0] || "https://example.com";
const strategy = (Deno.args[1] as any) || 'static';

try {
  const res = await fetchPage(url, strategy as any, {});

  const out = {
    ok: true,
    url: url,
    fetcherUsed: res.fetcherUsed,
    statusCode: res.statusCode,
    finalUrl: res.finalUrl,
    durationMs: res.durationMs,
    contentHash: res.contentHash,
    htmlSnippet: res.html.slice(0, 400),
  };

  console.log(JSON.stringify(out, null, 2));
} catch (err) {
  console.error(JSON.stringify({ ok: false, error: String(err) }, null, 2));
  Deno.exit(1);
}
