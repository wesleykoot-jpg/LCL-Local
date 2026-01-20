
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const migrationFile = "supabase/migrations/20260121000000_data_first_pipeline.sql";
  console.log(`Reading migration file: ${migrationFile}`);
  
  let sql;
  try {
    sql = await Deno.readTextFile(migrationFile);
  } catch (e) {
    console.error(`Failed to read file: ${e.message}`);
    Deno.exit(1);
  }

  console.log("Applying migration to database...\n");
  
  // Try to use exec_sql RPC if it exists
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  
  if (error) {
      console.log("⚠️  Could not apply migration via RPC:", error.message);
      console.log("\n📋 Manual steps required:");
      console.log("1. Open Supabase Dashboard SQL Editor");
      console.log("2. Copy and paste the content from:");
      console.log(`   ${migrationFile}`);
      console.log("3. Run the SQL in the editor");
      console.log("\nOr if you have Supabase CLI installed:");
      console.log("   supabase db push");
      Deno.exit(1);
  } else {
      console.log("✅ Migration applied successfully!");
      console.log("\nVerifying scraper_insights table exists...");
      
      // Verify the table was created
      const { data: tableCheck, error: tableError } = await supabase
        .from('scraper_insights')
        .select('id')
        .limit(1);
      
      if (tableError && tableError.code === 'PGRST116') {
        console.log("❌ Table still doesn't exist. Migration may have failed.");
      } else {
        console.log("✅ scraper_insights table verified!");
        console.log("\nYou can now run the scraper:");
        console.log("   deno run --allow-env --allow-net scripts/trigger_scrape_coordinator.ts");
      }
  }
}

main();
