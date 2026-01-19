
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  Deno.exit(1);
}

const WORKER_URL = `${SUPABASE_URL}/functions/v1/scrape-worker`;

async function main() {
    console.log(`Triggering Scrape Worker at ${WORKER_URL}...`);
    try {
        const r = await fetch(WORKER_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ enableDeepScraping: true })
        });
        
        console.log(`Status: ${r.status}`);
        const text = await r.text();
        console.log("Response:", text);
    } catch (e) {
        console.error("Failed to trigger worker:", e);
    }
}

main();
