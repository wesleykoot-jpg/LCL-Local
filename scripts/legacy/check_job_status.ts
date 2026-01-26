
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") || Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing Supabase env vars");
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    const { data, error } = await supabase.from("scrape_jobs").select("status");
    if (error) {
        console.error(error);
        return;
    }
    const counts = data.reduce((acc: Record<string, number>, job) => {
        acc[job.status] = (acc[job.status] || 0) + 1;
        return acc;
    }, {});
    console.log("Job status summary:", counts);
}

main();
