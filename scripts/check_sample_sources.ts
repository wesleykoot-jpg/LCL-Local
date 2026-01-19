
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const { data: sources } = await supabase
        .from("scraper_sources")
        .select("*")
        .eq("auto_discovered", true)
        .limit(5);

    console.log(JSON.stringify(sources, null, 2));
}

main();
