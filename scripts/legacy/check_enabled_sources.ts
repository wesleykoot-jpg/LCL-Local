
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
        .from("scraper_sources")
        .select("*", { count: "exact", head: true })
        .eq("enabled", true);
        
    if (error) {
        console.error("Error counting sources:", error);
    } else {
        console.log(`Enabled Sources: ${count}`);
    }
}

main();
