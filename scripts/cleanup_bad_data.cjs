const postgres = require("postgres");
require("dotenv").config();

async function cleanupBadData() {
  const sql = postgres({
    host: process.env.SUPABASE_DB_HOST,
    port: parseInt(process.env.SUPABASE_DB_PORT_SESSION || "6543"),
    database: process.env.SUPABASE_DB_NAME,
    username: process.env.SUPABASE_DB_USER,
    password: process.env.SUPABASE_DB_PASSWORD,
    ssl: "require",
  });

  try {
    console.log("--- Starting Cleanup ---");

    // 1. Clean Raw Event Staging
    // The user explicitly asked to clean "raw events". Since this is staging data,
    // and we know it contains massive payloads, a full truncate is cleanest.
    const deletedRaw = await sql`DELETE FROM raw_event_staging`;
    console.log(`✅ Deleted ${deletedRaw.count} rows from raw_event_staging`);

    // 2. Clean Scraped Events
    // We only delete events that came from a source (source_id IS NOT NULL).
    // This preserves any manual test events the user might have created (if source_id is null).
    const deletedEvents =
      await sql`DELETE FROM events WHERE source_id IS NOT NULL`;
    console.log(
      `✅ Deleted ${deletedEvents.count} scraped events from 'events' table`,
    );

    // 3. Reset Scraper Sources
    // Resetting metadata ensures the next run processes everything fresh using the new logic.
    const updatedSources = await sql`
      UPDATE scraper_sources 
      SET 
        next_scrape_at = NOW(),
        last_scraped_at = NULL, 
        last_success = NULL,
        consecutive_failures = 0,
        consecutive_errors = 0,
        last_error = NULL,
        last_payload_hash = NULL
      WHERE enabled = true
    `;
    console.log(
      `✅ Reset state for ${updatedSources.count} active scraper sources`,
    );

    // 4. Clean Scrape Jobs history (optional but good for 'cleaning old ones')
    const deletedJobs = await sql`DELETE FROM scrape_jobs`;
    console.log(`✅ Cleaned up ${deletedJobs.count} old scrape job logs`);
  } catch (e) {
    console.error("❌ Cleanup failed:", e);
  } finally {
    await sql.end();
  }
}

cleanupBadData();
