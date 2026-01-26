const postgres = require("postgres");
require("dotenv").config();

async function checkTable() {
  const sql = postgres({
    host: process.env.SUPABASE_DB_HOST,
    port: parseInt(process.env.SUPABASE_DB_PORT_SESSION || "6543"),
    database: process.env.SUPABASE_DB_NAME,
    username: process.env.SUPABASE_DB_USER,
    password: process.env.SUPABASE_DB_PASSWORD,
    ssl: "require",
  });

  try {
    const [result] = await sql`
      SELECT to_regclass('public.scraper_insights');
    `;
    console.log("Table exists:", !!result.to_regclass);
  } catch (e) {
    console.error(e);
  } finally {
    await sql.end();
  }
}

checkTable();
