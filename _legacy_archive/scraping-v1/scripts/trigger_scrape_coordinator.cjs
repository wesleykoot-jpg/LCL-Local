require("dotenv").config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/scrape-coordinator`;

async function main() {
  console.log(`Triggering Scrape Coordinator at ${FUNCTION_URL}...`);
  try {
    const r = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ triggerWorker: true }), // Standard payload
    });

    console.log(`Status: ${r.status} ${r.statusText}`);
    const text = await r.text();
    console.log("Response:", text);
  } catch (e) {
    console.error("Failed to fetch:", e);
  }
}

main();
