
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import "jsr:@std/dotenv/load";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function checkMarkers() {
  console.log("Checking for hydration and feed markers in 'dom' processed rows...");

  const { data: rows, error } = await supabase
    .from("raw_event_staging")
    .select("source_url, raw_html, parsing_method")
    .eq("parsing_method", "dom")
    .limit(20);

  if (error) {
    console.error("Error fetching rows:", error);
    return;
  }

  const markers = [
    { name: '__NEXT_DATA__', pattern: /__NEXT_DATA__/ },
    { name: '__NUXT__', pattern: /__NUXT__/ },
    { name: 'RSS Link', pattern: /type="application\/rss\+xml"/ },
    { name: 'Atom Link', pattern: /type="application\/atom\+xml"/ },
    { name: 'ICS Link', pattern: /\.ics/ }
  ];

  for (const row of rows) {
    console.log(`\nSource: ${row.source_url}`);
    let foundAny = false;
    for (const marker of markers) {
      if (marker.pattern.test(row.raw_html)) {
        console.log(`  [FOUND] ${marker.name}`);
        foundAny = true;
      }
    }
    if (!foundAny) console.log("  No markers found.");
  }
}

checkMarkers();
