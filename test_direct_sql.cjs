/**
 * Direct SQL test to check if RPC functions exist
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Manually load .env file
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    let value = match[2].trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
});

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const projectRef = new URL(supabaseUrl).hostname.split('.')[0];

const pool = new Pool({
  host: `db.${projectRef}.supabase.co`,
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: serviceRoleKey,
  ssl: { rejectUnauthorized: false },
});

async function checkFunctions() {
  console.log('🔍 Checking RPC Functions in Database\n');
  
  try {
    // Check if functions exist
    const result = await pool.query(`
      SELECT 
        routine_name,
        routine_type,
        security_type
      FROM information_schema.routines
      WHERE routine_schema = 'public'
      AND routine_name IN ('claim_staging_rows', 'join_event_atomic', 'enqueue_scrape_jobs')
      ORDER BY routine_name;
    `);
    
    console.log('Found functions:');
    if (result.rows.length === 0) {
      console.log('❌ No functions found!');
    } else {
      result.rows.forEach(row => {
        console.log(`✅ ${row.routine_name} (${row.routine_type}, ${row.security_type})`);
      });
    }
    
    // Test claim_staging_rows
    console.log('\n🧪 Testing claim_staging_rows...');
    try {
      const claimResult = await pool.query('SELECT * FROM claim_staging_rows(1)');
      console.log(`✅ claim_staging_rows works! Returned ${claimResult.rows.length} rows`);
    } catch (err) {
      console.log('❌ claim_staging_rows failed:', err.message);
    }
    
    // Count events
    console.log('\n📊 Database stats:');
    const eventsCount = await pool.query('SELECT COUNT(*) as count FROM events');
    console.log(`   Events: ${eventsCount.rows[0].count}`);
    
    const sourcesCount = await pool.query('SELECT COUNT(*) as count FROM scraper_sources');
    console.log(`   Scraper sources: ${sourcesCount.rows[0].count}`);
    
    const stagingCount = await pool.query('SELECT COUNT(*) as count FROM raw_event_staging WHERE status = \'pending\'');
    console.log(`   Pending staging rows: ${stagingCount.rows[0].count}`);
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await pool.end();
  }
}

checkFunctions();
