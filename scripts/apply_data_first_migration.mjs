import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read .env file manually
const envContent = readFileSync(join(__dirname, '../.env'), 'utf8');
const envLines = envContent.split('\n');
const env = {};
envLines.forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    let value = match[2].trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value;
  }
});

const SUPABASE_URL = env['VITE_SUPABASE_URL'];
const SUPABASE_SERVICE_ROLE_KEY = env['SUPABASE_SERVICE_ROLE_KEY'];

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

console.log(`📦 Supabase URL: ${SUPABASE_URL}`);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const migrationFile = join(__dirname, '../supabase/migrations/20260121000000_data_first_pipeline.sql');
  console.log(`📄 Reading migration file: ${migrationFile}\n`);
  
  let sql;
  try {
    sql = readFileSync(migrationFile, 'utf8');
    console.log(`✅ Migration file loaded (${sql.length} bytes)\n`);
  } catch (e) {
    console.error(`❌ Failed to read file: ${e.message}`);
    process.exit(1);
  }

  console.log("🔧 Attempting to apply migration via exec_sql RPC...\n");
  
  // Try to use exec_sql RPC if it exists
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  
  if (error) {
      console.log("⚠️  exec_sql RPC not available or failed:", error.message);
      console.log("\n📋 Manual steps required:");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("1. Open Supabase Dashboard SQL Editor:");
      console.log(`   ${SUPABASE_URL.replace('/rest', '')}/project/_/sql`);
      console.log("\n2. Copy and paste the content from:");
      console.log(`   supabase/migrations/20260121000000_data_first_pipeline.sql`);
      console.log("\n3. Click 'Run' to execute the migration");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
      
      // Let's also try to check if we can at least verify the table doesn't exist
      console.log("🔍 Checking current state of scraper_insights table...");
      const { error: checkError } = await supabase
        .from('scraper_insights')
        .select('id')
        .limit(1);
      
      if (checkError && checkError.code === 'PGRST116') {
        console.log("❌ Confirmed: scraper_insights table does not exist yet\n");
      } else if (checkError) {
        console.log(`⚠️  Check failed: ${checkError.message}\n`);
      } else {
        console.log("✅ Table already exists! Migration may have been applied previously.\n");
      }
      
      process.exit(1);
  } else {
      console.log("✅ Migration applied successfully!");
      console.log("\n🔍 Verifying scraper_insights table exists...");
      
      // Verify the table was created
      const { data: tableCheck, error: tableError } = await supabase
        .from('scraper_insights')
        .select('id')
        .limit(1);
      
      if (tableError && tableError.code === 'PGRST116') {
        console.log("❌ Table still doesn't exist. Migration may have failed.");
        process.exit(1);
      } else {
        console.log("✅ scraper_insights table verified!\n");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("🚀 Next Steps:");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("1. Run the scraper coordinator:");
        console.log("   node scripts/trigger_coordinator.mjs");
        console.log("\n2. Query insights after scraping completes:");
        console.log("   node scripts/query_scraper_insights.mjs");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
      }
  }
}

main().catch(error => {
  console.error("❌ Unexpected error:", error);
  process.exit(1);
});
