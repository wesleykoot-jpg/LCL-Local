
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

// Use Supabase URL and Anon Key (assuming RLS allows or we use Service Key if available)
// Use the env vars from the codebase or similar
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://mlpefjsbriqgxcaqxhic.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error("SUPABASE_SERVICE_ROLE_KEY is required to run this script.");
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log("🧪 Testing enqueue_scrape_jobs RPC...");

  // 1. Create a dummy source temporarily? Or use an existing one?
  // We need a valid source_id usually to satisfy FK constraints in scrape_jobs
  // Let's try to fetch one first.
  const { data: sources, error: sourceError } = await supabase
    .from("scraper_sources")
    .select("id")
    .limit(1);

  if (sourceError) {
    console.error("Failed to fetch sources:", sourceError);
    return;
  }

  let sourceId = sources?.[0]?.id;
  
  if (!sourceId) {
      console.log("No sources found. Can't fully test FK constraints, but can test RPC execution with random UUID (might fail FK but check for ambiguous column error first)");
      sourceId = crypto.randomUUID();
  }

  console.log(`Using Source ID: ${sourceId}`);

  const payload = [
    {
      source_id: sourceId,
      payload: { test: true },
      next_scrape_at: new Date(Date.now() + 1000 * 60).toISOString(),
    },
  ];

  const { data, error } = await supabase.rpc("enqueue_scrape_jobs", { p_jobs: payload });

  if (error) {
    console.error("❌ RPC Failed:", error);
    console.error("Message:", error.message);
  } else {
    console.log("✅ RPC Success:", data);
  }
}

main();
