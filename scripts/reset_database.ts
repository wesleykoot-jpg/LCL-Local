
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log("🚀 STARTING DATABASE RESET...");

    // 1. Clear Scrape Jobs
    console.log("1. Clearing Scrape Jobs...");
    const { error: err1 } = await supabase.from("scrape_jobs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (err1) console.error("Error clearing scrape_jobs:", err1.message);

    // 2. Clear Discovery Jobs
    console.log("2. Clearing Discovery Jobs...");
    const { error: err2 } = await supabase.from("discovery_jobs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (err2) console.error("Error clearing discovery_jobs:", err2.message);

    // 3. Clear Events
    console.log("3. Clearing Events...");
    const { error: err3 } = await supabase.from("events").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (err3) console.error("Error clearing events:", err3.message);

    // 4. Clear Auto-Discovered Sources
    console.log("4. Clearing Auto-Discovered scraper_sources...");
    const { error: err4 } = await supabase.from("scraper_sources").delete().eq("auto_discovered", true);
    if (err4) console.error("Error clearing scraper_sources:", err4.message);

    // 5. Reset Cities Status
    console.log("5. Resetting Cities Table Status...");
    const { error: err5 } = await supabase.from("cities").update({ discovery_status: null, priority_tier: 1 }).neq("id", "00000000-0000-0000-0000-000000000000");
    if (err5) console.error("Error resetting cities status:", err5.message);

    // 6. Re-setup Pilot Cities
    console.log("6. Re-marking Pilot Cities as 'pilot_pending'...");
    const pilotCities = [
        'Amsterdam', 'Rotterdam', 'Den Haag', 'Utrecht', 'Eindhoven',
        'Groningen', 'Tilburg', 'Almere', 'Breda', 'Nijmegen',
        'Venlo', 'Zwolle', 'Deventer', 'Helmond', 'Amstelveen'
    ];

    const { error: err6 } = await supabase.from("cities")
        .update({ discovery_status: 'pilot_pending', priority_tier: 0 })
        .in("name", pilotCities);

    if (err6) console.error("Error re-setting pilot cities:", err6.message);

    console.log("✅ DATABASE RESET COMPLETE. SYSTEM READY FOR FRESH START.");
}

main();
