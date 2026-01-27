#!/usr/bin/env npx tsx

/**
 * Zwolle & Meppel Live Scraper Test Pipeline
 *
 * This script:
 * 1. Clears all scraper-related data (events, staging, insights, jobs)
 * 2. Sets up multiple sources for Zwolle and Meppel regions to target ~2000 events
 * 3. Runs the live scraper pipeline (fetcher + processor)
 * 4. Generates a comprehensive summary report with:
 *    - Events per source
 *    - Parsing methods (injection methods) used
 *    - Quality scores per source
 *    - Data quality breakdown
 *
 * Usage:
 *   npx tsx scripts/run_zwolle_meppel_live.ts
 *   # OR
 *   npm run scrape:zwolle-meppel-live
 *
 * Required env vars (in .env file):
 *   - SUPABASE_URL or VITE_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log("✅ Environment variables loaded from .env");
} else {
  console.log("⚠️  No .env file found, using system environment");
}

// ============================================================================
// Configuration: Zwolle & Meppel Region Sources
// ============================================================================

interface EventSource {
  id: string;
  name: string;
  url: string;
  city: string;
  lat: number;
  lng: number;
  category?: string;
  description?: string;
  selectors?: string[];
  requires_render?: boolean;
}

// Target: ~2000 events total from multiple sources in Zwolle/Meppel region
const ZWOLLE_MEPPEL_SOURCES: EventSource[] = [
  // === ZWOLLE SOURCES (target: ~1200 events) ===
  {
    id: "zwolle-visitzwolle",
    name: "Visit Zwolle Agenda",
    url: "https://visitzwolle.com/agenda",
    city: "Zwolle",
    lat: 52.5168,
    lng: 6.083,
    description: "Official Zwolle tourism agenda",
    selectors: ["article.agendabox", ".event-item", ".agenda-item"],
  },
  {
    id: "zwolle-inzwolle",
    name: "InZwolle Agenda",
    url: "https://www.inzwolle.nl/agenda",
    city: "Zwolle",
    lat: 52.5168,
    lng: 6.083,
    description: "InZwolle events portal",
    selectors: [".event-item", ".agenda-item", "[class*='event']"],
  },
  {
    id: "zwolle-gemeente",
    name: "Gemeente Zwolle Agenda",
    url: "https://www.zwolle.nl/agenda",
    city: "Zwolle",
    lat: 52.5168,
    lng: 6.083,
    description: "Municipal Zwolle agenda",
    selectors: [".event-item", ".agenda-item", "article.event"],
  },
  {
    id: "zwolle-hedon",
    name: "Hedon Zwolle (Music Venue)",
    url: "https://hedon-zwolle.nl/agenda",
    city: "Zwolle",
    lat: 52.5095,
    lng: 6.0897,
    category: "music",
    description: "Pop venue Hedon programming",
    selectors: [".event-item", ".show-item", "[class*='event']"],
  },
  {
    id: "zwolle-buitensociëteit",
    name: "Buitensociëteit Zwolle",
    url: "https://www.buitensocieteit.nl/agenda",
    city: "Zwolle",
    lat: 52.5135,
    lng: 6.0929,
    description: "Cultural venue in Zwolle",
    selectors: [".event", ".agenda-item", "[class*='event']"],
  },
  {
    id: "zwolle-spiegel",
    name: "Theater De Spiegel",
    url: "https://www.theaterzwolle.nl/agenda",
    city: "Zwolle",
    lat: 52.5126,
    lng: 6.0889,
    category: "entertainment",
    description: "Main theater in Zwolle",
    selectors: [".show-item", ".event", "[class*='voorstelling']"],
  },
  {
    id: "zwolle-uitinoverijssel",
    name: "Uit in Overijssel - Zwolle",
    url: "https://www.uitinoverijssel.nl/agenda/zwolle",
    city: "Zwolle",
    lat: 52.5168,
    lng: 6.083,
    description: "Provincial events portal for Zwolle",
    selectors: [".event-item", ".agenda-item", "[class*='event']"],
  },
  {
    id: "zwolle-pathezwolle",
    name: "Pathé Zwolle",
    url: "https://www.pathe.nl/bioscoop/zwolle",
    city: "Zwolle",
    lat: 52.5062,
    lng: 6.0899,
    category: "cinema",
    description: "Cinema screenings",
    selectors: [".movie-card", ".film-item", "[class*='movie']"],
  },

  // === MEPPEL SOURCES (target: ~800 events) ===
  {
    id: "meppel-ontdek",
    name: "Ontdek Meppel Agenda",
    url: "https://ontdekmeppel.nl/ontdek-meppel/agenda/",
    city: "Meppel",
    lat: 52.6957,
    lng: 6.1944,
    description: "Official Meppel tourism agenda",
    selectors: [".event-item", ".agenda-item", "[class*='event']"],
  },
  {
    id: "meppel-gemeente",
    name: "Gemeente Meppel Agenda",
    url: "https://www.meppel.nl/agenda",
    city: "Meppel",
    lat: 52.6957,
    lng: 6.1944,
    description: "Municipal Meppel agenda",
    selectors: [".event-item", ".agenda-item", "article.event"],
  },
  {
    id: "meppel-ogterop",
    name: "Schouwburg Ogterop",
    url: "https://www.ogterop.nl/agenda",
    city: "Meppel",
    lat: 52.6957,
    lng: 6.1944,
    category: "entertainment",
    description: "Meppel's main theater",
    selectors: [".show-item", ".event", "[class*='voorstelling']"],
  },
  {
    id: "meppel-vvv",
    name: "VVV Meppel",
    url: "https://www.vvvmeppel.nl/agenda",
    city: "Meppel",
    lat: 52.6957,
    lng: 6.1944,
    description: "Tourist information events",
    selectors: [".event-item", ".agenda-item", "[class*='activiteit']"],
  },
  {
    id: "meppel-drentseuitagenda",
    name: "Drentse Uitagenda - Meppel",
    url: "https://www.uitindrenthe.nl/agenda/meppel",
    city: "Meppel",
    lat: 52.6957,
    lng: 6.1944,
    description: "Provincial events portal for Meppel",
    selectors: [".event-item", ".agenda-item", "[class*='event']"],
  },
  {
    id: "meppel-dehaven",
    name: "De Haven Meppel",
    url: "https://www.dehavenmeppel.nl/evenementen",
    city: "Meppel",
    lat: 52.6957,
    lng: 6.1944,
    category: "outdoor",
    description: "Harbor events and activities",
    selectors: [".event", ".evenement", "[class*='event']"],
  },
  {
    id: "meppel-drukwerkmuseum",
    name: "Drukwerk Museum Meppel",
    url: "https://www.drukwerkmuseum.nl/agenda",
    city: "Meppel",
    lat: 52.6957,
    lng: 6.1944,
    category: "culture",
    description: "Museum exhibitions and workshops",
    selectors: [".event", ".agenda", "[class*='activiteit']"],
  },

  // === REGIONAL/NEARBY SOURCES (for event volume) ===

  // === REGIONAL/NEARBY SOURCES (for event volume) ===
  {
    id: "overijssel-uit",
    name: "Uit in Overijssel",
    url: "https://www.uitinoverijssel.nl/agenda",
    city: "Overijssel",
    lat: 52.5168,
    lng: 6.083,
    description: "Provincial Overijssel events",
    selectors: [".event-item", ".agenda-item", "[class*='event']"],
  },
  {
    id: "drenthe-uit",
    name: "Uit in Drenthe",
    url: "https://www.uitindrenthe.nl/agenda",
    city: "Drenthe",
    lat: 52.6957,
    lng: 6.1944,
    description: "Provincial Drenthe events",
    selectors: [".event-item", ".agenda-item", "[class*='event']"],
  },
  {
    id: "kampen-visit",
    name: "Visit Kampen",
    url: "https://www.visitkampen.nl/agenda",
    city: "Kampen",
    lat: 52.5557,
    lng: 5.9096,
    description: "Nearby Kampen events",
    selectors: [".event-item", ".agenda-item", "[class*='event']"],
  },
  {
    id: "assen-visit",
    name: "Visit Assen Agenda",
    url: "https://www.visitassen.nl/agenda",
    city: "Assen",
    lat: 52.9925,
    lng: 6.5649,
    description: "Capital of Drenthe events",
    selectors: [".event-item", ".agenda-item", "[class*='event']"],
  },
  {
    id: "hoogeveen-gemeente",
    name: "Gemeente Hoogeveen Agenda",
    url: "https://www.hoogeveen.nl/agenda",
    city: "Hoogeveen",
    lat: 52.7236,
    lng: 6.4756,
    description: "Hoogeveen municipal events",
    selectors: [".event-item", ".agenda-item", "[class*='event']"],
  },
  {
    id: "steenwijk-visit",
    name: "Visit Steenwijk",
    url: "https://www.visitsteenwijk.nl/agenda",
    city: "Steenwijk",
    lat: 52.7883,
    lng: 6.1192,
    description: "Steenwijk area events",
    selectors: [".event-item", ".agenda-item", "[class*='event']"],
  },
  {
    id: "weerribben-wieden",
    name: "Weerribben-Wieden Agenda",
    url: "https://www.weerribben-wieden.com/agenda",
    city: "Weerribben-Wieden",
    lat: 52.7783,
    lng: 5.9892,
    category: "outdoor",
    description: "National park events",
    selectors: [".event-item", ".agenda-item", "[class*='event']"],
  },
  {
    id: "deventer-uit",
    name: "Deventer Uitagenda",
    url: "https://www.deventeruitagenda.nl",
    city: "Deventer",
    lat: 52.25,
    lng: 6.164,
    description: "Nearby Deventer events",
    selectors: [".event-item", ".agenda-item", "[class*='event']"],
  },
];

// ============================================================================
// Helper functions
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// Main Pipeline
// ============================================================================

async function main() {
  const SUPABASE_URL =
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    console.error("   Set these in your .env file or environment");
    console.error("");
    console.error("   Example .env file:");
    console.error("   SUPABASE_URL=https://your-project.supabase.co");
    console.error("   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const startTimestamp = new Date().toISOString();

  console.log("\n" + "═".repeat(70));
  console.log("🎯 ZWOLLE & MEPPEL LIVE SCRAPER TEST PIPELINE");
  console.log("═".repeat(70));
  console.log(`Started: ${startTimestamp}`);
  console.log(`Target: ~2000 events from Zwolle/Meppel region`);
  console.log(`Sources configured: ${ZWOLLE_MEPPEL_SOURCES.length}`);
  console.log();

  // =========================================================================
  // PHASE 1: CLEAR ALL SCRAPER DATA
  // =========================================================================
  console.log("📊 PHASE 1: CLEAR ALL SCRAPER DATA (FRESH START)");
  console.log("─".repeat(70));

  // Get counts before deletion
  const { count: eventCountBefore } = await supabase
    .from("events")
    .select("*", { count: "exact", head: true })
    .in("event_type", ["anchor", "signal"]);

  const { count: stagingCountBefore } = await supabase
    .from("raw_event_staging")
    .select("*", { count: "exact", head: true });

  const { count: insightsCountBefore } = await supabase
    .from("scraper_insights")
    .select("*", { count: "exact", head: true });

  console.log(`  📈 Pre-clear state:`);
  console.log(`     Events (anchors/signals): ${eventCountBefore || 0}`);
  console.log(`     Staging rows: ${stagingCountBefore || 0}`);
  console.log(`     Scraper insights: ${insightsCountBefore || 0}`);

  console.log("\n  🗑️  Clearing tables...");

  // Clear events (anchors and signals only, preserve forks/user events)
  const { error: deleteEventsError } = await supabase
    .from("events")
    .delete()
    .in("event_type", ["anchor", "signal"]);
  if (deleteEventsError)
    console.error(`     ⚠️  Events delete error: ${deleteEventsError.message}`);
  else console.log("     ✓ Deleted all scraped events (anchors/signals)");

  // Clear staging table
  const { error: deleteStagingError } = await supabase
    .from("raw_event_staging")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (deleteStagingError)
    console.error(
      `     ⚠️  Staging delete error: ${deleteStagingError.message}`
    );
  else console.log("     ✓ Cleared raw_event_staging table");

  // Clear insights
  const { error: deleteInsightsError } = await supabase
    .from("scraper_insights")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (deleteInsightsError)
    console.error(
      `     ⚠️  Insights delete error: ${deleteInsightsError.message}`
    );
  else console.log("     ✓ Cleared scraper_insights table");

  // Try to clear scrape_jobs if it exists
  try {
    const { error: deleteJobsError } = await supabase
      .from("scrape_jobs")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (!deleteJobsError) console.log("     ✓ Cleared scrape_jobs table");
  } catch (_e) {
    // Table may not exist
  }

  // Reset scraper sources counters
  const { error: resetSourcesError } = await supabase
    .from("scraper_sources")
    .update({
      last_scraped_at: null,
      last_success: null,
      last_error: null,
      consecutive_failures: 0,
      total_events_scraped: 0,
      last_payload_hash: null,
    })
    .not("id", "is", null);  // Update all rows (id is never null)
  if (!resetSourcesError)
    console.log("     ✓ Reset all scraper_sources counters");

  console.log("\n  ✅ Database cleared and ready for fresh scrape");

  // =========================================================================
  // PHASE 2: CONFIGURE ZWOLLE & MEPPEL SOURCES
  // =========================================================================
  console.log("\n📊 PHASE 2: CONFIGURE ZWOLLE & MEPPEL SOURCES");
  console.log("─".repeat(70));

  let sourcesAdded = 0;
  let sourcesUpdated = 0;
  const configuredSourceIds: string[] = [];

  for (const source of ZWOLLE_MEPPEL_SOURCES) {
    // Check if source already exists
    const { data: existing } = await supabase
      .from("scraper_sources")
      .select("id")
      .eq("id", source.id)
      .single();

    const sourceRecord = {
      id: source.id,
      name: source.name,
      url: source.url,
      enabled: true,
      description: source.description,
      language: "nl-NL",
      country: "NL",
      default_coordinates: { lat: source.lat, lng: source.lng },
      location_name: source.city,
      config: {
        selectors: source.selectors || [
          ".event-item",
          ".agenda-item",
          "article.event",
          "[class*='event']",
        ],
        headers: {
          "User-Agent": "LCL-EventScraper/1.0",
          "Accept-Language": "nl-NL,nl;q=0.9",
        },
        rate_limit_ms: 300,
        ...(source.category && { category: source.category }),
      },
      requires_render: source.requires_render || false,
      auto_disabled: false,
      consecutive_failures: 0,
      total_events_scraped: 0,
    };

    if (existing) {
      // Update existing source
      const { error: updateError } = await supabase
        .from("scraper_sources")
        .update(sourceRecord)
        .eq("id", source.id);

      if (updateError) {
        console.log(
          `  ⚠️  ${source.name}: Update failed - ${updateError.message}`
        );
      } else {
        console.log(`  📝 ${source.name}: Updated (${source.city})`);
        sourcesUpdated++;
        configuredSourceIds.push(source.id);
      }
    } else {
      // Insert new source
      const { error: insertError } = await supabase
        .from("scraper_sources")
        .insert(sourceRecord);

      if (insertError) {
        console.log(
          `  ⚠️  ${source.name}: Insert failed - ${insertError.message}`
        );
      } else {
        console.log(`  ✅ ${source.name}: Added (${source.city})`);
        sourcesAdded++;
        configuredSourceIds.push(source.id);
      }
    }
  }

  console.log(
    `\n  📊 Summary: ${sourcesAdded} added, ${sourcesUpdated} updated`
  );
  console.log(`  Total sources to scrape: ${configuredSourceIds.length}`);

  // =========================================================================
  // PHASE 3: RUN LIVE SCRAPER PIPELINE
  // =========================================================================
  console.log("\n📊 PHASE 3: RUN LIVE SCRAPER PIPELINE");
  console.log("─".repeat(70));

  if (configuredSourceIds.length === 0) {
    console.log("  ⚠️  No sources configured! Exiting.");
    process.exit(1);
  }

  console.log(
    `\n  🕷️  Triggering scrape-events for ${configuredSourceIds.length} sources...`
  );

  // Scrape each source with rate limiting
  for (const sourceId of configuredSourceIds) {
    const sourceName =
      ZWOLLE_MEPPEL_SOURCES.find((s) => s.id === sourceId)?.name || sourceId;
    process.stdout.write(`  → Scraping ${sourceName}... `);

    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/scrape-events`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sourceId }),
        }
      );

      if (response.ok) {
        const result = await response.json();
        const staged = result.staged || result.cardsSaved || 0;
        console.log(`✅ ${staged} events staged`);
      } else {
        const errorText = await response.text();
        console.log(`⚠️  Error: ${response.status} - ${errorText.slice(0, 100)}`);
      }
    } catch (e) {
      console.log(`❌ Failed: ${e}`);
    }

    // Rate limiting between sources
    await sleep(500);
  }

  // Wait for staging to complete
  console.log("\n  ⏳ Waiting for staging to complete (15 seconds)...");
  await sleep(15000);

  // =========================================================================
  // PHASE 4: PROCESS STAGED EVENTS
  // =========================================================================
  console.log("\n📊 PHASE 4: PROCESS STAGED EVENTS");
  console.log("─".repeat(70));

  // Check staging count
  const { count: stagingToProcess } = await supabase
    .from("raw_event_staging")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  console.log(
    `  📋 Staged events pending processing: ${stagingToProcess || 0}`
  );

  // Process in batches
  const PROCESS_ITERATIONS = Math.max(
    10,
    Math.ceil((stagingToProcess || 0) / 10)
  );
  console.log(`  🏭 Running ${PROCESS_ITERATIONS} processor iterations...`);

  let totalProcessed = 0;
  let totalSucceeded = 0;
  let totalFailed = 0;

  for (let i = 0; i < PROCESS_ITERATIONS; i++) {
    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/process-worker`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        const result = await response.json();
        const processed = result.processed || result.batchSize || 0;
        const succeeded = result.succeeded || 0;
        const failed = result.failed || 0;

        totalProcessed += processed;
        totalSucceeded += succeeded;
        totalFailed += failed;

        if (processed === 0) {
          console.log(`     Iteration ${i + 1}: No more pending items`);
          break;
        }

        if ((i + 1) % 5 === 0 || i === PROCESS_ITERATIONS - 1) {
          console.log(
            `     Iteration ${i + 1}: Processed ${processed} (total: ${totalSucceeded} succeeded, ${totalFailed} failed)`
          );
        }
      } else {
        console.log(`     Iteration ${i + 1}: Error ${response.status}`);
      }
    } catch (e) {
      console.log(`     Iteration ${i + 1}: Failed - ${e}`);
    }

    // Rate limiting between processor calls
    await sleep(3000);
  }

  console.log(
    `\n  ✅ Processing complete: ${totalSucceeded} succeeded, ${totalFailed} failed`
  );

  // =========================================================================
  // PHASE 5: GENERATE COMPREHENSIVE SUMMARY
  // =========================================================================
  console.log("\n" + "═".repeat(70));
  console.log("📊 PHASE 5: COMPREHENSIVE SUMMARY REPORT");
  console.log("═".repeat(70));

  // Get final event count
  const { count: finalEventCount } = await supabase
    .from("events")
    .select("*", { count: "exact", head: true })
    .in("event_type", ["anchor", "signal"]);

  // Get staging stats by status
  const { data: stagingByStatus } = await supabase
    .from("raw_event_staging")
    .select("status");

  const statusCounts: Record<string, number> = {};
  (stagingByStatus || []).forEach((s) => {
    statusCounts[s.status] = (statusCounts[s.status] || 0) + 1;
  });

  // Get parsing methods used
  const { data: stagingByMethod } = await supabase
    .from("raw_event_staging")
    .select("parsing_method");

  const methodCounts: Record<string, number> = {};
  (stagingByMethod || []).forEach((s) => {
    const method = s.parsing_method || "unknown";
    methodCounts[method] = (methodCounts[method] || 0) + 1;
  });

  // Get events per source with quality info
  const { data: eventsBySource } = await supabase
    .from("events")
    .select("source_id, category, quality_score")
    .in("event_type", ["anchor", "signal"]);

  const sourceStats: Record<
    string,
    {
      count: number;
      categories: Record<string, number>;
      qualitySum: number;
      avgQuality: number;
    }
  > = {};

  (eventsBySource || []).forEach((e) => {
    const sid = e.source_id || "unknown";
    if (!sourceStats[sid]) {
      sourceStats[sid] = {
        count: 0,
        categories: {},
        qualitySum: 0,
        avgQuality: 0,
      };
    }
    sourceStats[sid].count++;
    const cat = e.category || "unknown";
    sourceStats[sid].categories[cat] =
      (sourceStats[sid].categories[cat] || 0) + 1;
    sourceStats[sid].qualitySum += e.quality_score || 0;
  });

  // Calculate averages
  Object.keys(sourceStats).forEach((sid) => {
    if (sourceStats[sid].count > 0) {
      sourceStats[sid].avgQuality =
        sourceStats[sid].qualitySum / sourceStats[sid].count;
    }
  });

  // Get source names
  const { data: sources } = await supabase
    .from("scraper_sources")
    .select("id, name, location_name")
    .in("id", Object.keys(sourceStats));

  const sourceNameMap: Record<string, { name: string; city: string }> = {};
  (sources || []).forEach((s) => {
    sourceNameMap[s.id] = { name: s.name, city: s.location_name || "" };
  });

  // === PRINT SUMMARY ===

  console.log("\n  📈 OVERALL STATISTICS:");
  console.log(`     Total Events Created: ${finalEventCount || 0}`);
  console.log(`     Target: ~2000 events`);
  const achievedPercent =
    finalEventCount && finalEventCount > 0
      ? ((finalEventCount / 2000) * 100).toFixed(1)
      : "0";
  console.log(`     Achievement: ${achievedPercent}%`);

  console.log("\n  📋 STAGING STATUS BREAKDOWN:");
  if (Object.keys(statusCounts).length === 0) {
    console.log("     (all items processed)");
  } else {
    Object.entries(statusCounts)
      .sort(([, a], [, b]) => b - a)
      .forEach(([status, count]) => {
        console.log(`     ${status}: ${count}`);
      });
  }

  console.log("\n  🔧 PARSING METHODS (INJECTION METHODS) USED:");
  console.log("  " + "─".repeat(50));
  const methodDescriptions: Record<string, string> = {
    hydration: "Inline page hydration data",
    json_ld: "JSON-LD structured data (Schema.org)",
    microdata: "Schema.org microdata",
    feed: "RSS/Atom feed parsing",
    dom: "DOM selector extraction",
    deterministic: "Rule-based extraction",
    deterministic_detail: "Rule-based from detail page",
    ai: "AI parsing (OpenAI/Gemini)",
    hybrid_ai: "Deterministic + AI hybrid",
    ai_fallback: "AI as last resort",
    unknown: "Unclassified method",
  };

  Object.entries(methodCounts)
    .sort(([, a], [, b]) => b - a)
    .forEach(([method, count]) => {
      const desc = methodDescriptions[method] || method;
      const pct =
        stagingByMethod && stagingByMethod.length > 0
          ? ((count / stagingByMethod.length) * 100).toFixed(1)
          : "0";
      console.log(
        `     ${method.padEnd(22)} │ ${String(count).padStart(5)} │ ${pct.padStart(5)}% │ ${desc}`
      );
    });

  console.log("\n  🏙️ EVENTS PER SOURCE:");
  console.log("  " + "─".repeat(85));
  console.log(
    `  ${"Source".padEnd(30)} │ ${"City".padEnd(12)} │ ${"Events".padStart(7)} │ ${"Avg Quality".padStart(11)} │ Top Categories`
  );
  console.log("  " + "─".repeat(85));

  // Sort by city (Zwolle first, then Meppel, then others) and then by count
  const sortedSources = Object.entries(sourceStats).sort(
    ([idA, a], [idB, b]) => {
      const cityA = sourceNameMap[idA]?.city || "";
      const cityB = sourceNameMap[idB]?.city || "";

      // Primary sort by city priority
      const cityOrder = ["Zwolle", "Meppel"];
      const orderA = cityOrder.indexOf(cityA);
      const orderB = cityOrder.indexOf(cityB);

      if (orderA !== orderB) {
        if (orderA === -1) return 1;
        if (orderB === -1) return -1;
        return orderA - orderB;
      }

      // Secondary sort by event count
      return b.count - a.count;
    }
  );

  let zwolleTotal = 0;
  let meppelTotal = 0;
  let otherTotal = 0;

  sortedSources.forEach(([sourceId, stats]) => {
    const info = sourceNameMap[sourceId] || { name: sourceId, city: "" };
    const name = info.name.slice(0, 29);
    const city = info.city.slice(0, 11);

    if (city.toLowerCase().includes("zwolle")) zwolleTotal += stats.count;
    else if (city.toLowerCase().includes("meppel")) meppelTotal += stats.count;
    else otherTotal += stats.count;

    const topCats = Object.entries(stats.categories)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([cat, cnt]) => `${cat}(${cnt})`)
      .join(", ");

    console.log(
      `  ${name.padEnd(30)} │ ${city.padEnd(12)} │ ${String(stats.count).padStart(7)} │ ${stats.avgQuality.toFixed(2).padStart(11)} │ ${topCats}`
    );
  });

  console.log("  " + "─".repeat(85));

  console.log("\n  📍 EVENTS BY REGION:");
  console.log(`     Zwolle: ${zwolleTotal} events`);
  console.log(`     Meppel: ${meppelTotal} events`);
  console.log(`     Regional/Other: ${otherTotal} events`);
  console.log(`     ─────────────────────────`);
  console.log(`     TOTAL: ${finalEventCount || 0} events`);

  // Date distribution
  const today = new Date().toISOString().split("T")[0];
  const { count: futureEventCount } = await supabase
    .from("events")
    .select("*", { count: "exact", head: true })
    .in("event_type", ["anchor", "signal"])
    .gte("event_date", today);

  const { count: pastEventCount } = await supabase
    .from("events")
    .select("*", { count: "exact", head: true })
    .in("event_type", ["anchor", "signal"])
    .lt("event_date", today);

  console.log("\n  📅 DATE DISTRIBUTION:");
  console.log(`     Future events (upcoming): ${futureEventCount || 0}`);
  console.log(`     Past events (historical): ${pastEventCount || 0}`);

  // Category distribution
  const { data: allCategories } = await supabase
    .from("events")
    .select("category")
    .in("event_type", ["anchor", "signal"]);

  const catCounts: Record<string, number> = {};
  (allCategories || []).forEach((e) => {
    const cat = e.category || "unknown";
    catCounts[cat] = (catCounts[cat] || 0) + 1;
  });

  console.log("\n  🏷️ CATEGORY DISTRIBUTION:");
  Object.entries(catCounts)
    .sort(([, a], [, b]) => b - a)
    .forEach(([cat, count]) => {
      const bar = "█".repeat(Math.min(20, Math.ceil(count / 10)));
      console.log(
        `     ${cat.padEnd(15)} │ ${String(count).padStart(5)} │ ${bar}`
      );
    });

  // Quality distribution
  const { data: qualityData } = await supabase
    .from("events")
    .select("quality_score")
    .in("event_type", ["anchor", "signal"]);

  const qualityBuckets = { high: 0, medium: 0, low: 0 };
  (qualityData || []).forEach((e) => {
    const q = e.quality_score || 0;
    if (q >= 0.7) qualityBuckets.high++;
    else if (q >= 0.4) qualityBuckets.medium++;
    else qualityBuckets.low++;
  });

  console.log("\n  ⭐ QUALITY DISTRIBUTION:");
  console.log(
    `     High (≥0.7):   ${qualityBuckets.high} events (${((qualityBuckets.high / (finalEventCount || 1)) * 100).toFixed(1)}%)`
  );
  console.log(
    `     Medium (0.4-0.7): ${qualityBuckets.medium} events (${((qualityBuckets.medium / (finalEventCount || 1)) * 100).toFixed(1)}%)`
  );
  console.log(
    `     Low (<0.4):    ${qualityBuckets.low} events (${((qualityBuckets.low / (finalEventCount || 1)) * 100).toFixed(1)}%)`
  );

  // Final summary
  const endTimestamp = new Date().toISOString();
  const durationMs =
    new Date(endTimestamp).getTime() - new Date(startTimestamp).getTime();
  const durationMins = (durationMs / 60000).toFixed(1);

  console.log("\n" + "═".repeat(70));
  console.log("✅ PIPELINE COMPLETE");
  console.log("═".repeat(70));
  console.log(`  Started: ${startTimestamp}`);
  console.log(`  Completed: ${endTimestamp}`);
  console.log(`  Duration: ${durationMins} minutes`);
  console.log();
  console.log(`  🎯 TARGET: ~2000 events`);
  console.log(`  📊 ACHIEVED: ${finalEventCount || 0} events (${achievedPercent}%)`);
  console.log();

  if ((finalEventCount || 0) >= 1800) {
    console.log("  ✨ EXCELLENT: Target achieved or exceeded!");
  } else if ((finalEventCount || 0) >= 1000) {
    console.log("  ✅ GOOD: Substantial event count, close to target");
  } else if ((finalEventCount || 0) >= 500) {
    console.log(
      "  ⚠️  PARTIAL: Moderate event count, some sources may need attention"
    );
  } else {
    console.log("  ❌ BELOW TARGET: Check source URLs and selectors");
  }

  console.log("\n");
}

// Run the pipeline
main().catch(console.error);
