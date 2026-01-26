
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

// Load .env manually
try {
  const envText = await Deno.readTextFile(".env");
  for (const line of envText.split("\n")) {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      Deno.env.set(key, value);
    }
  }
} catch { /* ignore */ }

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing credentials");
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log("🔍 Checking Cron Jobs in Supabase...\n");

  // Query cron.job table via RPC or direct query
  // Note: cron schema might not be exposed via PostgREST, so we try an RPC
  const { data, error } = await supabase.rpc("get_cron_jobs");
  
  if (error) {
    console.log("RPC 'get_cron_jobs' not available. Trying direct SQL via debug endpoint...");
    
    // Fallback: make a direct request to check if pg_cron extension exists
    // We can't query cron.job directly via PostgREST, so we check what we can
    console.log("\n⚠️  Cannot query cron.job directly via Supabase API.");
    console.log("   The cron.job table is in the 'cron' schema which is not exposed via PostgREST.");
    console.log("\n📋 To verify cron jobs, run this SQL in Supabase Dashboard:");
    console.log("   SELECT jobname, schedule, command FROM cron.job;");
    console.log("\n   Expected jobs:");
    console.log("   - invoke-worker-watchdog: '2,12,22,32,42,52 * * * *'");
    console.log("   - invoke-discovery-worker: '7,37 * * * *'");
    console.log("   - invoke-coordinator: '0 * * * *'");
    console.log("   - cleanup-stuck-jobs: '*/30 * * * *'");
    return;
  }
  
  console.log("Cron Jobs:");
  for (const job of (data || [])) {
    console.log(`  ${job.jobname}: ${job.schedule}`);
  }
}

main();
