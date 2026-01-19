import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { config } from "https://deno.land/std@0.168.0/dotenv/mod.ts";
config({ export: true, safe: false });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    console.log("Checking job statuses...");
    
    // Get counts by status
    const { data, error } = await supabase
        .from("scrape_jobs")
        .select("status, id");
        
    if (error) {
        console.error("Error fetching jobs:", error);
        return;
    }

    const stats = data.reduce((acc, job) => {
        acc[job.status] = (acc[job.status] || 0) + 1;
        return acc;
    }, {});

    console.log("Job Status Counts:", stats);

    // Get details of failed jobs
    const failedJobs = await supabase
        .from("scrape_jobs")
        .select("*")
        .eq("status", "failed")
        .limit(5);

    if (failedJobs.data && failedJobs.data.length > 0) {
        console.log("Sample Failed Jobs:", JSON.stringify(failedJobs.data, null, 2));
    }
    
     // Get details of completed jobs
    const completedJobs = await supabase
        .from("scrape_jobs")
        .select("*")
        .eq("status", "completed")
        .order("updated_at", { ascending: false })
        .limit(5);

    if (completedJobs.data && completedJobs.data.length > 0) {
        console.log("Sample Completed Jobs:", JSON.stringify(completedJobs.data, null, 2));
    }
}

main();
