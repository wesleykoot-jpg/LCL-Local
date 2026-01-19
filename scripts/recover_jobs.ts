
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    console.log("🧹 Recovering stuck scrape jobs...");
    
    // Call the recovery function we saw earlier in migrations
    const { data, error } = await supabase.rpc("recover_stuck_scrape_jobs", { p_timeout_minutes: 1 }); // Recover anything older than 1 min for aggressive clearing

    if (error) {
        console.error("Recovery failed:", error);
    } else {
        console.log(`Recovered ${data} stuck jobs.`);
    }
}

main();
