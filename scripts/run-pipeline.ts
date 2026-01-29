#!/usr/bin/env npx tsx
/**
 * Waterfall Intelligence Pipeline Runner
 * 
 * Automated batch processing at 80% of rate limits.
 * 
 * Rate Limits:
 * - Nominatim: 1 req/sec (bottleneck)
 * - OpenAI: 500 RPM (~8 req/sec)
 * - Browserless: 1000+ RPM
 * 
 * Usage:
 *   npx tsx scripts/run-pipeline.ts              # Default: 10 cycles
 *   npx tsx scripts/run-pipeline.ts --cycles=20  # Custom cycles
 *   npx tsx scripts/run-pipeline.ts --discovery  # Include URL discovery
 *   npx tsx scripts/run-pipeline.ts --heal       # Force healing run
 */

import 'dotenv/config';

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Rate limits at 80%
const CURATOR_BATCH_SIZE = 5;
const CURATOR_DELAY_MS = 6250; // 5 events * 1000ms / 0.8 = 6250ms between batches
const STRATEGIST_BATCH_SIZE = 30;
const VECTORIZER_BATCH_SIZE = 20;

interface PipelineStats {
  stage: string;
  count: number;
  oldest_item: string | null;
  avg_wait_time_minutes: number;
}

interface WorkerResult {
  success: boolean;
  processed?: number;
  indexed?: number;
  enriched?: number;
  error?: string;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function callWorker(name: string, payload: Record<string, unknown> = {}): Promise<WorkerResult> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      return { success: false, error: `${response.status}: ${text.slice(0, 200)}` };
    }

    const data = await response.json();
    return {
      success: true,
      processed: data.processed || data.items_processed || 0,
      indexed: data.indexed || 0,
      enriched: data.items_enriched || data.enriched || 0,
    };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

async function getStats(): Promise<PipelineStats[]> {
  const result = await callWorker('sg-orchestrator', { mode: 'status' });
  if (!result.success) return [];
  
  // Get stats from response (need to parse differently)
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/sg-orchestrator`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ mode: 'status' }),
    });
    const data = await response.json();
    return data.pipeline_stats || [];
  } catch {
    return [];
  }
}

async function runPipeline(options: {
  cycles: number;
  discovery: boolean;
  heal: boolean;
}) {
  console.log('\n🚀 Waterfall Intelligence Pipeline Runner');
  console.log(`   Cycles: ${options.cycles}`);
  console.log(`   Discovery: ${options.discovery ? 'enabled' : 'disabled'}`);
  console.log(`   Rate: 80% of limits\n`);

  let totalProcessed = 0;
  let totalIndexed = 0;

  for (let cycle = 1; cycle <= options.cycles; cycle++) {
    console.log(`\n--- Cycle ${cycle}/${options.cycles} ---`);
    
    const stats = await getStats();
    const discovered = stats.find(s => s.stage === 'discovered')?.count || 0;
    const awaiting = stats.find(s => s.stage === 'awaiting_fetch')?.count || 0;
    const ready = stats.find(s => s.stage === 'ready_to_persist')?.count || 0;
    
    console.log(`📊 Queue: discovered=${discovered}, awaiting=${awaiting}, ready=${ready}`);

    // Stop if empty
    if (discovered === 0 && awaiting === 0 && ready === 0) {
      console.log('✅ Pipeline empty, stopping');
      break;
    }

    // Phase 1: Discovery (if enabled and needed)
    if (options.discovery && discovered < 50 && cycle === 1) {
      console.log('🔍 Running Scout (discovery)...');
      const scoutResult = await callWorker('sg-scout', { mode: 'crawl_existing', maxUrlsPerSource: 50 });
      if (scoutResult.success) {
        console.log(`   ✓ Discovered new URLs`);
      } else {
        console.log(`   ✗ Scout failed: ${scoutResult.error}`);
      }
    }

    // Phase 2: Strategist (fast, no rate limit)
    if (discovered > 0) {
      console.log('📋 Running Strategist...');
      const stratResult = await callWorker('sg-strategist', { limit: STRATEGIST_BATCH_SIZE });
      if (stratResult.success) {
        console.log(`   ✓ Analyzed ${stratResult.processed || 0} items`);
        totalProcessed += stratResult.processed || 0;
      } else {
        console.log(`   ✗ Strategist failed: ${stratResult.error}`);
      }
    }

    // Phase 3: Curator (rate limited - 1 geocode/sec)
    if (awaiting > 0) {
      console.log('🎭 Running Curator...');
      const curatorResult = await callWorker('sg-curator', { limit: CURATOR_BATCH_SIZE });
      if (curatorResult.success) {
        console.log(`   ✓ Enriched ${curatorResult.enriched || 0} events`);
        totalProcessed += curatorResult.enriched || 0;
      } else {
        console.log(`   ✗ Curator failed: ${curatorResult.error}`);
      }

      // Rate limit delay
      if (cycle < options.cycles) {
        console.log(`   ⏱️ Waiting ${CURATOR_DELAY_MS}ms for rate limit...`);
        await sleep(CURATOR_DELAY_MS);
      }
    }

    // Phase 4: Vectorizer (no external rate limit)
    if (ready > 0) {
      console.log('📊 Running Vectorizer...');
      const vecResult = await callWorker('sg-vectorizer', { limit: VECTORIZER_BATCH_SIZE });
      if (vecResult.success) {
        console.log(`   ✓ Indexed ${vecResult.indexed || 0} events`);
        totalIndexed += vecResult.indexed || 0;
      } else {
        console.log(`   ✗ Vectorizer failed: ${vecResult.error}`);
      }
    }

    // Phase 5: Healer (every 5 cycles or if forced)
    if (options.heal || cycle % 5 === 0) {
      console.log('🩺 Running Healer...');
      const healResult = await callWorker('sg-healer', { mode: 'repair', limit: 2 });
      if (healResult.success) {
        console.log(`   ✓ Healer completed`);
      }
    }
  }

  // Final stats
  console.log('\n═══════════════════════════════════════');
  console.log('📈 PIPELINE RUN COMPLETE');
  console.log(`   Total processed: ~${totalProcessed}`);
  console.log(`   Total indexed: ${totalIndexed}`);
  
  const finalStats = await getStats();
  console.log('\n📊 Final Queue Status:');
  for (const stat of finalStats) {
    console.log(`   ${stat.stage}: ${stat.count}`);
  }

  // Get event count
  const eventsResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/events?select=id`,
    {
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Prefer': 'count=exact',
      },
    }
  );
  const range = eventsResponse.headers.get('content-range');
  const eventCount = range?.split('/')[1] || 'unknown';
  console.log(`\n🎉 Total events in database: ${eventCount}`);
}

// Parse CLI args
const args = process.argv.slice(2);
const options = {
  cycles: 10,
  discovery: false,
  heal: false,
};

for (const arg of args) {
  if (arg.startsWith('--cycles=')) {
    options.cycles = parseInt(arg.split('=')[1], 10);
  } else if (arg === '--discovery') {
    options.discovery = true;
  } else if (arg === '--heal') {
    options.heal = true;
  }
}

// Validate env
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

runPipeline(options).catch(console.error);
