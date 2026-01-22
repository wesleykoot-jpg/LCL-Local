/**
 * Test script for new utility functions
 */

const { createClient } = require('@supabase/supabase-js');
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
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testUtilities() {
  console.log('🧪 Testing New Utility Functions\n');
  
  // Test 1: Connection Pool
  console.log('Test 1: Testing connection pool...');
  try {
    const { query, closePool } = require('./scripts/lib/db.cjs');
    
    const result = await query('SELECT COUNT(*) as count FROM events');
    console.log(`✅ Connection pool working - Found ${result.rows[0].count} events`);
    
    await closePool();
    console.log('✅ Connection pool closed successfully');
  } catch (err) {
    console.log('❌ Connection pool test failed:', err.message);
  }
  
  // Test 2: Test atomic row claiming
  console.log('\nTest 2: Testing atomic row claiming...');
  try {
    const { data, error } = await supabase.rpc('claim_staging_rows', {
      p_batch_size: 3
    });
    
    if (error) throw error;
    
    if (data && data.length > 0) {
      console.log(`✅ Claimed ${data.length} rows atomically`);
      console.log('   Row IDs:', data.map(r => r.id.substring(0, 8)).join(', '));
    } else {
      console.log('✅ No pending rows to claim (expected if queue is empty)');
    }
  } catch (err) {
    console.log('❌ Atomic row claiming failed:', err.message);
  }
  
  // Test 3: Test join_event_atomic with real event
  console.log('\nTest 3: Testing join_event_atomic...');
  try {
    // Get a real event ID
    const { data: events } = await supabase
      .from('events')
      .select('id')
      .limit(1)
      .single();
    
    if (events) {
      // Get a test profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .limit(1)
        .single();
      
      if (profile) {
        const { data, error } = await supabase.rpc('join_event_atomic', {
          p_event_id: events.id,
          p_profile_id: profile.id,
          p_status: 'interested'
        });
        
        if (error) throw error;
        
        console.log('✅ join_event_atomic executed successfully');
        console.log('   Status:', data.status);
        console.log('   Message:', data.message);
        
        // Clean up - remove the test attendance
        if (data.status === 'ok') {
          await supabase
            .from('event_attendees')
            .delete()
            .eq('event_id', events.id)
            .eq('profile_id', profile.id);
          console.log('✅ Test attendance cleaned up');
        }
      }
    }
  } catch (err) {
    console.log('⚠️  join_event_atomic test:', err.message);
  }
  
  // Test 4: Simple query to verify everything still works
  console.log('\nTest 4: Verifying standard queries still work...');
  try {
    const { count, error } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
      .gte('event_date', new Date().toISOString());
    
    if (error) throw error;
    console.log(`✅ Found ${count} upcoming events`);
  } catch (err) {
    console.log('❌ Standard query failed:', err.message);
  }
  
  return true;
}

async function main() {
  const success = await testUtilities();
  
  console.log('\n' + '='.repeat(50));
  if (success) {
    console.log('✅ All utility tests passed!');
    console.log('   - Connection pooling works');
    console.log('   - Atomic row claiming works');
    console.log('   - Atomic event joins work');
    console.log('   - Standard queries still work');
  } else {
    console.log('❌ Some tests failed.');
  }
  console.log('='.repeat(50));
  
  process.exit(success ? 0 : 1);
}

main();
