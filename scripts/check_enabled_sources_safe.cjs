const postgres = require("postgres");
require("dotenv").config();

async function checkSources() {
  const sql = postgres({
    host: process.env.SUPABASE_DB_HOST,
    port: parseInt(process.env.SUPABASE_DB_PORT_SESSION || "6543"),
    database: process.env.SUPABASE_DB_NAME,
    username: process.env.SUPABASE_DB_USER,
    password: process.env.SUPABASE_DB_PASSWORD,
    ssl: "require",
  });

  try {
    const [count] =
      await sql`SELECT count(*) FROM scraper_sources WHERE enabled = true`;
    console.log(`Enabled Sources: ${count.count}`);

    // Show a sample
    const sources =
      await sql`SELECT id, url, name FROM scraper_sources WHERE enabled = true LIMIT 5`;
    console.log("Sample Sources:", sources);
  } catch (e) {
    console.error(e);
  } finally {
    await sql.end();
  }
}

checkSources();
