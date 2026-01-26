
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log("Checking Venlo Status...");

    // 0. Check Global Discovery
    const { count: globalCount } = await supabase.from("scraper_sources").select("*", { count: 'exact', head: true }).eq("auto_discovered", true);
    console.log(`Total Auto-Discovered Sources: ${globalCount}`);

    // 1. Check Sources
    const { data: sources, error: srcError } = await supabase
        .from("scraper_sources")
        .select("*")
        .ilike("location_name", "%Venlo%")
        .order("created_at", { ascending: false });

    if (srcError) { console.error("Source Error:", srcError); return; }

    console.log(`\nFound ${sources.length} Sources for Venlo:`);
    sources.forEach(s => console.log(`- [${s.id}] ${s.name} (${s.url}) [Auto: ${s.auto_discovered}]`));

    if (sources.length === 0) {
        // Check discovery job status
        const { data: job } = await supabase.from('discovery_jobs').select('*').ilike('municipality', 'Venlo').single();
        if (job) console.log(`Discovery Job Status: ${job.status}`);
        else console.log("No discovery job found for Venlo.");

        // Check City Status
        const { data: city } = await supabase.from('cities').select('discovery_status, priority_tier').ilike('name', 'Venlo').single();
        if (city) console.log(`City Status: ${city.discovery_status} (Tier: ${city.priority_tier})`);
        else console.log("City 'Venlo' not found in DB.");

        return;
    }

    // 2. Check Events
    const sourceIds = sources.map(s => s.id);
    // Need to find logic to link events to Venlo? 
    // Events table doesn't have 'city' column directly, but has 'location' content?
    // Or we filter by source_id? (Make sure events table has source_id?)
    // Let's check if events has source_id. NormalizedEvent has 'source' (string).
    // The 'events' table might not link to 'scraper_sources' id directly?
    // Wait, scrape-worker: 
    // const { error } = await supabase.from("events").upsert({ ... event_source_id: job.source_id ... })
    // Let's check schema. I assume 'event_source_id' exists?

    // Just count total for these sources if possible, or search venue_name/location

    // I'll try querying by text first
    const { count, error: evtError } = await supabase
        .from("events")
        .select("*", { count: 'exact', head: true })
        .ilike("location", "%Venlo%"); // Geo column? No, location is geography. 'venue_name'?

    // Better: select by matching title/description or venue
    const { data: events, error: evtError2 } = await supabase
        .from("events")
        .select("id, title, event_date, venue_name")
        .or("venue_name.ilike.%Venlo%,description.ilike.%Venlo%")
        .limit(20);

    if (evtError2) console.error("Event Error:", evtError2);
    else {
        console.log(`\nFound ${events.length} Events (Sample via text search):`);
        events.forEach(e => console.log(`- ${e.event_date}: ${e.title} @ ${e.venue_name}`));
    }
}

main();
