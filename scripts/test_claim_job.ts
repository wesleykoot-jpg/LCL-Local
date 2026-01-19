
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log("🧪 Testing claim_scrape_jobs RPC...");

  // Check pending count first
  const { count, error: countError } = await supabase
    .from("scrape_jobs")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending")
    .lt("attempts", 3); // Assuming default max is 3

  if (countError) {
      console.error("Failed to count pending jobs:", countError);
  } else {
      console.log(`Pending jobs count (attempts < 3): ${count}`);
  }

  // Debug: show one job
  const { data: job, error: jobError } = await supabase
    .from("scrape_jobs")
    .select("id, status, attempts, max_attempts")
    .eq("status", "pending")
    .limit(1);
    
  if (jobError) console.error("Job fetch error:", jobError);
  console.log("Sample pending job:", job);

  // Call RPC
  const { data, error } = await supabase.rpc("claim_scrape_jobs", { p_batch_size: 1 });

  if (error) {
    console.error("❌ RPC Failed:", error);
    console.error("Message:", error.message);
  } else {
    console.log("✅ RPC Success:", data);
  }
}

main();
