
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    console.log("🔄 Resetting scrape schedule for all enabled sources...");
    
    const { error } = await supabase
        .from("scraper_sources")
        .update({ 
            next_scrape_at: new Date(Date.now() - 86400000).toISOString(), // 24h ago
            consecutive_errors: 0,
            consecutive_failures: 0,
            last_error: null 
        })
        .eq("enabled", true);
        
    if (error) {
        console.error("Failed to reset schedule:", error);
    } else {
        console.log("✅ Successfully reset schedule. Coordinator will now pick up all enabled sources.");
    }
}

main();
