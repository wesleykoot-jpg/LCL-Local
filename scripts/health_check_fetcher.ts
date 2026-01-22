// health_check_fetcher.ts
// This script invokes the Scrape Events function and reports the number of staged rows.

import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
  Deno.exit(1);
}

const fetcherUrl = `${supabaseUrl}/functions/v1/scrape-events`;

try {
  const resp = await fetch(fetcherUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({})
  });
  const data = await resp.json();
  console.log("Fetcher response:", data);
  if (resp.ok) {
    console.log("✅ Fetcher completed successfully.");
  } else {
    console.error("❌ Fetcher reported error:", data);
    Deno.exit(1);
  }
} catch (e) {
  console.error("❌ Error calling fetcher:", e);
  Deno.exit(1);
}
