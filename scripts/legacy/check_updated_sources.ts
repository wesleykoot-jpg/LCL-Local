
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    console.log("📊 Checking updated sources...");
    const { data: sources, error } = await supabase
        .from("scraper_sources")
        .select("name, total_events_scraped, last_scraped_at")
        .not("last_scraped_at", "is", null) // corrected syntax
        .order("last_scraped_at", { ascending: false })
        .limit(10);
        
    if (error) console.error(error);
    else console.table(sources);
}

main();
