const postgres = require("postgres");
require("dotenv").config();

async function patchScrapeJobs() {
  const sql = postgres({
    host: process.env.SUPABASE_DB_HOST,
    port: parseInt(process.env.SUPABASE_DB_PORT_SESSION || "6543"),
    database: process.env.SUPABASE_DB_NAME,
    username: process.env.SUPABASE_DB_USER,
    password: process.env.SUPABASE_DB_PASSWORD,
    ssl: "require",
  });

  try {
    console.log("🛠️  Patching scrape_jobs schema and functions...");

    // 1. Add payload column
    await sql`
      ALTER TABLE public.scrape_jobs
      ADD COLUMN IF NOT EXISTS payload jsonb DEFAULT '{}'::jsonb;
    `;
    console.log("  ✓ Added payload column");

    // 2. Add other columns just in case
    await sql`
      ALTER TABLE public.scraper_sources
      ADD COLUMN IF NOT EXISTS volatility_score numeric DEFAULT 0.5 CHECK (volatility_score >= 0 AND volatility_score <= 1),
      ADD COLUMN IF NOT EXISTS next_scrape_at timestamptz,
      ADD COLUMN IF NOT EXISTS consecutive_errors integer DEFAULT 0;
    `;
    console.log("  ✓ Verified scraper_sources columns");

    // 3. Recreate enqueue_scrape_jobs function
    await sql`
    CREATE OR REPLACE FUNCTION public.enqueue_scrape_jobs(p_jobs jsonb)
    RETURNS TABLE(out_job_id uuid, out_source_id uuid)
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    BEGIN
      IF p_jobs IS NULL OR jsonb_typeof(p_jobs) <> 'array' THEN
        RAISE EXCEPTION 'p_jobs must be a JSON array';
      END IF;

      RETURN QUERY
      WITH job_rows AS (
        SELECT
          (job->>'source_id')::uuid AS src_id,
          COALESCE(job->'payload', '{}'::jsonb) AS job_payload,
          (job->>'next_scrape_at')::timestamptz AS next_at
        FROM jsonb_array_elements(p_jobs) job
      ),
      cleaned AS (
        DELETE FROM public.scrape_jobs
        WHERE status = 'pending'
          AND public.scrape_jobs.source_id IN (SELECT src_id FROM job_rows)
      ),
      inserted AS (
        INSERT INTO public.scrape_jobs (source_id, status, payload, created_at)
        SELECT src_id, 'pending', job_payload, NOW()
        FROM job_rows
        RETURNING id, source_id
      ),
      updated AS (
        UPDATE public.scraper_sources s
        SET next_scrape_at = jr.next_at
        FROM job_rows jr
        WHERE s.id = jr.src_id
          AND jr.next_at IS NOT NULL
      )
      SELECT i.id, i.source_id FROM inserted i;
    END;
    $$;
    `;
    console.log("  ✓ Recreated enqueue_scrape_jobs RPC");

    // 4. Recreate claim_scrape_jobs function
    await sql`DROP FUNCTION IF EXISTS public.claim_scrape_jobs(integer)`;
    await sql`
    CREATE OR REPLACE FUNCTION public.claim_scrape_jobs(p_batch_size integer DEFAULT 5)
    RETURNS TABLE(id uuid, source_id uuid, payload jsonb, attempts integer, max_attempts integer)
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    BEGIN
      RETURN QUERY
      WITH candidates AS (
        SELECT id
        FROM public.scrape_jobs
        WHERE status = 'pending'
          AND attempts < max_attempts
        ORDER BY priority DESC, created_at ASC
        LIMIT p_batch_size
        FOR UPDATE SKIP LOCKED
      )
      UPDATE public.scrape_jobs
      SET status = 'processing',
          started_at = NOW(),
          attempts = attempts + 1
      WHERE id IN (SELECT id FROM candidates)
      RETURNING id, source_id, payload, attempts, max_attempts;
    END;
    $$;
    `;
    console.log("  ✓ Recreated claim_scrape_jobs RPC");

    console.log("✅ Patch applied successfully!");
  } catch (error) {
    console.error("❌ Error patching scrape_jobs:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

patchScrapeJobs();
