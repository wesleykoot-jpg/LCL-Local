
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { config } from "https://deno.land/std@0.168.0/dotenv/mod.ts";
config({ export: true, safe: false, allowEmptyValues: true });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing supabase credentials");
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    console.log("Fetching recent error logs...");
    const { data, error } = await supabase
        .from("error_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);

    if (error) {
        console.error("Error fetching logs:", error);
        return;
    }

    if (data.length === 0) {
        console.log("No error logs found.");
    } else {
        console.log(`Found ${data.length} logs:`);
        data.forEach(log => {
            console.log(`[${log.created_at}] [${log.level}] ${log.function_name}: ${log.message}`);
        });
    }
}

main();
