
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import "jsr:@std/dotenv/load";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL");
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  Deno.exit(1);
}

const sql = `
-- Add tags column and GIN index for search performance
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_events_tags ON public.events USING GIN (tags);

COMMENT ON COLUMN public.events.tags IS 'Granular sub-category tags (e.g. techno, yoga, market) used for filtering.';
`;

console.log("Executing Tags Migration...");

async function executeSql(schema: string = "") {
  const rpcUrl = schema ? `${supabaseUrl}/rest/v1/rpc/${schema}/exec_sql` : `${supabaseUrl}/rest/v1/rpc/exec_sql`;
  console.log(`Trying ${rpcUrl}...`);
  
  return await fetch(rpcUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": supabaseKey,
      "Authorization": `Bearer ${supabaseKey}`,
      "Prefer": "return=representation"
    },
    body: JSON.stringify({ sql: sql })
  });
}

let response = await executeSql(); // Try public first

if (!response.ok) {
  console.log("Public RPC failed, trying scraper schema...");
  response = await executeSql("scraper");
}

if (!response.ok) {
  const error = await response.text();
  console.error("Migration failed via exec_sql RPC:", error);
  console.log("\n⚠️  Please run the following SQL manually in the Supabase SQL Editor:");
  console.log(sql);
  Deno.exit(1);
}

console.log("Migration executed successfully!");
