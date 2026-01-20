// check_scraper_schema.ts
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl, supabaseServiceRoleKey } from "./supabase/functions/_shared/env.ts";

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  db: { schema: 'scraper' }
});

async function main() {
  const { data, error } = await supabase
    .from("raw_event_staging")
    .select("*")
    .limit(1);
    
  if (error) {
    console.error("Error fetching scraper.raw_event_staging:", error);
  } else {
    console.log("scraper.raw_event_staging found.");
    if (data && data.length > 0) {
      console.log("Keys in scraper.raw_event_staging:", Object.keys(data[0]));
    } else {
      console.log("scraper.raw_event_staging is empty.");
    }
  }
}

main().catch(console.error);
