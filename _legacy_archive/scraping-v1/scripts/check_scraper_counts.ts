import { createClient } from "npm:@supabase/supabase-js@2";
import "jsr:@std/dotenv/load";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing env vars");
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const { count: stagedCount } = await supabase
  .from("raw_event_staging")
  .select("*", { count: "exact", head: true });

const { count: eventCount } = await supabase
  .from("events")
  .select("*", { count: "exact", head: true });

console.log(`Staged: ${stagedCount}`);
console.log(`Events: ${eventCount}`);
