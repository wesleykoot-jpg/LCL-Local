const postgres = require("postgres");
require("dotenv").config();

async function checkStats() {
  const sql = postgres({
    host: process.env.SUPABASE_DB_HOST,
    port: parseInt(process.env.SUPABASE_DB_PORT_SESSION || "6543"),
    database: process.env.SUPABASE_DB_NAME,
    username: process.env.SUPABASE_DB_USER,
    password: process.env.SUPABASE_DB_PASSWORD,
    ssl: "require",
  });

  try {
    console.log("--- Stats Per Source ---");

    const rows = await sql`
      WITH raw_counts AS (
        SELECT source_id, count(*) as raw_count
        FROM raw_event_staging
        GROUP BY source_id
      ),
      event_counts AS (
        SELECT source_id, count(*) as event_count
        FROM events
        GROUP BY source_id
      )
      SELECT 
        s.name,
        COALESCE(r.raw_count, 0) as raw_pages_injected,
        COALESCE(e.event_count, 0) as events_extracted
      FROM scraper_sources s
      LEFT JOIN raw_counts r ON s.id = r.source_id
      LEFT JOIN event_counts e ON s.id = e.source_id
      WHERE COALESCE(r.raw_count, 0) > 0 OR COALESCE(e.event_count, 0) > 0
      ORDER BY raw_pages_injected DESC
    `;

    console.table(rows);
  } catch (e) {
    console.error(e);
  } finally {
    await sql.end();
  }
}

checkStats();
