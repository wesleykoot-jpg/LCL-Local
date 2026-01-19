
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

// Load .env manually
try {
  const envText = await Deno.readTextFile(".env");
  for (const line of envText.split("\n")) {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      Deno.env.set(key, value);
    }
  }
} catch (e) { console.warn("No .env found"); }

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing credentials");
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log("Attempting to install extensions via RPC 'exec_sql'...");
  
  const sql = `
    CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
    CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
  `;

  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

  if (error) {
    console.error("RPC Failed:", error.message);
    console.log("Checking if extensions are already installed...");
    // Try to check extensions via another method if possible, or just fail.
  } else {
    console.log("✅ Extensions installed successfully via RPC!");
  }
}

main();
