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
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

console.log(`Using Supabase URL: ${SUPABASE_URL}`);
console.log(`Using Service Role Key: ${SUPABASE_SERVICE_ROLE_KEY.slice(0, 15)}...`);

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/scrape-coordinator`;

async function main() {
  console.log(`\n🚀 Triggering Scrape Coordinator at ${FUNCTION_URL}...`);
  
  try {
    const response = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ triggerWorker: true })
    });
    
    console.log(`\n📡 Response Status: ${response.status} ${response.statusText}`);
    
    const text = await response.text();
    
    let data;
    try {
      data = JSON.parse(text);
      console.log("📦 Response:", JSON.stringify(data, null, 2));
    } catch {
      console.log("📦 Response (text):", text);
    }
    
    if (!response.ok) {
      console.error(`\n❌ Request failed with status ${response.status}`);
      process.exit(1);
    }
    
    console.log("\n✅ Scraper triggered successfully!");
    console.log("\n💡 Wait 30-60 seconds, then query insights:");
    console.log("   node scripts/query_scraper_insights.mjs\n");
    
  } catch (e) {
    console.error("\n❌ Failed to trigger coordinator:", e.message);
    process.exit(1);
  }
}

main();
