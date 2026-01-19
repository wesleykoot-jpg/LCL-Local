
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import * as fs from "node:fs/promises";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const migrationFile = "supabase/migrations/20260120100000_fix_enqueue_ambiguity.sql";
  console.log(`Reading migration file: ${migrationFile}`);
  
  let sql;
  try {
    sql = await Deno.readTextFile(migrationFile);
  } catch (e) {
    console.error(`Failed to read file: ${e.message}`);
    Deno.exit(1);
  }

  console.log("Applying migration via postgres function (if available) or raw SQL...");
  
  // Try to use a simpler method if 'postgres' isn't available. 
  // Supabase-js doesn't support raw SQL execution on the public interface usually, unless there is a function for it.
  // BUT the user provided the service key, which might have admin rights.
  // Actually, standard supabase-js client cannot execute raw SQL.
  // We need to use valid RPC or REST. 
  // Since we don't have a direct SQL runner, we might need to rely on the user or the CLI?
  //
  // WAIT - The diagnostic script worked fine, so Deno is working.
  // The user gave me the key. I can use the 'exec_sql' RPC if it exists (often added in these setups).
  // If not, I am stuck and must ask the user to run `supabase db reset` or similar.
  // Let's check if there is an `exec_sql` or similar RPC.
  
  // Let's TRY to see if we can use the `pg` driver directly? 
  // Deno doesn't support `pg` natively without import mapping.
  // Let's assume there's a helper or we check for `exec_sql`.

  // Let's try to define a temporary function? No, can't create function without SQL access.
  // 
  // LET'S LOOK AT `apply_scraper_migration.cjs` content in a different way or assume I can use `node` with `pg`?
  // I will try to read the file again using `read_terminal` or `grep` just to see if I am crazy?
  // No, let's just create a test script that tries to call `exec_sql`.
  
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  
  if (error) {
      console.log("Attempt 1 (exec_sql) failed:", error.message);
      // Fallback: This project seems to use `postgres` npm package in some scripts?
      // Let's try to use the REST API to POST to v1/query? No that's not standard.
      
      console.log("Cannot apply migration directly via supabase-js without an SQL executing RPC.");
      console.log("Please run the following command in your terminal:");
      console.log(`supabase db reset --db-url <your-connection-string>`);
      console.log("OR copy the content of supabase/migrations/20260120100000_fix_enqueue_ambiguity.sql to the Supabase Dashboard SQL Editor.");
  } else {
      console.log("✅ Migration applied successfully!");
  }
}

// Check for exec_sql helper
// Often added in dev templates
// CREATE OR REPLACE FUNCTION exec_sql(sql_query text) RETURNS void AS $$ BEGIN EXECUTE sql_query; END; $$ LANGUAGE plpgsql SECURITY DEFINER;

main();
