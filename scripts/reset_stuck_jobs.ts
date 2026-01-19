
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    console.log("Resetting stuck 'processing' jobs to 'pending'...");

    const { data, error } = await supabase
        .from("scrape_jobs")
        .update({ status: "pending", attempts: 0 }) // Reset attempts too so they are fresh
        .eq("status", "processing")
        .select();

    if (error) {
        console.error("Failed to reset jobs:", error);
    } else {
        console.log(`Successfully reset ${data?.length || 0} jobs.`);
    }
}

main();
