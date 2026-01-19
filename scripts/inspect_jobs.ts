
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    console.log("🕵️‍♀️ Inspecting Job Outcomes...");

    const { data: jobs, error } = await supabase
        .from("scrape_jobs")
        .select("id, status, error_message, events_scraped, events_inserted, created_at, updated_at")
        .order("updated_at", { ascending: false })
        .limit(20);

    if (error) {
        console.error("Failed to fetch jobs:", error);
        return;
    }

    console.table(jobs.map(j => ({
        status: j.status,
        scraped: j.events_scraped,
        inserted: j.events_inserted,
        error: j.error_message ? j.error_message.slice(0, 50) + "..." : "None",
        updated: new Date(j.updated_at).toLocaleTimeString()
    })));
}

main();
