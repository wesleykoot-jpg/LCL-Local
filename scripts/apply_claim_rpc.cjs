const postgres = require("postgres");
require("dotenv").config();

async function applyClaimRPC() {
  const sql = postgres({
    host: process.env.SUPABASE_DB_HOST,
    port: parseInt(process.env.SUPABASE_DB_PORT_SESSION || "6543"),
    database: process.env.SUPABASE_DB_NAME,
    username: process.env.SUPABASE_DB_USER,
    password: process.env.SUPABASE_DB_PASSWORD,
    ssl: "require",
  });

  try {
    console.log("🛠️  Aplicando claim_staging_rows RPC...");

    // Explicitly drop to allow return type change
    await sql`DROP FUNCTION IF EXISTS public.claim_staging_rows(integer)`;

    await sql`
    CREATE OR REPLACE FUNCTION public.claim_staging_rows(p_batch_size INTEGER DEFAULT 10)
    RETURNS TABLE(
      id UUID,
      source_id UUID,
      source_url TEXT,
      raw_payload JSONB,
      raw_html TEXT,
      status TEXT,
      parsing_method TEXT
    )
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    BEGIN
      RETURN QUERY
      WITH candidates AS (
        SELECT raw_event_staging.id
        FROM raw_event_staging
        WHERE raw_event_staging.status = 'pending'
          AND (raw_event_staging.retry_count IS NULL OR raw_event_staging.retry_count < 3)
        ORDER BY raw_event_staging.created_at ASC
        LIMIT p_batch_size
        FOR UPDATE SKIP LOCKED  -- Atomic lock prevents race conditions
      )
      UPDATE raw_event_staging
      SET 
        status = 'processing',
        processing_started_at = NOW(),
        updated_at = NOW()
      WHERE raw_event_staging.id IN (SELECT candidates.id FROM candidates)
      RETURNING 
        raw_event_staging.id,
        raw_event_staging.source_id,
        raw_event_staging.source_url,
        raw_event_staging.raw_payload,
        raw_event_staging.raw_html,
        raw_event_staging.status::TEXT,
        raw_event_staging.parsing_method::TEXT;
    END;
    $$;
    `;
    console.log("  ✓ Function created/updated");

    await sql`GRANT EXECUTE ON FUNCTION public.claim_staging_rows(INTEGER) TO service_role`;
    await sql`GRANT EXECUTE ON FUNCTION public.claim_staging_rows(INTEGER) TO authenticated`;
    await sql`GRANT EXECUTE ON FUNCTION public.claim_staging_rows(INTEGER) TO anon`;
    console.log("  ✓ Grants updated");
  } catch (error) {
    console.error("❌ Error applying RPC:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

applyClaimRPC();
