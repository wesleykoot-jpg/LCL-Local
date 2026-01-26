
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const targets = ["Groningen", "Meppel", "Steenwijk", "Leeuwarden", "Dokkum", "Giethoorn"];
    console.log(`Checking ${targets.length} cities...`);

    const { data: found, error } = await supabase
        .from("cities")
        .select("name, id")
        .in("name", targets);

    if (error) { console.error(error); return; }

    const foundNames = found.map(c => c.name);
    const missing = targets.filter(t => !foundNames.includes(t));

    console.log(`Found: ${foundNames.length}`);
    if (foundNames.length > 0) console.log(`Present: ${foundNames.join(", ")}`);

    if (missing.length > 0) {
        console.log(`❌ MISSING: ${missing.join(", ")}`);
        console.log("These need to be inserted manually.");
    } else {
        console.log("✅ All cities present.");
    }
}

main();
