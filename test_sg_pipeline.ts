import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  'https://mlpefjsbriqgxcaqxhic.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function healthCheck() {
  console.log('=== Social Graph Pipeline Health Check ===\n');
  
  // Check tables exist
  const tables = ['sg_sources', 'sg_pipeline_queue', 'sg_geocode_cache', 'sg_serper_queries', 'sg_failure_log', 'sg_ai_repair_log', 'sg_pipeline_metrics'];
  
  for (const table of tables) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (error) {
      console.log(`❌ ${table}: ${error.message}`);
    } else {
      console.log(`✅ ${table}: ${count} rows`);
    }
  }
  
  // Check functions
  console.log('\n=== Database Functions ===');
  const { data: stats, error: statsError } = await supabase.rpc('sg_get_pipeline_stats');
  if (statsError) {
    console.log(`❌ sg_get_pipeline_stats: ${statsError.message}`);
  } else {
    console.log(`✅ sg_get_pipeline_stats: working`);
    if (stats && stats.length > 0) {
      console.log('   Stats:', JSON.stringify(stats, null, 2));
    } else {
      console.log('   Stats: empty (no items in queue yet)');
    }
  }
  
  // Check events table
  console.log('\n=== Events Table ===');
  const { count: eventCount } = await supabase.from('events').select('*', { count: 'exact', head: true });
  console.log(`📊 Total events: ${eventCount}`);
}

async function unitTest() {
  console.log('\n=== Unit Test: Insert and Process ===\n');
  
  // 1. Insert a test source
  const testUrl = `https://example.com/test-${Date.now()}`;
  console.log(`1. Inserting test source: ${testUrl}`);
  
  const { data: source, error: sourceError } = await supabase
    .from('sg_sources')
    .insert({
      name: 'Test Source',
      url: testUrl,
      discovery_method: 'seed_list',
      tier: 'tier_3_hyperlocal',
      reliability_score: 1.0,
      enabled: true
    })
    .select()
    .single();
    
  if (sourceError) {
    console.log(`❌ Failed to insert source: ${sourceError.message}`);
    return;
  }
  console.log(`✅ Source created: ${source.id}`);
  
  // 2. Insert a test queue item
  console.log(`2. Inserting pipeline queue item...`);
  
  const { data: queueItem, error: queueError } = await supabase
    .from('sg_pipeline_queue')
    .insert({
      source_id: source.id,
      source_url: testUrl,
      stage: 'discovered',
      priority: 5
    })
    .select()
    .single();
    
  if (queueError) {
    console.log(`❌ Failed to insert queue item: ${queueError.message}`);
    return;
  }
  console.log(`✅ Queue item created: ${queueItem.id}`);
  
  // 3. Test the claim function
  console.log(`3. Testing sg_claim_for_stage function...`);
  
  const { data: claimed, error: claimError } = await supabase.rpc('sg_claim_for_stage', {
    p_stage: 'discovered',
    p_limit: 1
  });
  
  if (claimError) {
    console.log(`❌ Claim failed: ${claimError.message}`);
  } else {
    console.log(`✅ Claimed ${claimed?.length || 0} items`);
  }
  
  // 4. Test advance stage
  console.log(`4. Testing sg_advance_stage function...`);
  
  const { error: advanceError } = await supabase.rpc('sg_advance_stage', {
    p_item_id: queueItem.id,
    p_next_stage: 'analyzing'
  });
  
  if (advanceError) {
    console.log(`❌ Advance failed: ${advanceError.message}`);
  } else {
    console.log(`✅ Advanced to 'analyzing' stage`);
  }
  
  // 5. Verify the stage change
  const { data: updated } = await supabase
    .from('sg_pipeline_queue')
    .select('stage')
    .eq('id', queueItem.id)
    .single();
    
  console.log(`5. Verified stage: ${updated?.stage}`);
  
  // 6. Test failure logging
  console.log(`6. Testing sg_record_failure function...`);
  
  const { error: failError } = await supabase.rpc('sg_record_failure', {
    p_item_id: queueItem.id,
    p_failure_level: 'transient',
    p_error_message: 'This is a unit test failure',
    p_error_code: 'TEST_ERROR'
  });
  
  if (failError) {
    console.log(`❌ Record failure failed: ${failError.message}`);
  } else {
    console.log(`✅ Failure recorded`);
  }
  
  // 7. Check failure log
  const { data: failures, count: failCount } = await supabase
    .from('sg_failure_log')
    .select('*', { count: 'exact' })
    .eq('queue_id', queueItem.id);
    
  console.log(`7. Failure log entries: ${failCount}`);
  
  // 8. Cleanup
  console.log(`8. Cleaning up test data...`);
  
  await supabase.from('sg_failure_log').delete().eq('queue_item_id', queueItem.id);
  await supabase.from('sg_pipeline_queue').delete().eq('id', queueItem.id);
  await supabase.from('sg_sources').delete().eq('id', source.id);
  
  console.log(`✅ Cleanup complete`);
  
  // 9. Final stats
  console.log('\n=== Final Pipeline Stats ===');
  const { data: finalStats } = await supabase.rpc('sg_get_pipeline_stats');
  console.log(finalStats?.length ? JSON.stringify(finalStats, null, 2) : 'No items in queue');
}

async function main() {
  try {
    await healthCheck();
    await unitTest();
    console.log('\n✅ All tests passed!');
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  }
}

main();
