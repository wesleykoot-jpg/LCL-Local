
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    const { count, error } = await supabase
        .from("events")
        .select("*", { count: "exact", head: true });
        
    if (error) {
        console.error("Error counting events:", error);
    } else {
        console.log(`Current Total Events: ${count}`);
    }
    
    // Check recent events from today
    const { count: recentCount } = await supabase
        .from("events")
        .select("*", { count: "exact", head: true })
        .gte("created_at", new Date(Date.now() - 3600000).toISOString()); // Last hour
        
    console.log(`Events created in last hour: ${recentCount}`);
}

main();
