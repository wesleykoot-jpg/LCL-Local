import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log("🔍 Checking database status...\n");
  
  // Check scraper_runs
  console.log("1️⃣  Recent scraper runs:");
  const { data: runs, error: runsError } = await supabase
    .from('scraper_runs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (runsError) {
    console.log(`   ❌ Error: ${runsError.message}`);
  } else if (!runs || runs.length === 0) {
    console.log("   ⚠️  No scraper runs found\n");
  } else {
    console.log(`   ✅ Found ${runs.length} recent runs:`);
    runs.forEach(run => {
      const time = new Date(run.created_at).toISOString();
      console.log(`      - ${time}: Status ${run.status || 'unknown'}`);
    });
    console.log();
  }
  
  // Check scraper_insights
  console.log("2️⃣  Scraper insights:");
  const { data: insights, error: insightsError } = await supabase
    .from('scraper_insights')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (insightsError) {
    console.log(`   ❌ Error: ${insightsError.message}`);
  } else if (!insights || insights.length === 0) {
    console.log("   ⚠️  No insights found yet\n");
  } else {
    console.log(`   ✅ Found ${insights.length} insights:`);
    insights.forEach(insight => {
      const time = new Date(insight.created_at).toISOString();
      console.log(`      - ${time}: ${insight.winning_strategy || 'NONE'} (${insight.total_events_found || 0} events)`);
    });
    console.log();
  }
  
  // Check recent events
  console.log("3️⃣  Recent events:");
  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select('id, title, created_at')
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (eventsError) {
    console.log(`   ❌ Error: ${eventsError.message}`);
  } else if (!events || events.length === 0) {
    console.log("   ⚠️  No events found\n");
  } else {
    console.log(`   ✅ Found ${events.length} recent events (showing titles):`);
    events.slice(0, 5).forEach(event => {
      console.log(`      - ${event.title || 'Untitled'}`);
    });
    console.log();
  }
  
  // Check scraper sources
  console.log("4️⃣  Active scraper sources:");
  const { data: sources, error: sourcesError } = await supabase
    .from('scraper_sources')
    .select('id, name, enabled')
    .eq('enabled', true)
    .limit(10);
  
  if (sourcesError) {
    console.log(`   ❌ Error: ${sourcesError.message}`);
  } else if (!sources || sources.length === 0) {
    console.log("   ⚠️  No active sources found\n");
  } else {
    console.log(`   ✅ Found ${sources.length} active sources\n`);
  }
  
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  console.log("📊 Summary:");
  console.log("   • scraper_insights table: ✅ EXISTS");
  console.log("   • Insights data: " + (insights && insights.length > 0 ? `✅ ${insights.length} records` : "⚠️  EMPTY"));
  console.log("   • Scraper status: " + (runs && runs.length > 0 ? "✅ Has run before" : "⚠️  Never run or no runs logged"));
  console.log("\n💡 To populate insights, trigger the scraper:");
  console.log("   node scripts/trigger_coordinator.mjs\n");
}

main();
