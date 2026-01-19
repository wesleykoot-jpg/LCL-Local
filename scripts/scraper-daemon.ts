/**
 * Scraper Daemon - Always-on, calm continuous scraping
 * 
 * This daemon runs indefinitely, processing scrape jobs at a configurable pace
 * to avoid hitting API rate limits or worker limits.
 * 
 * Usage:
 *   export $(cat .env | xargs) && deno run --allow-net --allow-env --allow-read scripts/scraper-daemon.ts
 * 
 * Environment Variables:
 *   SCRAPE_INTERVAL_MS - Delay between job claims (default: 5000)
 *   BATCH_SIZE - Jobs to claim per cycle (default: 1)
 *   MAX_CONSECUTIVE_ERRORS - Errors before backoff (default: 10)
 */

import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { claimScrapeJobs, processJob } from "../supabase/functions/scrape-worker/index.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") || Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// Configuration with sensible defaults for calm operation
const SCRAPE_INTERVAL_MS = parseInt(Deno.env.get("SCRAPE_INTERVAL_MS") || "5000", 10);
const BATCH_SIZE = parseInt(Deno.env.get("BATCH_SIZE") || "1", 10);
const MAX_CONSECUTIVE_ERRORS = parseInt(Deno.env.get("MAX_CONSECUTIVE_ERRORS") || "10", 10);
const BACKOFF_MULTIPLIER = 2;
const MAX_BACKOFF_MS = 60000; // 1 minute max backoff

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface DaemonStats {
    totalProcessed: number;
    totalInserted: number;
    totalErrors: number;
    consecutiveErrors: number;
    startedAt: Date;
}

const stats: DaemonStats = {
    totalProcessed: 0,
    totalInserted: 0,
    totalErrors: 0,
    consecutiveErrors: 0,
    startedAt: new Date(),
};

function formatUptime(startedAt: Date): string {
    const seconds = Math.floor((Date.now() - startedAt.getTime()) / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}h ${minutes}m ${secs}s`;
}

function printStats() {
    console.log(`📊 Stats: ${stats.totalProcessed} processed, ${stats.totalInserted} inserted, ${stats.totalErrors} errors | Uptime: ${formatUptime(stats.startedAt)}`);
}

async function runDaemon() {
    console.log("🚀 Scraper Daemon Starting...");
    console.log(`⚙️  Config: interval=${SCRAPE_INTERVAL_MS}ms, batch=${BATCH_SIZE}, maxErrors=${MAX_CONSECUTIVE_ERRORS}`);
    console.log("Press Ctrl+C to stop.\n");

    let currentBackoff = SCRAPE_INTERVAL_MS;

    while (true) {
        try {
            // Claim jobs
            const jobs = await claimScrapeJobs(supabase, BATCH_SIZE);

            if (jobs.length === 0) {
                // No jobs available, wait and try again
                await Deno.stdout.write(new TextEncoder().encode("."));
                await new Promise(resolve => setTimeout(resolve, currentBackoff));
                continue;
            }

            // Process each job sequentially with calmness
            for (const job of jobs) {
                try {
                    const result = await processJob(supabase, job, undefined, true); // No Gemini
                    const jobStats = (result as { stats?: { inserted?: number } }).stats;
                    
                    stats.totalProcessed++;
                    stats.totalInserted += jobStats?.inserted || 0;
                    stats.consecutiveErrors = 0;
                    currentBackoff = SCRAPE_INTERVAL_MS; // Reset backoff on success

                    console.log(`\n✅ Job ${job.id.slice(0, 8)}... completed (${jobStats?.inserted || 0} inserted)`);
                } catch (jobError) {
                    stats.totalErrors++;
                    stats.consecutiveErrors++;
                    console.error(`\n❌ Job ${job.id.slice(0, 8)}... failed:`, jobError);
                }
            }

            // Print stats every 10 jobs
            if (stats.totalProcessed % 10 === 0) {
                printStats();
            }

            // Check for excessive errors and apply exponential backoff
            if (stats.consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
                currentBackoff = Math.min(currentBackoff * BACKOFF_MULTIPLIER, MAX_BACKOFF_MS);
                console.warn(`⚠️  Too many errors (${stats.consecutiveErrors}), backing off for ${currentBackoff / 1000}s`);
            }

            // Wait before next cycle (the "calm" part)
            await new Promise(resolve => setTimeout(resolve, currentBackoff));

        } catch (error) {
            stats.totalErrors++;
            stats.consecutiveErrors++;
            console.error("\n❌ Cycle error:", error);

            // Apply backoff on cycle errors too
            if (stats.consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
                currentBackoff = Math.min(currentBackoff * BACKOFF_MULTIPLIER, MAX_BACKOFF_MS);
                console.warn(`⚠️  Backing off for ${currentBackoff / 1000}s`);
            }

            await new Promise(resolve => setTimeout(resolve, currentBackoff));
        }
    }
}

// Handle graceful shutdown
Deno.addSignalListener("SIGINT", () => {
    console.log("\n\n👋 Daemon shutting down gracefully...");
    printStats();
    Deno.exit(0);
});

runDaemon();
