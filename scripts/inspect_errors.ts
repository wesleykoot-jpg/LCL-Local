
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    console.log("🚨 Recet Errors...");
    const { data: errors, error: logsError } = await supabase
        .from("error_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
        
    if (logsError) console.error(logsError);
    else console.table(errors?.map(e => ({ 
        source: e.source, 
        msg: e.message?.slice(0, 60), 
        created: new Date(e.created_at).toLocaleTimeString() 
    })));

    console.log("\n📊 Source Stats (Last Scraped)...");
    const { data: sources, error: sourcesError } = await supabase
        .from("scraper_sources")
        .select("name, total_events_scraped, last_scraped_at, last_error, consecutive_failures")
        .order("last_scraped_at", { ascending: false })
        .limit(10);

    if (sourcesError) console.error(sourcesError);
    else console.table(sources?.map(s => ({
        name: s.name,
        total: s.total_events_scraped,
        last_scraped: s.last_scraped_at ? new Date(s.last_scraped_at).toLocaleTimeString() : "Never",
        last_err: s.last_error ? s.last_error.slice(0, 30) : "None",
        fails: s.consecutive_failures
    })));
}

main();
