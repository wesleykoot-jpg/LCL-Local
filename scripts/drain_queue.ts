
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const WORKER_URL = `${SUPABASE_URL}/functions/v1/scrape-worker`;

async function main() {
  console.log("🌊 Starting queue drain...");

  let pendingCount = 1; // Start high to enter loop
  let batch = 0;

  while (pendingCount > 0) {
    batch++;
    
    // Check pending jobs
    const { count, error } = await supabase
      .from("scrape_jobs")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending")
      .lt("attempts", 3);

    if (error) {
      console.error("Error checking pending jobs:", error);
      break;
    }

    pendingCount = count || 0;
    console.log(`\n📦 Batch ${batch}: ${pendingCount} pending jobs remaining from total queue.`);

    if (pendingCount === 0) {
      console.log("✅ Queue drained!");
      break;
    }

    console.log(`🚀 Triggering worker for batch ${batch}...`);
    try {
        const r = await fetch(WORKER_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ enableDeepScraping: true })
        });
        
        console.log(`   Worker Status: ${r.status}`);
        const text = await r.text();
        console.log(`   Response: ${text.slice(0, 100)}...`);
        
        // Wait significantly longer to let resources free up and avoid 546 errors
        await new Promise(r => setTimeout(r, 60000)); // 60 seconds delay

    } catch (e) {
        console.error("Failed to trigger worker:", e);
        // Wait longer on error
        await new Promise(r => setTimeout(r, 10000));
    }
  }
}

main();
