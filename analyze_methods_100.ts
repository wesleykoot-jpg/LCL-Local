
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import "jsr:@std/dotenv/load";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function analyzeMethods() {
  console.log("Analyzing processing methods for first 100 events...");

  const { data: events, error } = await supabase
    .from("raw_event_staging")
    .select("status, parsing_method, source_url, source_id")
    .limit(100);

  if (error) {
    console.error("Error fetching events:", error);
    return;
  }

  const stats: Record<string, number> = {};
  
  if (events.length === 0) {
      console.log("No events found. Pipeline might still be running.");
      return;
  }

  events.forEach(e => {
    const method = e.parsing_method || 'null (not set)';
    stats[method] = (stats[method] || 0) + 1;
  });

  console.log("\n--- Method Distribution (First 100) ---");
  for (const [method, count] of Object.entries(stats)) {
    console.log(`${method}: ${count}`);
  }
  console.log("---------------------------------------");
}

analyzeMethods();
