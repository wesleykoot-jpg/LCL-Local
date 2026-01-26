const postgres = require("postgres");
require("dotenv").config();

async function checkExtensions() {
  const sql = postgres({
    host: process.env.SUPABASE_DB_HOST,
    port: parseInt(process.env.SUPABASE_DB_PORT_SESSION || "6543"),
    database: process.env.SUPABASE_DB_NAME,
    username: process.env.SUPABASE_DB_USER,
    password: process.env.SUPABASE_DB_PASSWORD,
    ssl: "require",
  });

  try {
    const extensions = await sql`
      SELECT name, default_version, installed_version 
      FROM pg_available_extensions 
      WHERE name IN ('pg_cron', 'pg_net')
    `;
    console.table(extensions);
  } catch (e) {
    console.error(e);
  } finally {
    await sql.end();
  }
}

checkExtensions();
