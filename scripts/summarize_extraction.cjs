const postgres = require("postgres");
require("dotenv").config();

async function summarize() {
  const sql = postgres({
    host: process.env.SUPABASE_DB_HOST,
    port: parseInt(process.env.SUPABASE_DB_PORT_SESSION || "6543"),
    database: process.env.SUPABASE_DB_NAME,
    username: process.env.SUPABASE_DB_USER,
    password: process.env.SUPABASE_DB_PASSWORD,
    ssl: "require",
  });

  try {
    console.log("📊 Extraction Methods Summary:");

    // Check raw_event_staging parsing_method
    const stagingCounts = await sql`
      SELECT parsing_method, count(*) 
      FROM raw_event_staging 
      GROUP BY parsing_method
    `;
    console.log("\nStaging (attempted):");
    console.table(stagingCounts);

    // Check events metadata if possible (we didn't store parsing_method in events explicitly in the schema usually,
    // but we can infer from staging or if we added it.
    // The previous code didn't add parsing_method to events table explicitly in the payload,
    // wait, let's check the local_runner logic.
    // It stages parsing_method in raw_event_staging.
    // Normalized events don't strictly have a parsing_method column in 'events' usually.
    // But we can check raw_event_staging for 'completed' rows to see what worked.

    const completedCounts = await sql`
      SELECT parsing_method, count(*) 
      FROM raw_event_staging 
      WHERE status = 'completed'
      GROUP BY parsing_method
    `;
    console.log("\nCompleted Events (by method):");
    console.table(completedCounts);

    const [totalEvents] = await sql`SELECT count(*) FROM events`;
    console.log(`\nTotal Published Events: ${totalEvents.count}`);
  } catch (e) {
    console.error(e);
  } finally {
    await sql.end();
  }
}

summarize();
