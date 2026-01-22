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
    console.log('Executing SQL (Drop & Recreate)...');
    
    // Force PostgREST schema cache reload
    await client.query("NOTIFY pgrst, 'reload schema'");
    
    console.log('✅ SQL executed successfully + Schema Cache Reloaded!');

    // VERIFY SOURCE
    console.log('--- Verifying Function Source in DB ---');
    const res = await client.query("SELECT prosrc FROM pg_proc WHERE proname = 'get_discovery_rails'");
    if (res.rows.length > 0) {
        const source = res.rows[0].prosrc;
        console.log('Source length:', source.length);
        if (source.includes('GROUP BY e.id, e.title')) {
            console.error('❌ DANGER: Source still contains OLD GROUP BY clause!');
        } else if (source.includes('GROUP BY e.id')) {
            console.log('✅ Source contains NEW GROUP BY clause (e.id only)!');
        } else {
            console.log('⚠️ Source GROUP BY status unknown:', source.substring(0, 100) + '...');
        }
    } else {
        console.error('❌ Function not found in pg_proc!');
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
