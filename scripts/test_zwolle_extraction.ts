import {
  extractFromHydration,
  extractFromJsonLd,
  extractFromMicrodata,
  extractFromFeeds,
  extractFromDom,
  ExtractionContext,
} from "../supabase/functions/_shared/dataExtractors.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

async function benchmark() {
  const url = "https://www.visitzwolle.com/wat-te-doen/uitgaan/";
  console.log(`Fetching ${url}...`);

  const resp = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  if (!resp.ok) {
    console.error(`Failed to fetch: ${resp.status}`);
    Deno.exit(1);
  }

  const html = await resp.text();
  console.log(`Downloaded ${html.length} bytes.`);

  const ctx: ExtractionContext = {
    baseUrl: url,
    sourceName: "ZwolleBenchmark",
    feedDiscovery: true,
  };

  // Helper to scoring
  const scoreEvent = (e: any) => {
    let score = 0;
    if (e.title && e.title.length > 5) score += 1;
    if (e.date) score += 1;
    if (e.location) score += 1;
    if (e.description && e.description.length > 20) score += 2;
    if (e.imageUrl) score += 1;
    return score;
  };

  console.log("\n--- BENCHMARK RESULTS ---\n");
  console.log(
    "| Strategy | Events Found | Avg Score (0-6) | Avg Desc Len | Notes |",
  );
  console.log("|---|---|---|---|---|");

  // 1. Hydration
  try {
    const res = extractFromHydration(html, ctx);
    const avgScore = res.events.length
      ? (
          res.events.reduce((a, b) => a + scoreEvent(b), 0) / res.events.length
        ).toFixed(1)
      : "0.0";
    const avgDesc = res.events.length
      ? (
          res.events.reduce((a, b) => a + (b.description?.length || 0), 0) /
          res.events.length
        ).toFixed(0)
      : "0";
    console.log(
      `| Hydration | ${res.events.length} | ${avgScore} | ${avgDesc} | ${res.error || "OK"} |`,
    );
  } catch (e) {
    console.log(`| Hydration | ERR | - | - | ${e} |`);
  }

  // 2. JSON-LD
  try {
    const res = extractFromJsonLd(html, ctx);
    const avgScore = res.events.length
      ? (
          res.events.reduce((a, b) => a + scoreEvent(b), 0) / res.events.length
        ).toFixed(1)
      : "0.0";
    const avgDesc = res.events.length
      ? (
          res.events.reduce((a, b) => a + (b.description?.length || 0), 0) /
          res.events.length
        ).toFixed(0)
      : "0";
    console.log(
      `| JSON-LD | ${res.events.length} | ${avgScore} | ${avgDesc} | ${res.error || "OK"} |`,
    );
  } catch (e) {
    console.log(`| JSON-LD | ERR | - | - | ${e} |`);
  }

  // 3. Microdata
  try {
    const res = extractFromMicrodata(html, ctx);
    const avgScore = res.events.length
      ? (
          res.events.reduce((a, b) => a + scoreEvent(b), 0) / res.events.length
        ).toFixed(1)
      : "0.0";
    const avgDesc = res.events.length
      ? (
          res.events.reduce((a, b) => a + (b.description?.length || 0), 0) /
          res.events.length
        ).toFixed(0)
      : "0";
    console.log(
      `| Microdata | ${res.events.length} | ${avgScore} | ${avgDesc} | ${res.error || "OK"} |`,
    );
  } catch (e) {
    console.log(`| Microdata | ERR | - | - | ${e} |`);
  }

  // 4. Feeds
  // We need a dummy fetcher for feed extraction
  const feedCtx = {
    ...ctx,
    fetcher: {
      fetch: async (u) => {
        console.log(`   (Feed fetching ${u})`);
        const r = await fetch(u);
        return { html: await r.text(), status: r.status };
      },
    },
  };
  try {
    const res = await extractFromFeeds(html, feedCtx);
    const avgScore = res.events.length
      ? (
          res.events.reduce((a, b) => a + scoreEvent(b), 0) / res.events.length
        ).toFixed(1)
      : "0.0";
    const avgDesc = res.events.length
      ? (
          res.events.reduce((a, b) => a + (b.description?.length || 0), 0) /
          res.events.length
        ).toFixed(0)
      : "0";
    console.log(
      `| Feeds | ${res.events.length} | ${avgScore} | ${avgDesc} | ${res.error || "OK"} |`,
    );
  } catch (e) {
    console.log(`| Feeds | ERR | - | - | ${e} |`);
  }

  // 5. DOM (The Fallback)
  try {
    const res = extractFromDom(html, ctx);
    const avgScore = res.events.length
      ? (
          res.events.reduce((a, b) => a + scoreEvent(b), 0) / res.events.length
        ).toFixed(1)
      : "0.0";
    const avgDesc = res.events.length
      ? (
          res.events.reduce((a, b) => a + (b.description?.length || 0), 0) /
          res.events.length
        ).toFixed(0)
      : "0";
    console.log(
      `| DOM | ${res.events.length} | ${avgScore} | ${avgDesc} | ${res.error || "OK"} |`,
    );
  } catch (e) {
    console.log(`| DOM | ERR | - | - | ${e} |`);
  }
}

benchmark();
