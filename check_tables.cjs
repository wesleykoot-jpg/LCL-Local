const https = require('https');
const fs = require('fs');

// Parse .env
const envContent = fs.readFileSync('.env', 'utf8');
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

const supabaseUrl = env['VITE_SUPABASE_URL'];
const serviceRoleKey = env['SUPABASE_SERVICE_ROLE_KEY'];

async function checkTable(tableName) {
  return new Promise((resolve) => {
    const url = `${supabaseUrl}/rest/v1/${tableName}?limit=1`;
    https.get(url, {
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
      }
    }, (res) => {
      resolve(res.statusCode === 200);
    }).on('error', () => resolve(false));
  });
}

async function main() {
  console.log('🔍 Checking database tables...\n');
  
  const tables = [
    'scraper_sources',
    'scraper_insights',
    'events',
    'scraper_runs',
    'scrape_jobs'
  ];
  
  for (const table of tables) {
    const exists = await checkTable(table);
    console.log(`${exists ? '✅' : '❌'} ${table}`);
  }
  
  console.log('\n💡 The scraper_insights table needs to be created via migration.');
  console.log('Migration file: supabase/migrations/20260121000000_data_first_pipeline.sql');
}

main();
