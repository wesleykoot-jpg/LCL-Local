const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// User provided:
const password = 'haznuq-jusmu2-fogvAb'; 
const connectionString = `postgresql://postgres.mlpefjsbriqgxcaqxhic:${password}@aws-1-eu-west-1.pooler.supabase.com:6543/postgres`;

// Configure pool with SSL (required for remote Supabase)
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function deploy() {
  console.log('--- Deploying Discovery Rails Fix to REMOTE Database ---');
  console.log('Target:', connectionString.replace(password, '****'));

  const migrationPath = path.join(__dirname, '../supabase/migrations/20260121160000_get_discovery_rails.sql');
  if (!fs.existsSync(migrationPath)) {
      console.error('Migration file not found!');
      process.exit(1);
  }
  const sql = fs.readFileSync(migrationPath, 'utf8');

  const client = await pool.connect();
  try {
    console.log('Executing SQL (Deploying V1 and V2)...');
    
    // Deploy V1 (get_discovery_rails)
    await client.query('DROP FUNCTION IF EXISTS public.get_discovery_rails');
    await client.query(sql);

    // Deploy V2 (get_discovery_rails_v2)
    const v2Sql = sql.replace(/FUNCTION public\.get_discovery_rails\(/g, 'FUNCTION public.get_discovery_rails_v2(')
                     .replace(/COMMENT ON FUNCTION public\.get_discovery_rails/g, 'COMMENT ON FUNCTION public.get_discovery_rails_v2');

    await client.query('DROP FUNCTION IF EXISTS public.get_discovery_rails_v2');
    await client.query(v2Sql);
    
    // Force PostgREST schema cache reload
    await client.query("NOTIFY pgrst, 'reload schema'");
    
    console.log('✅ SQL for V1 and V2 executed successfully + Schema Cache Reloaded!');

    // VERIFY SOURCE (V1)
    console.log('--- Verifying V1 Source in DB ---');
    const res1 = await client.query("SELECT prosrc FROM pg_proc WHERE proname = 'get_discovery_rails'");
    if (res1.rows.length > 0) {
        if (res1.rows[0].prosrc.includes('FROM (') && res1.rows[0].prosrc.includes(') e')) {
            console.log('✅ V1 Source contains NEW subquery logic!');
        } else {
            console.error('❌ V1 Source still contains OLD logic!');
        }
    }

    // VERIFY SOURCE (V2)
    console.log('--- Verifying V2 Source in DB ---');
    const res2 = await client.query("SELECT prosrc FROM pg_proc WHERE proname = 'get_discovery_rails_v2'");
    if (res2.rows.length > 0) {
        if (res2.rows[0].prosrc.includes('FROM (') && res2.rows[0].prosrc.includes(') e')) {
            console.log('✅ V2 Source contains NEW subquery logic!');
        } else {
            console.error('❌ V2 Source still contains OLD logic!');
        }
    }

  } catch (err) {
    console.error('❌ SQL execution failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

deploy();
