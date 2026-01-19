
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log("🛑 SHUTTING DOWN PILOT...");

    const { error } = await supabase
        .from("cities")
        .update({ discovery_status: null, priority_tier: 1 })
        .neq("id", "00000000-0000-0000-0000-000000000000");

    if (error) {
        console.error("Error resetting cities status:", error.message);
    } else {
        console.log("✅ Successfully shut down pilot by resetting all city statuses.");
    }
}

main();
