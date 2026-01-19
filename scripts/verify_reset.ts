
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log("📊 VERIFYING RESET STATUS...");

    const tables = ["scrape_jobs", "discovery_jobs", "events", "scraper_sources"];
    for (const table of tables) {
        const { count, error } = await supabase.from(table).select("*", { count: 'exact', head: true });
        console.log(`${table}: ${count} rows`);
    }

    const { data: pilotPending } = await supabase.from("cities").select("name").eq("discovery_status", "pilot_pending");
    console.log(`Cities with 'pilot_pending': ${pilotPending?.length || 0}`);
    if (pilotPending && pilotPending.length > 0) {
        console.log(`Pilot Cities: ${pilotPending.map(c => c.name).join(", ")}`);
    }
}

main();
