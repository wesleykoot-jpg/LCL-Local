import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import {
  extractFromHydration,
  extractFromJsonLd,
  extractFromMicrodata,
  extractFromFeeds,
  extractFromDom,
  ExtractionContext,
} from "../supabase/functions/_shared/dataExtractors.ts";
import * as cheerio from "npm:cheerio@1.0.0-rc.12";

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

async function analyzeFailures() {
  console.log("Fetching sample of sources to probe for failures...");

  // We'll take 50, run extraction, and deep dive on the ones that return 0
  const { data: sources, error } = await supabase
    .from("scraper_sources")
    .select("id, name, url, config")
    .eq("enabled", true)
    .limit(50);

  if (error || !sources) {
    console.error("Failed to fetch sources:", error);
    Deno.exit(1);
  }

  console.log(`Scanning ${sources.length} sources for failures...`);

  const failures = [];

  for (const source of sources) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000); // 15s

      const resp = await fetch(source.url, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", // Better UA
        },
      });
      clearTimeout(timeout);

      const html = await resp.text();
      const status = resp.status;

      // Run full extraction to verify it is indeed a failure
      const ctx: ExtractionContext = {
        baseUrl: source.url,
        sourceName: source.name,
        feedDiscovery: true,
      };

      // Mock fetcher for feed
      const feedCtx = {
        ...ctx,
        fetcher: {
          fetch: async (u) => ({
            html: await (await fetch(u)).text(),
            status: 200,
          }),
        },
      };

      const hyd = extractFromHydration(html, ctx).found;
      const json = extractFromJsonLd(html, ctx).found;
      const micro = extractFromMicrodata(html, ctx).found;
      const feed = (await extractFromFeeds(html, feedCtx)).found;
      const dom = extractFromDom(html, ctx).found;

      const total = hyd + json + micro + feed + dom;

      if (total === 0) {
        // DIAGNOSIS TIME
        const diagnosis = diagnose(html, status, source.url);
        failures.push({
          name: source.name,
          url: source.url,
          status: status,
          diagnosis: diagnosis.reason,
          details: diagnosis.details,
        });
        process.stdout.write("F");
      } else {
        process.stdout.write(".");
      }
    } catch (e) {
      failures.push({
        name: source.name,
        url: source.url,
        status: 0,
        diagnosis: "Network/Timeout",
        details: e.message,
      });
      process.stdout.write("E");
    }
  }

  console.log("\n\n--- FAILURE DIAGNOSIS (Top 15) ---");
  console.table(
    failures.slice(0, 15).map((f) => ({
      name: f.name.substring(0, 30),
      status: f.status,
      reason: f.diagnosis,
    })),
  );

  // Group stats
  const stats = failures.reduce((acc, f) => {
    acc[f.diagnosis] = (acc[f.diagnosis] || 0) + 1;
    return acc;
  }, {});

  console.log("\nFailure Category Breakdown:");
  console.table(stats);
}

function diagnose(
  html: string,
  status: number,
  url: string,
): { reason: string; details: string } {
  if (status === 403 || status === 401)
    return { reason: "Access Denied (Bot Block)", details: `Status ${status}` };
  if (status === 404) return { reason: "Dead Link", details: "404 Not Found" };
  if (status >= 500)
    return { reason: "Server Error", details: `Status ${status}` };

  const $ = cheerio.load(html);
  const bodyText = $("body").text().trim();

  // Check for "Enable JS" messages
  if (
    bodyText.length < 500 &&
    (bodyText.includes("JavaScript") ||
      bodyText.includes("enable") ||
      bodyText.includes("cookie"))
  ) {
    return {
      reason: "Requires JavaScript (SPA)",
      details: "Short body mentioning JS/Cookies",
    };
  }

  // Check for empty body
  if (bodyText.length < 200) {
    return {
      reason: "Empty/Thin Page",
      details: `Body length: ${bodyText.length}`,
    };
  }

  // Check for calendar iframes (common in events)
  if ($("iframe").length > 0) {
    return {
      reason: "Content in iFrame",
      details: `Found ${$("iframe").length} iframes`,
    };
  }

  // Check if it's a generic landing page without list
  const listItems = $("li, article, .card, .item, .event").length;
  if (listItems < 3) {
    return {
      reason: "Structure Mismatch (No List)",
      details: "Could not find list-like elements",
    };
  }

  return {
    reason: "Unknown / Selectors Failed",
    details: "Page looks okay but generic selectors missed",
  };
}

analyzeFailures();
