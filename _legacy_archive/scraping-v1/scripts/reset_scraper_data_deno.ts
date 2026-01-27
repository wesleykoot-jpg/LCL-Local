
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import "jsr:@std/dotenv/load";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function resetData() {
  console.log("Resetting data...");

  // Truncate tables by deleting all rows (since we can't run raw SQL easily without RPC)
  const { error: e1 } = await supabase.from('events').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
  if (e1) console.error("Error clearing events:", e1); else console.log("Cleared events table");

  const { error: e2 } = await supabase.from('raw_event_staging').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (e2) console.error("Error clearing raw_event_staging:", e2); else console.log("Cleared raw_event_staging table");

  const { error: e3 } = await supabase.from('scraper_insights').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (e3) console.error("Error clearing scraper_insights:", e3); else console.log("Cleared scraper_insights table");

  // Reset scraper sources
  const { error: e4 } = await supabase.from('scraper_sources').update({
    last_payload_hash: null,
    last_scraped_at: null
  }).neq('id', '00000000-0000-0000-0000-000000000000');
  
  if (e4) console.error("Error resetting scraper_sources:", e4); else console.log("Reset scraper_sources metadata");

  console.log("Reset complete.");
}

resetData();
