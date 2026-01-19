
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { config } from "https://deno.land/std@0.168.0/dotenv/mod.ts";
import { processJob, claimScrapeJobs } from "../supabase/functions/scrape-worker/index.ts";

config({ export: true, safe: false, allowEmptyValues: true });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing supabase credentials");
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    console.log("🛠️  DEBUG WORKER STARTED");

    // 1. Reset one job to pending
    console.log("Resetting one 'processing' job to 'pending'...");
    const { data: resetData, error: resetError } = await supabase
        .from("scrape_jobs")
        .update({ status: "pending", attempts: 0 })
        .eq("status", "processing")
        .limit(1)
        .select();

    if (resetError) {
        console.error("Failed to reset job:", resetError);
        return;
    }

    if (!resetData || resetData.length === 0) {
        console.log("No processing jobs found to reset. Checking for pending jobs...");
    } else {
        console.log(`Reset job ${resetData[0].id}`);
    }

    // 2. Claim job
    console.log("Claiming job...");
    const jobs = await claimScrapeJobs(supabase, 1);
    
    if (jobs.length === 0) {
        console.log("No jobs claimed.");
        return;
    }

    const job = jobs[0];
    console.log(`Claimed job ${job.id} for source ${job.source_id}`);

    // 3. Process job
    console.log("Processing job...");
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_AI_API_KEY");
    // enableDeepScraping = true
    const result = await processJob(supabase, job, geminiApiKey, true);

    console.log("Process Result:", result);
}

main();
