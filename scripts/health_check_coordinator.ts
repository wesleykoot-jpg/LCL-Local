// health_check_coordinator.ts
// This script invokes the Scrape Coordinator endpoint and reports the result.

import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
  Deno.exit(1);
}

const coordinatorUrl = `${supabaseUrl}/functions/v1/scrape-coordinator`;

try {
  const resp = await fetch(coordinatorUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({})
  });
  const data = await resp.json();
  console.log("Coordinator response:", data);
  if (data.success) {
    console.log(`✅ Enqueued ${data.jobsCreated} jobs for ${data.sources?.length ?? 0} sources.`);
  } else {
    console.error("❌ Coordinator reported failure:", data.error);
    Deno.exit(1);
  }
} catch (e) {
  console.error("❌ Error calling coordinator:", e);
  Deno.exit(1);
}
