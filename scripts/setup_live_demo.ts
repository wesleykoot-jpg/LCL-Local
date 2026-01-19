
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log("🚀 SETUP LIVE DEMO: NORTH IMPULSE");

    // 1. Insert Missing Cities (Dokkum, Giethoorn)
    // Coordinates (approx)
    const missing = [
        { name: "Dokkum", country: "NL", lat: 53.32, lng: 5.99, population: 12669, province: "Friesland" },
        { name: "Giethoorn", country: "NL", lat: 52.74, lng: 6.08, population: 2620, province: "Overijssel" }
    ];

    for (const city of missing) {
        const { data, error } = await supabase.from("cities").select("id").eq("name", city.name).single();
        if (!data) {
            console.log(`Inserting ${city.name}...`);
            await supabase.from("cities").insert(city);
        } else {
            console.log(`${city.name} already exists.`);
        }
    }

    // 2. Configure Pilot Status
    const targets = ["Groningen", "Meppel", "Steenwijk", "Leeuwarden", "Dokkum", "Giethoorn"];

    // Reset ALL first (Safety)
    await supabase.from("cities").update({ discovery_status: null, priority_tier: 1 }).neq("id", "00000000-0000-0000-0000-000000000000");

    // Enable Targets
    console.log(`Activating ${targets.join(", ")}...`);
    const { error: updateError } = await supabase
        .from("cities")
        .update({ discovery_status: "pilot_pending", priority_tier: 0 })
        .in("name", targets);

    if (updateError) console.error("Update Error:", updateError);
    else console.log("✅ Live Demo Batch Ready.");
}

main();
