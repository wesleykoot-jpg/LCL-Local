
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log("Setting up Dutch Pilot...");

    // 1. Reset (Optional, but good for idempotency)
    // await supabase.from('cities').update({ discovery_status: 'pending' }).eq('country_code', 'NL');

    // 2. Fetch all NL cities sorted by population
    const { data: cities, error } = await supabase
        .from("cities")
        .select("id, name, population")
        .eq("country_code", "NL")
        .order("population", { ascending: false });

    if (error) {
        console.error("Error fetching cities:", error);
        return;
    }

    if (!cities || cities.length === 0) {
        console.error("No NL cities found!");
        return;
    }

    console.log(`Found ${cities.length} Dutch cities.`);

    // 3. Select Cohorts
    const xl = cities.slice(0, 5); // Top 5
    // Medium: Skip top 20, take next 5.
    const medium = cities.slice(20, 25);
    // Small: Skip top 100, take next 5.
    const small = cities.slice(100, 105);

    const targets = [...xl, ...medium, ...small];

    console.log("Targets selected:");
    targets.forEach(c => console.log(`- [${c.population}] ${c.name}`));

    // 4. Update Status
    const ids = targets.map(c => c.id);
    const { error: updateError } = await supabase
        .from("cities")
        .update({
            discovery_status: "pilot_pending",
            priority_tier: 1
        })
        .in("id", ids);

    if (updateError) {
        console.error("Update failed:", updateError);
    } else {
        console.log(`Successfully marked ${ids.length} cities for Pilot.`);
    }
}

main();
