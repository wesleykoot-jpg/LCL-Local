
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PROJECT_REF = "mlpefjsbriqgxcaqxhic";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const FUNCTIONS_URL = `https://${PROJECT_REF}.supabase.co/functions/v1`;

async function main() {
    console.log("🚀 FORCE PILOT: VENLO");

    // 1. Reset City
    console.log("1. Resetting City Status...");
    await supabase
        .from("cities")
        .update({ discovery_status: "pilot_pending", discovery_status_details: null, priority_tier: 0 }) // Priority 0 guarantees selection
        .ilike("name", "Venlo");

    // 2. Trigger Coordinator (Cloud)
    console.log("2. Triggering Discovery Coordinator...");
    const triggerRes = await fetch(`${FUNCTIONS_URL}/source-discovery-coordinator`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${SUPABASE_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ triggerWorkers: true, limit: 1 }) // Pick 1 (Venlo is High Priority)
    });

    if (!triggerRes.ok) {
        console.error("Coordinator Failed:", await triggerRes.text());
        return;
    }
    const triggerJson = await triggerRes.json();
    console.log("Coordinator Response:", triggerJson);

    // 3. Poll Discovery Job
    console.log("3. Polling for Discovery Job...");
    let jobId = null;
    let sourceId = null;

    for (let i = 0; i < 20; i++) { // Max 40s wait
        await new Promise(r => setTimeout(r, 2000));

        // Find Job
        if (!jobId) {
            const { data: job } = await supabase.from('discovery_jobs').select('*').ilike('municipality', 'Venlo').filter('status', 'in', '("pending","processing","completed")').single();
            if (job) {
                console.log(`Job Found: ${job.id} [${job.status}]`);
                jobId = job.id;
            }
        }

        if (jobId) {
            const { data: job } = await supabase.from('discovery_jobs').select('*').eq('id', jobId).single();
            if (job.status === 'completed') {
                console.log("Discovery Completed!");
                break;
            } else if (job.status === 'failed') {
                console.error("Discovery Failed:", job.error_message);
                return;
            }
        }
    }

    // 4. Find Source
    console.log("4. Finding Discovered Source...");
    const { data: sources } = await supabase
        .from("scraper_sources")
        .select("*")
        .ilike("location_name", "%Venlo%")
        .eq("auto_discovered", true)
        .order("created_at", { ascending: false })
        .limit(1);

    if (!sources || sources.length === 0) {
        console.error("No Sources Discovered for Venlo!");
        return;
    }

    const source = sources[0];
    console.log(`Source Found: ${source.name} (${source.url})`);

    // 5. Trigger Scraper (Cloud)
    console.log("5. Triggering Scraper Worker...");
    // Scraper worker usually expects a Job ID from scrape_jobs?
    // Or can we trigger it with sourceId directly?
    // Checking scrape-worker index.ts... it expects { jobId } usually.
    // I have to CREATE a scrape_job first?
    // Insert into scrape_jobs -> Call Worker.

    const { data: scrapeJob, error: jobErr } = await supabase
        .from("scrape_jobs")
        .insert({
            source_id: source.id,
            status: 'pending',
            priority: 1
        })
        .select()
        .single();

    if (jobErr) { console.error("Create Scrape Job Failed:", jobErr); return; }
    console.log(`Scrape Job Created: ${scrapeJob.id}`);

    const scrapeRes = await fetch(`${FUNCTIONS_URL}/scrape-worker`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${SUPABASE_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ jobId: scrapeJob.id })
    });

    // Scrape Worker might take time. It returns stream or waits?
    // Usually waits.
    if (scrapeRes.ok) {
        const scrapeJson = await scrapeRes.json();
        console.log("Scrape Worker Result:", scrapeJson);
    } else {
        console.error("Scrape Worker Failed:", await scrapeRes.text());
    }

    // 6. Report Events
    console.log("6. Final Report...");
    const { count: eventCount } = await supabase
        .from("events")
        .select("*", { count: 'exact', head: true })
        .or("venue_name.ilike.%Venlo%,description.ilike.%Venlo%");

    // Also check by location coordinates approx?
    // Just text search for now.
    console.log(`Total Events for Venlo in DB: ${eventCount}`);
}

main();
