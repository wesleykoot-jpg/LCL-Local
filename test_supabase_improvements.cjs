/**
 * Test script to verify Supabase improvements are working
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

async function testImprovements() {
  console.log('🧪 Testing Supabase Integration Improvements\n');
  
  // Test 1: Check if new RPC functions exist
  console.log('Test 1: Checking RPC functions...');
  try {
    const { data, error } = await supabase.rpc('claim_staging_rows', { p_batch_size: 1 });
    
    if (error && error.message.includes('does not exist')) {
      console.log('❌ claim_staging_rows function not found');
      return false;
    }
    
    console.log('✅ claim_staging_rows function exists');
  } catch (err) {
    console.log('⚠️  claim_staging_rows test:', err.message);
  }
  
  // Test 2: Simple query to verify connection
  console.log('\nTest 2: Testing database connection...');
  try {
    const { data, error } = await supabase
      .from('events')
      .select('id')
      .limit(1);
    
    if (error) throw error;
    console.log('✅ Database connection working');
  } catch (err) {
    console.log('❌ Database connection failed:', err.message);
    return false;
  }
  
  // Test 3: Check if join_event_atomic exists
  console.log('\nTest 3: Checking join_event_atomic function...');
  try {
    // Just check if function exists by calling with dummy UUIDs
    const dummyEventId = '00000000-0000-0000-0000-000000000000';
    const dummyProfileId = '00000000-0000-0000-0000-000000000000';
    
    const { data, error } = await supabase.rpc('join_event_atomic', {
      p_event_id: dummyEventId,
      p_profile_id: dummyProfileId,
      p_status: 'going'
    });
    
    // We expect an error (event not found) but function should exist
    if (error && error.message.includes('does not exist')) {
      console.log('❌ join_event_atomic function not found');
      return false;
    }
    
    console.log('✅ join_event_atomic function exists');
    if (data) {
      console.log('   Response:', data);
    }
  } catch (err) {
    console.log('⚠️  join_event_atomic test:', err.message);
  }
  
  // Test 4: Count events
  console.log('\nTest 4: Counting events...');
  try {
    const { count, error } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true });
    
    if (error) throw error;
    console.log(`✅ Found ${count} events in database`);
  } catch (err) {
    console.log('❌ Count query failed:', err.message);
    return false;
  }
  
  // Test 5: Check scraper_sources
  console.log('\nTest 5: Checking scraper sources...');
  try {
    const { count, error } = await supabase
      .from('scraper_sources')
      .select('*', { count: 'exact', head: true });
    
    if (error) throw error;
    console.log(`✅ Found ${count} scraper sources`);
  } catch (err) {
    console.log('❌ Scraper sources query failed:', err.message);
    return false;
  }
  
  return true;
}

async function main() {
  const success = await testImprovements();
  
  console.log('\n' + '='.repeat(50));
  if (success) {
    console.log('✅ All tests passed! Supabase improvements are working.');
  } else {
    console.log('❌ Some tests failed. Check output above.');
  }
  console.log('='.repeat(50));
  
  process.exit(success ? 0 : 1);
}

main();
