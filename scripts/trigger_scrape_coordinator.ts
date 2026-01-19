
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  Deno.exit(1);
}

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/scrape-coordinator`;

async function main() {
    console.log(`Triggering Scrape Coordinator at ${FUNCTION_URL}...`);
    try {
        const r = await fetch(FUNCTION_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                "Content-Type": "application/json"
            },
            // Trigger worker immediately to speed up validation
            body: JSON.stringify({ triggerWorker: true })
        });
        
        console.log(`Status: ${r.status}`);
        const text = await r.text();
        console.log("Response:", text);
    } catch (e) {
        console.error("Failed to trigger coordinator:", e);
    }
}

main();
