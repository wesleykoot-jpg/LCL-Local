import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import {
  extractFromHydration,
  extractFromJsonLd,
  extractFromMicrodata,
  extractFromFeeds,
  extractFromDom,
  ExtractionContext,
} from "../supabase/functions/_shared/dataExtractors.ts";

// Helper to load .env manually
try {
  const text = await Deno.readTextFile(".env");
  for (const line of text.split("\n")) {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      let value = match[2].trim();
      if (value.startsWith('"') && value.endsWith('"'))
        value = value.slice(1, -1);
      Deno.env.set(match[1], value);
    }
  }
} catch (e) {
  console.log("⚠️ .env load failed or not found");
}

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing Supabase Keys");
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function benchmark() {
  console.log("Fetching 100 sources...");
  const { data: sources, error } = await supabase
    .from("scraper_sources")
    .select("id, name, url")
    .eq("enabled", true)
    .limit(100);

  if (error || !sources) {
    console.error("Failed to fetch sources:", error);
    Deno.exit(1);
  }

  console.log(`Starting benchmark on ${sources.length} sources...`);

  const stats = {
    hydration: 0,
    json_ld: 0,
    microdata: 0,
    feed: 0,
    dom: 0,
    failed: 0,
    total_events: 0,
  };

  const results = [];

  // Process in chunks to avoid overwhelming everything
  const CHUNK_SIZE = 5;

  for (let i = 0; i < sources.length; i += CHUNK_SIZE) {
    const chunk = sources.slice(i, i + CHUNK_SIZE);
    console.log(
      `Processing ${i + 1} to ${Math.min(i + CHUNK_SIZE, sources.length)}...`,
    );

    await Promise.all(
      chunk.map(async (source) => {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

          const resp = await fetch(source.url, {
            signal: controller.signal,
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Benchmark) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            },
          });
          clearTimeout(timeout);

          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const html = await resp.text();

          const ctx: ExtractionContext = {
            baseUrl: source.url,
            sourceName: source.name,
            feedDiscovery: true, // Enable feed discovery
          };

          const winners = [];

          // Run Hydration
          const hyd = extractFromHydration(html, ctx);
          if (hyd.found > 0) {
            stats.hydration++;
            winners.push("hydration");
          }

          // Run JSON-LD
          const json = extractFromJsonLd(html, ctx);
          if (json.found > 0) {
            stats.json_ld++;
            winners.push("json_ld");
          }

          // Run Microdata
          const micro = extractFromMicrodata(html, ctx);
          if (micro.found > 0) {
            stats.microdata++;
            winners.push("microdata");
          }

          // Run Feed (async)
          // Mock fetcher for feed discovery
          const feedCtx = {
            ...ctx,
            fetcher: {
              fetch: async (u: string) => {
                try {
                  const r = await fetch(u);
                  return { html: await r.text(), status: r.status };
                } catch {
                  return { html: "", status: 500 };
                }
              },
            },
          };
          const feed = await extractFromFeeds(html, feedCtx);
          if (feed.found > 0) {
            stats.feed++;
            winners.push("feed");
          }

          // Run DOM
          // Note: DOM will almost *always* find something if there are links/dates unless completely protected
          // We consider it a "winner" only if other structured methods failed?
          // Or we just count it as potential. The prompt asks "what method can be used most".
          // Let's count it if it finds > 0 events.
          const dom = extractFromDom(html, ctx);
          if (dom.found > 0) {
            stats.dom++;
            winners.push("dom");
          }

          const totalFound = Math.max(
            hyd.found,
            json.found,
            micro.found,
            feed.found,
            dom.found,
          ); // Simplified
          stats.total_events += totalFound;

          if (winners.length === 0) stats.failed++;

          results.push({
            name: source.name,
            url: source.url,
            winners: winners.join(", "),
            max_events: totalFound,
          });
        } catch (e) {
          // console.warn(`Failed ${source.name}: ${e.message}`);
          stats.failed++;
          results.push({
            name: source.name,
            url: source.url,
            winners: "ERROR",
            max_events: 0,
          });
        }
      }),
    );
  }

  console.log("\n--- FINAL BENCHMARK STATS (n=100) ---");
  console.table(stats);

  // Calculate percentages
  const n = sources.length;
  console.log(`\nSuccess Rates:`);
  console.log(`Hydration: ${((stats.hydration / n) * 100).toFixed(1)}%`);
  console.log(`JSON-LD:   ${((stats.json_ld / n) * 100).toFixed(1)}%`);
  console.log(`Microdata: ${((stats.microdata / n) * 100).toFixed(1)}%`);
  console.log(`Feeds:     ${((stats.feed / n) * 100).toFixed(1)}%`);
  console.log(`DOM:       ${((stats.dom / n) * 100).toFixed(1)}%`);
  console.log(`Failures:  ${((stats.failed / n) * 100).toFixed(1)}%`);
}

benchmark();
