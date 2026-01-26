
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") || Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing Supabase env vars");
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    console.log("Checking columns for 'events' table...");
    // We can't use exec_sql easily if it's not confirmed working for this.
    // We'll just try to select one row with 'embedding' and see if it fails.
    const { data, error } = await supabase.from("events").select("embedding").limit(1);
    
    if (error) {
        console.error("Error selecting 'embedding':", error);
    } else {
        console.log("Successfully selected 'embedding' column. Data sample:", data);
    }
}

main();
