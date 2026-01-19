
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import * as cheerio from "npm:cheerio@1.0.0-rc.12";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    // 1. Pick a source that was recently scraped (even if 0 events)
    const { data: job } = await supabase
        .from("scrape_jobs")
        .select("source_id")
        .eq("status", "completed")
        .gt("events_scraped", 0) // Pick one that actually found something
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();
        
    if (!job) {
        console.log("No completed jobs with scraped > 0 found. Searching all sources...");
    }
    
    const sourceId = job?.source_id || "d4038737-6bf7-43ca-870e-034ceba85cad"; // Default fallback
    
    console.log(`Debugging Source ID: ${sourceId}`);
    
    const { data: source } = await supabase
        .from("scraper_sources")
        .select("*")
        .eq("id", sourceId)
        .single();
        
    if (!source) {
        console.error("Source not found!");
        return;
    }
    
    console.log(`Source: ${source.name} (${source.url})`);
    
    // 2. Mock Fetch & Parse (Simplified Generic Logic)
    console.log("Fetching URL...");
    const res = await fetch(source.url);
    const html = await res.text();
    console.log(`Fetched ${html.length} bytes.`);
    
    const $ = cheerio.load(html);
    const text = $("body").text().slice(0, 500).replace(/\s+/g, " ");
    console.log(`Preview: ${text}...`);
    
    // 3. Regex Heuristics (Just to see if we spot dates)
    const yearRegex = /202[4-7]/g;
    const yearsFound = html.match(yearRegex);
    console.log("Years found in HTML:", yearsFound ? yearsFound.slice(0, 10) : "None");
    
    // 4. Check Strategy (Not full implementation, but checking headers/selectors)
    if (source.config?.selectors) {
        console.log("Selectors:", source.config.selectors);
        // Try to find selector matches
        // (Assuming selectors is array of strings)
        // Adjust based on actaul config shape
    }
    
    console.log("Done.");
}

main();
