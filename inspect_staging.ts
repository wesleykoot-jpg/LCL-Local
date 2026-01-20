// inspect_staging.ts
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl, supabaseServiceRoleKey } from "./supabase/functions/_shared/env.ts";

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function main() {
  const { data, error } = await supabase
    .from("raw_event_staging")
    .select("*")
    .limit(1);
    
  if (error) {
    console.error("Error fetching raw_event_staging:", error);
  } else if (data && data.length > 0) {
    console.log("Keys in raw_event_staging:", Object.keys(data[0]));
    console.log("Full first row:", JSON.stringify(data[0], null, 2));
  } else {
    console.log("raw_event_staging is empty.");
  }

  const { data: source, error: sErr } = await supabase
    .from("scraper_sources")
    .select("*")
    .limit(1);
    
  if (sErr) {
    console.error("Error fetching scraper_sources:", sErr);
  } else if (source && source.length > 0) {
    console.log("Keys in scraper_sources:", Object.keys(source[0]));
  }
}

main().catch(console.error);
