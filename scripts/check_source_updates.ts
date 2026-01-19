
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { config } from "https://deno.land/std@0.168.0/dotenv/mod.ts";
config({ export: true, safe: false, allowEmptyValues: true });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing supabase credentials");
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    console.log("Checking recent source updates...");
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { data, error } = await supabase
        .from("scraper_sources")
        .select("id, name, last_scraped_at, updated_at")
        .gt("last_scraped_at", oneHourAgo)
        .order("last_scraped_at", { ascending: false });

    if (error) {
        console.error("Error fetching sources:", error);
        return;
    }

    if (data.length === 0) {
        console.log("No sources updated in the last hour.");
    } else {
        console.log(`Found ${data.length} updated sources:`);
        data.slice(0, 5).forEach(s => {
            console.log(`[${s.last_scraped_at}] ${s.name} (${s.id})`);
        });
    }
}

main();
