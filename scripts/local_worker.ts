import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import {
  claimScrapeJobs,
  processJob,
} from "../supabase/functions/scrape-worker/index.ts";

// Try to load .env file manually
try {
  const text = await Deno.readTextFile(".env");
  for (const line of text.split("\n")) {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      let value = match[2].trim();
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      Deno.env.set(match[1], value);
    }
  }
} catch (_e) {
  console.log("⚠️ Could not read .env file, relying on process env");
}

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const GEMINI_API_KEY =
  Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_AI_API_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log("🚀 Starting Local Scraper Worker...");

  // Config
  const BATCH_SIZE = 5; // Smaller batch for local safety, but we can go higher if stable
  const DELAY_MS = 1000;

  let cycle = 0;

  while (true) {
    cycle++;
    console.log(`\n🔄 Cycle ${cycle}: Claiming jobs...`);

    try {
      const jobs = await claimScrapeJobs(supabase, BATCH_SIZE);

      if (jobs.length === 0) {
        console.log("✅ No pending jobs. Worker idle.");
        break; // Exit loop when done
      }

      console.log(`📦 Claimed ${jobs.length} jobs.`);

      // Process sequentially or parallel? Parallel is faster.
      console.log("Processing batch...");
      for (const job of jobs) {
        const res = await processJob(supabase, job, undefined, true);
        const stats = (res as any).stats;
        console.log(
          `Job ${job.id} for source ${job.source_id}: Scraped ${stats?.scraped ?? 0}, Inserted ${stats?.inserted ?? 0}`,
        );
      }
    } catch (err) {
      console.error("❌ Cycle error:", err);
      await new Promise((r) => setTimeout(r, 5000));
    }

    await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  console.log("👋 Local Worker finished.");
}

main();
