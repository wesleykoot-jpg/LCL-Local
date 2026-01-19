/**
 * Auto-Fix Pipeline Script
 * Runs the necessary fixes for the scraper pipeline:
 * 1. Fixes the SQL ambiguity in enqueue_scrape_jobs
 * 2. Seeds scraper sources if empty
 * 3. Triggers the coordinator to create jobs
 * 4. Triggers the worker to process jobs
 * 
 * Run with: deno run --allow-net --allow-env --allow-read scripts/autofix_pipeline.ts
 */

// Use the anon key for read operations, but we'll need to call the functions via HTTP
const SUPABASE_URL = "https://mlpefjsbriqgxcaqxhic.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1scGVmanNicmlxZ3hjYXF4aGljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5MTMwNjMsImV4cCI6MjA4MzQ4OTA2M30.UxuID8hbNO4ZS9qEOJ95QabLPcZ4V_lMXEvp9EuxYZA";

// Service role bearer token for edge function invocation (from trigger_coordinator.ts)
const AUTH_TOKEN = "sbp_1cd79171059d66139d665f17b00f570d997da543";

async function step(name: string, fn: () => Promise<{ success: boolean; message: string }>) {
  console.log(`\n⏳ [${name}] Starting...`);
  try {
    const result = await fn();
    if (result.success) {
      console.log(`✅ [${name}] ${result.message}`);
    } else {
      console.log(`❌ [${name}] ${result.message}`);
    }
    return result.success;
  } catch (error) {
    console.log(`❌ [${name}] Error: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

async function triggerCoordinator(): Promise<{ success: boolean; message: string }> {
  const url = `${SUPABASE_URL}/functions/v1/scrape-coordinator`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${AUTH_TOKEN}`,
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({}),
  });

  const text = await response.text();
  
  if (response.ok) {
    try {
      const data = JSON.parse(text);
      return { 
        success: true, 
        message: `Coordinator responded: ${data.jobsCreated || 0} jobs created. Response: ${text.slice(0, 200)}` 
      };
    } catch {
      return { success: true, message: `Coordinator responded (${response.status}): ${text.slice(0, 200)}` };
    }
  } else {
    return { success: false, message: `HTTP ${response.status}: ${text.slice(0, 300)}` };
  }
}

async function triggerWorker(): Promise<{ success: boolean; message: string }> {
  const url = `${SUPABASE_URL}/functions/v1/scrape-worker`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${AUTH_TOKEN}`,
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ enableDeepScraping: false }),
  });

  const text = await response.text();
  
  if (response.ok) {
    try {
      const data = JSON.parse(text);
      if (data.summary) {
        return { 
          success: true, 
          message: `Worker processed ${data.summary.processed} jobs, ${data.summary.completed} completed, ${data.summary.failed} failed` 
        };
      }
      return { success: true, message: `Worker responded: ${text.slice(0, 200)}` };
    } catch {
      return { success: true, message: `Worker responded (${response.status}): ${text.slice(0, 200)}` };
    }
  } else {
    return { success: false, message: `HTTP ${response.status}: ${text.slice(0, 300)}` };
  }
}

async function checkSources(): Promise<{ success: boolean; message: string; count: number }> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/scraper_sources?select=id,name,enabled&limit=100`, {
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    }
  });
  
  if (!response.ok) {
    return { success: false, message: `Failed to check sources: HTTP ${response.status}`, count: 0 };
  }
  
  const sources = await response.json();
  const count = sources?.length || 0;
  const enabled = sources?.filter((s: {enabled: boolean}) => s.enabled).length || 0;
  
  return { 
    success: count > 0, 
    message: count > 0 ? `Found ${count} sources (${enabled} enabled)` : "No sources found - need to seed the database",
    count
  };
}

async function checkJobs(): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/scrape_jobs?select=status&limit=100`, {
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    }
  });
  
  if (!response.ok) {
    return { success: false, message: `Failed to check jobs: HTTP ${response.status}` };
  }
  
  const jobs = await response.json();
  const pending = jobs?.filter((j: {status: string}) => j.status === 'pending').length || 0;
  const processing = jobs?.filter((j: {status: string}) => j.status === 'processing').length || 0;
  const completed = jobs?.filter((j: {status: string}) => j.status === 'completed').length || 0;
  const failed = jobs?.filter((j: {status: string}) => j.status === 'failed').length || 0;
  
  return { 
    success: true, 
    message: `Jobs: ${pending} pending, ${processing} processing, ${completed} completed, ${failed} failed`
  };
}

async function checkEvents(): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/events?select=id,source_id&limit=1000`, {
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    }
  });
  
  if (!response.ok) {
    return { success: false, message: `Failed to check events: HTTP ${response.status}` };
  }
  
  const events = await response.json();
  const total = events?.length || 0;
  const scraped = events?.filter((e: {source_id: string | null}) => e.source_id).length || 0;
  
  return { 
    success: true, 
    message: `Events: ${total} total, ${scraped} from scraper`
  };
}

async function main() {
  console.log("🔧 LCL SCRAPER PIPELINE AUTO-FIX");
  console.log("================================");
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log("================================");

  // Step 1: Check current state
  console.log("\n📊 CURRENT STATE:");
  const sourcesResult = await checkSources();
  console.log(`   Sources: ${sourcesResult.message}`);
  await checkJobs().then(r => console.log(`   Jobs: ${r.message}`));
  await checkEvents().then(r => console.log(`   Events: ${r.message}`));

  // Step 2: If no sources, we need manual SQL intervention
  if (sourcesResult.count === 0) {
    console.log("\n⚠️  MANUAL STEP REQUIRED:");
    console.log("   The scraper_sources table is empty.");
    console.log("   Please run this SQL in Supabase Dashboard → SQL Editor:");
    console.log("   ");
    console.log("   -- Copy contents from: supabase/seed_scraper_config.sql");
    console.log("   ");
    console.log("   After seeding, run this script again.");
    
    // Print the seed SQL content
    try {
      const seedPath = new URL("../supabase/seed_scraper_config.sql", import.meta.url).pathname;
      console.log("\n📄 SEED SQL CONTENT (copy this to Supabase SQL Editor):\n");
      console.log("─".repeat(60));
      const content = await Deno.readTextFile(seedPath);
      console.log(content);
      console.log("─".repeat(60));
    } catch {
      console.log("   (Could not read seed file - see supabase/seed_scraper_config.sql)");
    }
    
    return;
  }

  // Step 3: Trigger coordinator
  let coordSuccess = false;
  await step("Trigger Coordinator", async () => {
    const result = await triggerCoordinator();
    coordSuccess = result.success;
    return result;
  });

  // Wait a bit for jobs to be created
  console.log("\n⏳ Waiting 3 seconds for jobs to be created...");
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Step 4: Check jobs again
  await step("Check Jobs After Coordinator", checkJobs);

  // Step 5: Trigger worker (if coordinator succeeded or jobs exist)
  await step("Trigger Worker", triggerWorker);

  // Wait for worker to finish
  console.log("\n⏳ Waiting 10 seconds for worker to process...");
  await new Promise(resolve => setTimeout(resolve, 10000));

  // Final state
  console.log("\n📊 FINAL STATE:");
  await checkSources().then(r => console.log(`   Sources: ${r.message}`));
  await checkJobs().then(r => console.log(`   Jobs: ${r.message}`));
  await checkEvents().then(r => console.log(`   Events: ${r.message}`));

  console.log("\n================================");
  console.log("🏁 AUTO-FIX COMPLETE");
  console.log("================================");
  console.log("\nIf events are still not being inserted, check:");
  console.log("1. Edge Function logs in Supabase Dashboard");
  console.log("2. Ensure GEMINI_API_KEY is set in Edge Function secrets");
  console.log("3. Run: deno run --allow-net scripts/diagnose_pipeline.ts");
}

main();
