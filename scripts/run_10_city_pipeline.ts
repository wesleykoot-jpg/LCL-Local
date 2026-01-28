#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

/**
 * 10-City Scraper Pipeline
 *
 * This script:
 * 1. Clears all old scraper data (events, staging, insights)
 * 2. Sets up sources for 10 medium Dutch cities including Meppel
 * 3. Runs the scraper pipeline (fetcher + processor)
 * 4. Generates a data quality summary per source
 *
 * Target: 200-400 events per city (2000-4000 total)
 *
 * Usage:
 *   deno run --allow-net --allow-env --allow-read scripts/run_10_city_pipeline.ts
 *
 * Required env vars:
 *   - SUPABASE_URL or VITE_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "npm:@supabase/supabase-js@2.49.1";

// ============================================================================
// Configuration
// ============================================================================

// 10 medium Dutch cities including Meppel (population 25,000-100,000)
const TARGET_CITIES = [
  {
    name: "Meppel",
    population: 34893,
    lat: 52.6957,
    lng: 6.1944,
    province: "Drenthe",
  },
  {
    name: "Assen",
    population: 68776,
    lat: 52.9925,
    lng: 6.5649,
    province: "Drenthe",
  },
  {
    name: "Hoogeveen",
    population: 55756,
    lat: 52.7236,
    lng: 6.4756,
    province: "Drenthe",
  },
  {
    name: "Kampen",
    population: 54696,
    lat: 52.5557,
    lng: 5.9096,
    province: "Overijssel",
  },
  {
    name: "Hardenberg",
    population: 61259,
    lat: 52.5764,
    lng: 6.6208,
    province: "Overijssel",
  },
  {
    name: "Steenwijkerland",
    population: 44530,
    lat: 52.7883,
    lng: 6.1192,
    province: "Overijssel",
  },
  {
    name: "Coevorden",
    population: 35175,
    lat: 52.6617,
    lng: 6.7408,
    province: "Drenthe",
  },
  {
    name: "Emmen",
    population: 107235,
    lat: 52.7792,
    lng: 6.8995,
    province: "Drenthe",
  },
  {
    name: "Zwolle",
    population: 132397,
    lat: 52.5168,
    lng: 6.083,
    province: "Overijssel",
  },
  {
    name: "Deventer",
    population: 101514,
    lat: 52.25,
    lng: 6.164,
    province: "Overijssel",
  },
];

const COMMON_EVENT_URL_PATTERNS = [
  (city: string) =>
    `https://www.uitin${city.toLowerCase().replace(/[^a-z0-9]/g, "")}.nl`,
  (city: string) =>
    `https://www.visit${city.toLowerCase().replace(/[^a-z0-9]/g, "")}.nl/evenementen`,
  (city: string) =>
    `https://www.ontdek${city.toLowerCase().replace(/[^a-z0-9]/g, "")}.nl/agenda`,
  (city: string) =>
    `https://www.${city.toLowerCase().replace(/[\s']/g, "-")}.nl/evenementen`,
];

// ============================================================================
// Load environment variables
// ============================================================================

async function loadEnv() {
  try {
    const text = await Deno.readTextFile(".env");
    for (const line of text.split("\n")) {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        let value = match[2].trim();
        if (value.startsWith('"') && value.endsWith('"'))
          value = value.slice(1, -1);
        if (value.startsWith("'") && value.endsWith("'"))
          value = value.slice(1, -1);
        Deno.env.set(match[1].trim(), value);
      }
    }
    console.log("✅ Environment variables loaded from .env");
  } catch (_e) {
    console.log("⚠️  No .env file found, using system environment");
  }
}

// ============================================================================
// Main Pipeline
// ============================================================================

async function main() {
  await loadEnv();

  const SUPABASE_URL =
    Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    Deno.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  console.log("\n" + "=".repeat(60));
  console.log("🚀 10-CITY SCRAPER PIPELINE");
  console.log("=".repeat(60));
  console.log(`Target cities: ${TARGET_CITIES.map((c) => c.name).join(", ")}`);
  console.log();

  // =========================================================================
  // Phase 1: Clear Old Data
  // =========================================================================
  console.log("📊 PHASE 1: CLEAR OLD DATA");
  console.log("-".repeat(40));

  // Get counts before deletion
  const { count: eventCount } = await supabase
    .from("events")
    .select("*", { count: "exact", head: true })
    .in("event_type", ["anchor", "signal"]);

  const { count: stagingCount } = await supabase
    .from("raw_event_staging")
    .select("*", { count: "exact", head: true });

  const { count: insightsCount } = await supabase
    .from("scraper_insights")
    .select("*", { count: "exact", head: true });

  console.log(`  Current events (anchors/signals): ${eventCount || 0}`);
  console.log(`  Current staging rows: ${stagingCount || 0}`);
  console.log(`  Current insights: ${insightsCount || 0}`);

  // Delete old events (anchors and signals only, preserve forks)
  console.log("\n  🗑️  Deleting old data...");

  const { error: deleteEventsError } = await supabase
    .from("events")
    .delete()
    .in("event_type", ["anchor", "signal"]);
  if (deleteEventsError)
    console.error("    ⚠️  Delete events error:", deleteEventsError.message);
  else console.log("    ✓ Deleted old events");

  const { error: deleteStagingError } = await supabase
    .from("raw_event_staging")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (deleteStagingError)
    console.error("    ⚠️  Delete staging error:", deleteStagingError.message);
  else console.log("    ✓ Cleared staging table");

  const { error: deleteInsightsError } = await supabase
    .from("scraper_insights")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (deleteInsightsError)
    console.error(
      "    ⚠️  Delete insights error:",
      deleteInsightsError.message,
    );
  else console.log("    ✓ Cleared insights table");

  // Try to clear scrape_jobs if it exists
  try {
    await supabase
      .from("scrape_jobs")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    console.log("    ✓ Cleared scrape_jobs table");
  } catch (_e) {
    // Table may not exist
  }

  // =========================================================================
  // Phase 2: Setup Sources for 10 Cities
  // =========================================================================
  console.log("\n📊 PHASE 2: SETUP SOURCES FOR 10 CITIES");
  console.log("-".repeat(40));

  let sourcesAdded = 0;
  let sourcesExisting = 0;
  const addedSourceIds: string[] = [];

  for (const city of TARGET_CITIES) {
    const citySlug = city.name.toLowerCase().replace(/[^a-z0-9]/g, "");

    // Check if source already exists for this city
    const { data: existing } = await supabase
      .from("scraper_sources")
      .select("id, name")
      .ilike("location_name", `%${city.name}%`)
      .limit(1);

    if (existing && existing.length > 0) {
      console.log(
        `  ⏭️  ${city.name}: Source already exists (${existing[0].name})`,
      );
      addedSourceIds.push(existing[0].id);
      sourcesExisting++;

      // Make sure it's enabled
      await supabase
        .from("scraper_sources")
        .update({
          enabled: true,
          next_scrape_at: null, // Reset schedule for immediate scrape
          last_scraped_at: null,
          consecutive_errors: 0,
        })
        .eq("id", existing[0].id);
      continue;
    }

    // Generate URL for the city (try common patterns)
    const url = `https://www.uitin${citySlug}.nl`;

    const { data: insertedSource, error: insertError } = await supabase
      .from("scraper_sources")
      .insert({
        name: `Uitagenda ${city.name}`,
        description: `Event agenda for ${city.name}, ${city.province}`,
        url: url,
        enabled: true,
        config: {
          selectors: [
            ".event-item",
            ".agenda-item",
            "article.event",
            ".card--event",
            ".activity-card",
            ".search-result",
            "[class*='event']",
            "[class*='agenda']",
          ],
          match_patterns: [citySlug, "agenda", "evenement"],
          feed_discovery: true,
          rate_limit_ms: 500,
        },
        requires_render: false,
        language: "nl-NL",
        country: "NL",
        default_coordinates: { lat: city.lat, lng: city.lng },
        location_name: city.name,
        auto_disabled: false,
        consecutive_failures: 0,
      })
      .select("id")
      .single();

    if (insertError) {
      console.log(
        `  ⚠️  ${city.name}: Failed to add source - ${insertError.message}`,
      );
    } else {
      console.log(`  ✅ ${city.name}: Added source (${url})`);
      addedSourceIds.push(insertedSource.id);
      sourcesAdded++;
    }
  }

  console.log(
    `\n  Summary: ${sourcesAdded} sources added, ${sourcesExisting} already existed`,
  );
  console.log(`  Total sources to process: ${addedSourceIds.length}`);

  // =========================================================================
  // Phase 3: Run Scraper Pipeline
  // =========================================================================
  console.log("\n📊 PHASE 3: RUN SCRAPER PIPELINE");
  console.log("-".repeat(40));

  if (addedSourceIds.length === 0) {
    console.log("  ⚠️  No sources to scrape!");
    return;
  }

  // Trigger the coordinator with specific source IDs
  console.log(
    `  🕷️  Triggering scrape-coordinator for ${addedSourceIds.length} sources...`,
  );

  try {
    const coordResponse = await fetch(
      `${SUPABASE_URL}/functions/v1/scrape-coordinator`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sourceIds: addedSourceIds }),
      },
    );

    if (coordResponse.ok) {
      const result = await coordResponse.json();
      console.log(
        `  ✅ Coordinator triggered: ${result.jobsCreated || 0} jobs created`,
      );
    } else {
      console.log(
        `  ⚠️  Coordinator returned ${coordResponse.status}: ${await coordResponse.text()}`,
      );
    }
  } catch (e) {
    console.error(`  ❌ Failed to trigger coordinator:`, e);
  }

  // Wait for scraping to complete
  console.log("\n  ⏳ Waiting for scrapers to complete (30 seconds)...");
  await new Promise((r) => setTimeout(r, 30000));

  // Enrichment is push-based (DB trigger) - monitor status and run indexing
  console.log("  🧪 Monitoring enrichment + indexing...");

  for (let i = 0; i < 5; i++) {
    const { count: awaitingCount } = await supabase
      .from("raw_event_staging")
      .select("*", { count: "exact", head: true })
      .eq("pipeline_status", "awaiting_enrichment");

    const { count: readyCount } = await supabase
      .from("raw_event_staging")
      .select("*", { count: "exact", head: true })
      .eq("pipeline_status", "ready_to_index");

    console.log(
      `    📋 awaiting_enrichment: ${awaitingCount || 0} | ready_to_index: ${readyCount || 0}`,
    );

    if (readyCount && readyCount > 0) {
      try {
        const idxResponse = await fetch(
          `${SUPABASE_URL}/functions/v1/indexing-worker`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              "Content-Type": "application/json",
            },
          },
        );

        if (idxResponse.ok) {
          const result = await idxResponse.json();
          console.log(
            `    ✅ Indexed: ${result.successful || 0} (failed: ${result.failed || 0})`,
          );
        } else {
          console.log(`    ⚠️  Indexing worker returned ${idxResponse.status}`);
        }
      } catch (e) {
        console.error(`    ❌ Indexing error:`, e);
      }
    }

    // Wait between checks
    await new Promise((r) => setTimeout(r, 10000));
  }

  // =========================================================================
  // Phase 4: Generate Quality Summary
  // =========================================================================
  console.log("\n📊 PHASE 4: DATA QUALITY SUMMARY");
  console.log("-".repeat(40));

  // Get final event count
  const { count: finalEventCount } = await supabase
    .from("events")
    .select("*", { count: "exact", head: true })
    .in("event_type", ["anchor", "signal"]);

  // Get staging stats
  const { data: stagingStats } = await supabase
    .from("raw_event_staging")
    .select("pipeline_status, parsing_method");

  const statusCounts: Record<string, number> = {};
  const methodCounts: Record<string, number> = {};
  (stagingStats || []).forEach((s) => {
    const status = s.pipeline_status || "null";
    statusCounts[status] = (statusCounts[status] || 0) + 1;
    const method = s.parsing_method || "unknown";
    methodCounts[method] = (methodCounts[method] || 0) + 1;
  });

  // Get events per source
  const { data: eventsBySource } = await supabase
    .from("events")
    .select("source_id, category, quality_score")
    .in("event_type", ["anchor", "signal"]);

  const sourceStats: Record<
    string,
    {
      count: number;
      categories: Record<string, number>;
      avgQuality: number;
      qualitySum: number;
    }
  > = {};
  (eventsBySource || []).forEach((e) => {
    if (!e.source_id) return;
    if (!sourceStats[e.source_id]) {
      sourceStats[e.source_id] = {
        count: 0,
        categories: {},
        avgQuality: 0,
        qualitySum: 0,
      };
    }
    sourceStats[e.source_id].count++;
    sourceStats[e.source_id].categories[e.category || "unknown"] =
      (sourceStats[e.source_id].categories[e.category || "unknown"] || 0) + 1;
    sourceStats[e.source_id].qualitySum += e.quality_score || 0;
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

  const sourceNameMap: Record<string, string> = {};
  (sources || []).forEach((s) => {
    sourceNameMap[s.id] = s.location_name || s.name;
  });

  // Print summary
  console.log("\n  📈 OVERALL STATS:");
  console.log(`     Total Events Created: ${finalEventCount || 0}`);
  console.log(`     Staging Rows Remaining: ${stagingStats?.length || 0}`);

  console.log("\n  📊 STAGING STATUS BREAKDOWN:");
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`     ${status}: ${count}`);
  });

  console.log("\n  🔧 PARSING METHODS USED:");
  Object.entries(methodCounts).forEach(([method, count]) => {
    console.log(`     ${method}: ${count}`);
  });

  console.log("\n  🏙️ EVENTS PER CITY/SOURCE:");
  console.log("  " + "-".repeat(70));
  console.log(
    `  ${"Source".padEnd(25)} | ${"Events".padStart(8)} | ${"Avg Quality".padStart(12)} | Top Categories`,
  );
  console.log("  " + "-".repeat(70));

  Object.entries(sourceStats)
    .sort(([, a], [, b]) => b.count - a.count)
    .forEach(([sourceId, stats]) => {
      const name = (sourceNameMap[sourceId] || sourceId).slice(0, 24);
      const topCats = Object.entries(stats.categories)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([cat, cnt]) => `${cat}(${cnt})`)
        .join(", ");
      console.log(
        `  ${name.padEnd(25)} | ${String(stats.count).padStart(8)} | ${stats.avgQuality.toFixed(2).padStart(12)} | ${topCats}`,
      );
    });

  console.log("  " + "-".repeat(70));

  // Check for future events only
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

  // Final summary
  console.log("\n" + "=".repeat(60));
  console.log("✅ PIPELINE COMPLETE");
  console.log("=".repeat(60));
  console.log(`\n  Total events scraped: ${finalEventCount || 0}`);
  console.log(`  Future events: ${futureEventCount || 0}`);
  console.log(`  Sources processed: ${Object.keys(sourceStats).length}`);

  const avgEventsPerCity =
    Object.keys(sourceStats).length > 0
      ? Math.round((finalEventCount || 0) / Object.keys(sourceStats).length)
      : 0;
  console.log(`  Average events per city: ${avgEventsPerCity}`);

  if (avgEventsPerCity < 200) {
    console.log("\n  ⚠️  Warning: Below target of 200-400 events per city");
    console.log(
      "     Consider running the pipeline again or checking source URLs",
    );
  } else if (avgEventsPerCity > 400) {
    console.log(
      "\n  ✨ Excellent: Exceeded target of 200-400 events per city!",
    );
  } else {
    console.log("\n  ✅ On target: 200-400 events per city achieved");
  }

  console.log("\n");
}

// Run the pipeline
main().catch(console.error);
