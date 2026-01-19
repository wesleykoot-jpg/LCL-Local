/**
 * Lightweight Scraper Daemon for GitHub Actions
 * 
 * This version doesn't import the heavy scrape-worker code.
 * Instead, it directly invokes the Supabase Edge Function.
 */

import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") || Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const SCRAPE_INTERVAL_MS = parseInt(Deno.env.get("SCRAPE_INTERVAL_MS") || "3000", 10);
const MAX_JOBS = parseInt(Deno.env.get("MAX_JOBS_PER_RUN") || "50", 10);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function triggerWorker() {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/scrape-worker`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
        },
    });
    
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Worker failed: ${response.status} ${text}`);
    }
    
    return await response.json();
}

async function run() {
    console.log("🚀 Lightweight Scraper Daemon Starting...");
    console.log(`⚙️  Config: interval=${SCRAPE_INTERVAL_MS}ms, maxJobs=${MAX_JOBS}`);
    
    let processed = 0;
    
    while (processed < MAX_JOBS) {
        try {
            // Check for pending jobs
            const { count } = await supabase
                .from('scrape_jobs')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'pending');
            
            if (!count || count === 0) {
                console.log("✅ No pending jobs remaining");
                break;
            }
            
            console.log(`📋 ${count} pending jobs, triggering worker...`);
            
            // Trigger the worker
            const result = await triggerWorker();
            processed++;
            
            console.log(`✅ Worker completed (${processed}/${MAX_JOBS})`);
            
            // Wait before next trigger
            await new Promise(resolve => setTimeout(resolve, SCRAPE_INTERVAL_MS));
            
        } catch (error) {
            console.error("❌ Error:", error);
            await new Promise(resolve => setTimeout(resolve, SCRAPE_INTERVAL_MS * 2));
        }
    }
    
    console.log(`\n🏁 Daemon complete: ${processed} workers triggered`);
}

run();
