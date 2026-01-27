#!/usr/bin/env node

/**
 * Clear Scraper Tables for UAT Prep
 * Clears all scraper-related tables to prepare for fresh UAT data
 */

const postgres = require("postgres");
require("dotenv").config();

async function clearScraperTables() {
  const sql = postgres({
    host: process.env.SUPABASE_DB_HOST,
    port: parseInt(process.env.SUPABASE_DB_PORT_SESSION || "6543"),
    database: process.env.SUPABASE_DB_NAME,
    username: process.env.SUPABASE_DB_USER,
    password: process.env.SUPABASE_DB_PASSWORD,
    ssl: "require",
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  try {
    console.log("🧹 Starting scraper table cleanup...\n");

    // Get counts before deletion
    console.log("📊 Current table counts:");
    const [eventCount] =
      await sql`SELECT COUNT(*) as count FROM events WHERE event_type IN ('anchor', 'signal')`;
    const [stagingCount] =
      await sql`SELECT COUNT(*) as count FROM raw_event_staging`;
    const [insightsCount] =
      await sql`SELECT COUNT(*) as count FROM scraper_insights`;

    console.log(`  - events (anchors/signals): ${eventCount.count}`);
    console.log(`  - raw_event_staging: ${stagingCount.count}`);
    console.log(`  - scraper_insights: ${insightsCount.count}`);

    // Check if scrape_jobs table exists
    let jobsCount = 0;
    try {
      const [jobs] = await sql`SELECT COUNT(*) as count FROM scrape_jobs`;
      jobsCount = jobs.count;
      console.log(`  - scrape_jobs: ${jobsCount}`);
    } catch (e) {
      console.log(`  - scrape_jobs: Table does not exist (skipping)`);
    }

    console.log("\n🗑️  Deleting data...");

    // Delete events that were scraped (anchors and signals, not forks which are user-created)
    const deletedEvents = await sql`
      DELETE FROM events 
      WHERE event_type IN ('anchor', 'signal')
      RETURNING id
    `;
    console.log(`  ✓ Deleted ${deletedEvents.length} events (anchors/signals)`);

    // Clear raw event staging
    const deletedStaging = await sql`
      DELETE FROM raw_event_staging 
      RETURNING id
    `;
    console.log(
      `  ✓ Deleted ${deletedStaging.length} rows from raw_event_staging`,
    );

    // Clear scraper insights
    const deletedInsights = await sql`
      DELETE FROM scraper_insights 
      RETURNING id
    `;
    console.log(
      `  ✓ Deleted ${deletedInsights.length} rows from scraper_insights`,
    );

    // Clear scrape_jobs if it exists
    if (jobsCount > 0) {
      try {
        const deletedJobs = await sql`
          DELETE FROM scrape_jobs 
          RETURNING id
        `;
        console.log(`  ✓ Deleted ${deletedJobs.length} rows from scrape_jobs`);
      } catch (e) {
        console.log(`  ⚠️  Could not clear scrape_jobs: ${e.message}`);
      }
    }

    // Reset scraper_sources status
    const resetSources = await sql`
      UPDATE scraper_sources 
      SET 
        last_scraped_at = NULL,
        last_success = NULL,
        last_error = NULL,
        consecutive_failures = 0,
        enabled = true,
        total_events_scraped = 0,
        last_non_zero_scrape = NULL,
        consecutive_zero_events = 0
      RETURNING id
    `;
    console.log(
      `  ✓ Reset ${resetSources.length} scraper sources to initial state`,
    );

    console.log("\n✅ Scraper tables cleared successfully!");
    console.log(
      "📋 Ready for UAT with 1000 events across 10L/10M/10S cities\n",
    );
  } catch (error) {
    console.error("❌ Error clearing scraper tables:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

clearScraperTables();
