
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log("📡 MONITORING LIVE DEMO...");
    const targets = ["Groningen", "Meppel", "Steenwijk", "Leeuwarden", "Dokkum", "Giethoorn"];

    // 1. Check Discovery Jobs
    const { data: jobs } = await supabase.from("discovery_jobs").select("municipality, status");
    const jobMap = {};
    jobs?.forEach(j => jobMap[j.municipality] = j.status);

    // 2. Check Sources
    const { data: sources } = await supabase.from("scraper_sources").select("location_name, name, auto_discovered");
    const sourceCount = {};
    targets.forEach(t => sourceCount[t] = 0);
    sources?.forEach(s => {
        // Fuzzy match or exact?
        const target = targets.find(t => s.location_name && s.location_name.includes(t));
        if (target) sourceCount[target]++;
    });

    console.table(targets.map(t => ({
        City: t,
        JobStatus: jobMap[t] || "Pending Start",
        SourcesFound: sourceCount[t]
    })));
}

main();
