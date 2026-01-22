const postgres = require("postgres");
require("dotenv").config();

async function analyzeDataQuality() {
  const sql = postgres({
    host: process.env.SUPABASE_DB_HOST,
    port: parseInt(process.env.SUPABASE_DB_PORT_SESSION || "6543"),
    database: process.env.SUPABASE_DB_NAME,
    username: process.env.SUPABASE_DB_USER,
    password: process.env.SUPABASE_DB_PASSWORD,
    ssl: "require",
  });

  try {
    console.log("--- Raw Event Staging Analysis ---");
    const stagingStats = await sql`
      SELECT 
        count(*) as total,
        avg(length(raw_html)) as avg_html_length,
        max(length(raw_html)) as max_html_length,
        count(*) filter (where length(raw_html) > 10000) as massive_payloads
      FROM raw_event_staging
    `;
    console.table(stagingStats);

    // Check a sample of massive payloads to see what they contain
    const massiveSamples = await sql`
      SELECT id, substring(raw_html from 1 for 100) as snippet, length(raw_html) as len 
      FROM raw_event_staging 
      WHERE length(raw_html) > 10000 
      LIMIT 3
    `;
    console.log("\nSample Massive Payloads:");
    console.table(massiveSamples);

    console.log("\n--- Processed Events Analysis ---");
    const eventStats = await sql`
      SELECT 
        count(*) as total,
        count(*) filter (where description is null or length(description) < 10) as missing_desc,
        count(*) filter (where description iLIKE '%no description%') as placeholder_desc
      FROM events
    `;
    console.table(eventStats);
  } catch (e) {
    console.error(e);
  } finally {
    await sql.end();
  }
}

analyzeDataQuality();
