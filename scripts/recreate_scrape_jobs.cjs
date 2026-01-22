const postgres = require("postgres");
require("dotenv").config();

async function recreateScrapeJobs() {
  const sql = postgres({
    host: process.env.SUPABASE_DB_HOST,
    port: parseInt(process.env.SUPABASE_DB_PORT_SESSION || "6543"),
    database: process.env.SUPABASE_DB_NAME,
    username: process.env.SUPABASE_DB_USER,
    password: process.env.SUPABASE_DB_PASSWORD,
    ssl: "require",
  });

  try {
    console.log("🛠️  Recreating scrape_jobs table...");

    await sql`
      CREATE TABLE IF NOT EXISTS public.scrape_jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_id UUID NOT NULL REFERENCES scraper_sources(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
        priority INTEGER DEFAULT 0,
        attempts INTEGER DEFAULT 0,
        max_attempts INTEGER DEFAULT 3,
        error_message TEXT,
        events_scraped INTEGER DEFAULT 0,
        events_inserted INTEGER DEFAULT 0,
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );
    `;

    console.log("  ✓ Table created");

    await sql`CREATE INDEX IF NOT EXISTS idx_scrape_jobs_status ON scrape_jobs(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_scrape_jobs_pending ON scrape_jobs(priority DESC, created_at ASC) WHERE status = 'pending'`;
    await sql`CREATE INDEX IF NOT EXISTS idx_scrape_jobs_source ON scrape_jobs(source_id)`;

    console.log("  ✓ Indexes created");

    await sql`ALTER TABLE scrape_jobs ENABLE ROW LEVEL SECURITY`;

    // Check if policies exist before creating to avoid errors (or use DO block, but simple JS check is easier or just ignore error)
    // Actually, CREATE POLICY IF NOT EXISTS is not standard PG, so we might fail if exists.
    // For now, let's wrap in try-catch blocks or drop first.

    try {
      await sql`DROP POLICY IF EXISTS "Service role full access" ON scrape_jobs`;
      await sql`CREATE POLICY "Service role full access" ON scrape_jobs FOR ALL USING (true) WITH CHECK (true)`;
    } catch (e) {
      console.log("  Warning: Service role policy", e.message);
    }

    try {
      await sql`DROP POLICY IF EXISTS "Authenticated users can view jobs" ON scrape_jobs`;
      await sql`CREATE POLICY "Authenticated users can view jobs" ON scrape_jobs FOR SELECT USING (true)`;
    } catch (e) {
      console.log("  Warning: Auth policy", e.message);
    }

    console.log("  ✓ Policies created");

    try {
      await sql`DROP TRIGGER IF EXISTS update_scrape_jobs_updated_at ON scrape_jobs`;
      await sql`
        CREATE TRIGGER update_scrape_jobs_updated_at
        BEFORE UPDATE ON scrape_jobs
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
      `;
      console.log("  ✓ Trigger created");
    } catch (e) {
      console.log(
        "  ⚠️  Could not create trigger (function might be missing):",
        e.message,
      );
    }

    console.log("✅ scrape_jobs table ready!");
  } catch (error) {
    console.error("❌ Error recreating scrape_jobs:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

recreateScrapeJobs();
