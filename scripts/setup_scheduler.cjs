const postgres = require("postgres");
require("dotenv").config();

async function setupScheduler() {
  const sql = postgres({
    host: process.env.SUPABASE_DB_HOST,
    port: parseInt(process.env.SUPABASE_DB_PORT_TRANSACTION || "5432"),
    database: process.env.SUPABASE_DB_NAME,
    username: process.env.SUPABASE_DB_USER,
    password: process.env.SUPABASE_DB_PASSWORD,
    ssl: "require",
  });

  const projectUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!projectUrl || !serviceKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const endpoint = `${projectUrl}/functions/v1/scrape-coordinator`;
  const cleanEndpoint = endpoint.replace(/([^:]\/)\/+/g, "$1");

  console.log(`Setting up heartbeat for: ${cleanEndpoint}`);

  try {
    // 1. Enable extension
    await sql`CREATE EXTENSION IF NOT EXISTS pg_cron`;
    await sql`CREATE EXTENSION IF NOT EXISTS pg_net`;

    const jobName = "scraper-heartbeat";

    // Create new job definition
    const headers = JSON.stringify({
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
    });

    const cronCommand = `
      SELECT net.http_post(
          url:='${cleanEndpoint}',
          headers:='${headers}'::jsonb,
          body:='{"triggerWorker": true}'::jsonb
      ) as request_id;
    `;

    // Schedule: */15 * * * * (Updates existing job if name matches)
    await sql`SELECT cron.schedule(${jobName}, '*/15 * * * *', ${cronCommand})`;

    console.log("✅ Scraper heartbeat scheduled via pg_cron (Every 15 mins).");
  } catch (e) {
    console.error("Setup failed:", e);
  } finally {
    await sql.end();
  }
}

setupScheduler();
