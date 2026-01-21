
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    console.log("Checking sources...");
    const { data, error } = await supabase.from('scraper_sources').select('id, name, enabled, url');
    if (error) {
        console.error("Error fetching sources:", error);
    } else {
        console.table(data);
        if (data && data.length > 0) {
            // Check if any enabled
            const enabled = data.filter(s => s.enabled);
            console.log(`Enabled: ${enabled.length}, Disabled: ${data.length - enabled.length}`);
            
            if (enabled.length === 0) {
                console.log("Enabling all sources...");
                await supabase.from('scraper_sources').update({ enabled: true }).neq('id', '00000000-0000-0000-0000-000000000000');
                console.log("Sources enabled.");
            }
        } else {
            console.log("No sources found in table!");
        }
    }
}

main();
