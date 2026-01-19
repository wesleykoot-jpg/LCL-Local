
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

// Load .env manually for robustness
try {
  const envText = await Deno.readTextFile(".env");
  for (const line of envText.split("\n")) {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      // Remove quotes if present
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      Deno.env.set(key, value);
    }
  }
} catch (e) {
  console.warn("Could not read .env file:", e.message);
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log("🧪 Verifying Self-Healing Automation...");

  // 1. Create a dummy source if needed (or pick one)
  const { data: sources } = await supabase.from("scraper_sources").select("id").limit(1);
  if (!sources || sources.length === 0) {
    console.error("No sources found. Cannot test.");
    return;
  }
  const sourceId = sources[0].id;

  // 2. Insert a "stuck" job
  // We manually set started_at to 2 hours ago
  const stuckDate = new Date();
  stuckDate.setHours(stuckDate.getHours() - 2);

  const { data: job, error: insertError } = await supabase
    .from("scrape_jobs")
    .insert({
      source_id: sourceId,
      status: "processing",
      started_at: stuckDate.toISOString(),
      attempts: 0,
      max_attempts: 3,
      payload: { test: "automation_verification" }
    })
    .select()
    .single();

  if (insertError) {
    console.error("Failed to insert test stuck job:", insertError);
    return;
  }

  console.log(`✅ Inserted stuck job ${job.id} (started_at: ${job.started_at})`);

  // 3. Call the cleanup function directly via RPC
  console.log("🔄 Invoking reset_stuck_scrape_jobs()...");
  const { error: rpcError } = await supabase.rpc("reset_stuck_scrape_jobs");

  if (rpcError) {
    console.error("❌ Failed to invoke cleanup RPC:", rpcError);
    // Try to cleanup test job
    await supabase.from("scrape_jobs").delete().eq("id", job.id);
    return;
  }

  // 4. Verify job status
  const { data: refreshedJob } = await supabase
    .from("scrape_jobs")
    .select("*")
    .eq("id", job.id)
    .single();

  if (refreshedJob.status === "pending" && refreshedJob.started_at === null) {
    console.log("✅ SUCCESS: Job was reset to 'pending' and started_at cleared.");
  } else {
    console.error("❌ FAILURE: Job status is", refreshedJob.status, "started_at:", refreshedJob.started_at);
  }

  // Cleanup
  console.log("🧹 Cleaning up test job...");
  await supabase.from("scrape_jobs").delete().eq("id", job.id);
}

main();
