
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    console.log("🧪 Testing update_scraper_source_stats RPC...");
    const sourceId = "d4038737-6bf7-43ca-870e-034ceba85cad"; // Use a valid source ID

    const { data, error } = await supabase.rpc("update_scraper_source_stats", {
        p_source_id: sourceId,
        p_events_scraped: 5,
        p_success: true,
        p_last_error: null
    });

    if (error) {
        console.error("❌ RPC Failed:", error);
    } else {
        console.log("✅ RPC Success:", data);
        
        // Verify update
        const { data: source } = await supabase
            .from("scraper_sources")
            .select("last_scraped_at, total_events_scraped")
            .eq("id", sourceId)
            .single();
        console.log("Source Data:", source);
    }
}

main();
