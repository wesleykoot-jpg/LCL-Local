const postgres = require("postgres");
require("dotenv").config();

async function fixIndex() {
  const sql = postgres({
    host: process.env.SUPABASE_DB_HOST,
    port: parseInt(process.env.SUPABASE_DB_PORT_SESSION || "6543"),
    database: process.env.SUPABASE_DB_NAME,
    username: process.env.SUPABASE_DB_USER,
    password: process.env.SUPABASE_DB_PASSWORD,
    ssl: "require",
  });

  try {
    console.log("🛠️  Fixing events unique index...");

    // Drop existing non-unique index
    await sql`DROP INDEX IF EXISTS idx_events_fingerprint`;

    // Create unique index
    await sql`CREATE UNIQUE INDEX idx_events_fingerprint ON public.events (event_fingerprint)`;

    console.log("  ✓ Unique index created");
  } catch (error) {
    console.error("❌ Error fixing index:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

fixIndex();
