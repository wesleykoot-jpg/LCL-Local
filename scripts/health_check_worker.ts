// health_check_worker.ts
// This script invokes the Enrichment Worker function and reports the result.

import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
  Deno.exit(1);
}

const workerUrl = `${supabaseUrl}/functions/v1/enrichment-worker`;

try {
  const resp = await fetch(workerUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({})
  });
  const data = await resp.json();
  console.log("Worker response:", data);
  if (resp.ok || resp.status === 400) {
    console.log("✅ Enrichment Worker reachable (webhook payload required).");
  } else {
    console.error("❌ Worker reported error:", data);
    Deno.exit(1);
  }
} catch (e) {
  console.error("❌ Error calling worker:", e);
  Deno.exit(1);
}
