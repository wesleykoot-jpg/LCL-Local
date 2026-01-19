
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") || Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    console.log("Applying automation migration...");
    
    // Read the SQL file
    const sql = await Deno.readTextFile("supabase/migrations/20260120120000_automate_pipeline.sql");
    
    // Split into statements approximately (simple split by ;)
    // WARNING: This is a hacky way to run migrations via JS client.
    // Ideally use supabase cli `supabase db push` or `supabase migration up`.
    // But we are in a container/environment where we might not have CLI configured for remote.
    // Actually, `supabase-js` doesn't support running raw SQL strings easily unless we have a function for it.
    
    // We can try to use `postgres` npm package or just use an RPC if available?
    // Usually we can't run DDL via PostgREST.
    
    console.log("Checking if we can run SQL...");
    
    // Best bet: Use the `install_extensions_rpc.ts` pattern if we have an RPC for exec sql.
    // Or check if we can using `supabase db reset`? No, that deletes data.
    
    // User wants "automated" which usually means the platform manages it.
    // If I can't run the migration, I must instruct the user to run it.
    // But I can try to see if `exec_sql` RPC exists (common pattern in some setups).
    
    const { error } = await supabase.rpc("exec_sql", { sql_query: "SELECT 1" });
    if (error && error.message.includes("function exec_sql") && error.message.includes("does not exist")) {
        console.error("❌ Cannot run raw SQL via RPC (exec_sql missing).");
        console.log("Please run the following command in your terminal to apply the automation migration:");
        console.log("\n    supabase migration up\n");
        console.log("Or apply 'supabase/migrations/20260120120000_automate_pipeline.sql' manually in the Supabase Dashboard SQL Editor.");
    } else {
        console.log("✅ exec_sql RPC exists! Applying migration...");
        const { error: migError } = await supabase.rpc("exec_sql", { sql_query: sql });
        if (migError) {
             console.error("❌ Migration failed:", migError);
        } else {
             console.log("✅ Migration applied successfully!");
        }
    }
}

main();
