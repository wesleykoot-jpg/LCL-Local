
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
  console.log("🚀 FORCE PROCESSING PIPELINE");
  console.log("=".repeat(50));

  // 1. Reset stuck 'processing' jobs
  console.log("\n🔄 Resetting stuck jobs (processing > 1 hour)...");
  const { error: resetError } = await supabase.rpc("reset_stuck_scrape_jobs");
  if (resetError) {
    console.error("   Reset RPC failed:", resetError.message);
  } else {
    console.log("   ✅ Stuck jobs reset.");
  }

  // 2. Check pending count
  const { data: pendingJobs } = await supabase
    .from("scrape_jobs")
    .select("id")
    .eq("status", "pending");
  console.log(`\n📋 Pending jobs: ${pendingJobs?.length || 0}`);

  if (!pendingJobs || pendingJobs.length === 0) {
    console.log("   No pending jobs to process.");
    return;
  }

  // 3. Trigger worker repeatedly
  const ITERATIONS = 5;
  console.log(`\n🔥 Triggering worker ${ITERATIONS} times...`);
  
  for (let i = 0; i < ITERATIONS; i++) {
    console.log(`\n   Iteration ${i + 1}/${ITERATIONS}...`);
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/scrape-worker`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ enableDeepScraping: false }),
      });
      const text = await resp.text();
      console.log(`   Status: ${resp.status}`);
      try {
        const data = JSON.parse(text);
        if (data.summary) {
          console.log(`   Processed: ${data.summary.processed}, Completed: ${data.summary.completed}, Failed: ${data.summary.failed}`);
        } else {
          console.log(`   Response: ${text.slice(0, 150)}`);
        }
      } catch {
        console.log(`   Response: ${text.slice(0, 150)}`);
      }
    } catch (e) {
      console.error("   Worker call failed:", e);
    }
    
    // Wait a bit between calls
    await new Promise(r => setTimeout(r, 2000));
  }

  // 4. Check final event count
  const { count: eventsCount } = await supabase.from("events").select("*", { count: "exact", head: true });
  console.log(`\n📊 Total Events Now: ${eventsCount}`);

  console.log("\n" + "=".repeat(50));
  console.log("🏁 DONE");
}

main();
