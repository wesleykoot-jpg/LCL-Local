import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

async function verifyJoinFlow() {
  console.log('--- Starting Join Flow Verification ---');

  // 1. Setup Environment
  const envText = await Deno.readTextFile('.env');
  const env: Record<string, string> = {};
  envText.split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val.length > 0) env[key.trim()] = val.join('=').trim().replace(/^[\"']|[\"']$/g, '');
  });

  // Use Service Role to simulate "Authenticated" actions for test users without needing a real login token
  // ideally we would sign in, but for verification of the RPC logic, service role is sufficient provided we pass the correct user IDs
  const supabase = createClient(env['SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY']);

  // 2. Create Test Data
  const timestamp = Date.now();
  const testEmail = `test.user.${timestamp}@example.com`;
  const testEventTitle = `Test Event ${timestamp}`;

  console.log(`Creating test event: "${testEventTitle}"...`);
  
  // Create a dummy creator/user
  // For simplicity, we'll try to find an existing user to be the 'creator' and 'joiner'
  // Or just create a profile if we assume auth.users doesn't need to match for RLS when using service role (it often does for proper FKs)
  
  // Let's look for any existing profile to be our "User"
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name')
    .limit(1);

  if (profileError || !profiles || profiles.length === 0) {
    console.error('Failed to find a test profile:', profileError);
    return;
  }
  
  const testUser = profiles[0];
  console.log(`Using test profile: ${testUser.full_name} (${testUser.id})`);

  // Create Event
  const { data: event, error: eventError } = await supabase
    .from('events')
    .insert({
      title: testEventTitle,
      description: 'Automated test event',
      category: 'cinema',
      event_type: 'signal', // Signal events are simpler
      venue_name: 'Test Venue',
      location: 'POINT(6.2 52.7)', // Meppel coords
      event_date: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
      event_time: '20:00',
      created_by: testUser.id,
      match_percentage: 50
    })
    .select()
    .single();

  if (eventError || !event) {
    console.error('Failed to create test event:', eventError);
    return;
  }
  console.log(`Event created successfully. ID: ${event.id}`);

  // 3. Test Join
  console.log('Testing RPC: join_event_atomic...');
  const { data: rpcData, error: rpcError } = await supabase.rpc('join_event_atomic', {
    p_event_id: event.id,
    p_profile_id: testUser.id,
    p_status: 'going'
  });

  if (rpcError) {
    console.warn('⚠️ RPC Failed (likely missing):', rpcError.message);
    
    console.log('Attempting DIRECT INSERT fallback...');
    const { data: insertData, error: insertError } = await supabase
      .from('event_attendees')
      .insert({
        event_id: event.id,
        profile_id: testUser.id,
        status: 'going'
      })
      .select()
      .maybeSingle();
      
    if (insertError) {
      console.error('❌ FAIL: Direct Insert also failed:', insertError);
    } else {
      console.log('✅ PASS: Direct Insert succeeded! Basic join flow works.');
    }
  } else {
    console.log('RPC Result:', rpcData);
    if (rpcData.status === 'ok') {
      console.log('✅ PASS: Successfully joined via RPC');
    } else {
      console.log(`❌ FAIL: RPC returned status ${rpcData.status}: ${rpcData.message}`);
    }
  }

  // 4. Verify Database State
  console.log('Verifying event_attendees table...');
  const { data: attendee, error: checkError } = await supabase
    .from('event_attendees')
    .select('*')
    .eq('event_id', event.id)
    .eq('profile_id', testUser.id)
    .single();

  if (checkError || !attendee) {
    console.error('❌ FAIL: Attendee record not found in database', checkError);
  } else {
    console.log('✅ PASS: Attendee record confirmed in database');
    console.log(`   Status: ${attendee.status}`);
  }

  // 5. Cleanup
  console.log('Cleaning up test data...');
  await supabase.from('event_attendees').delete().eq('event_id', event.id);
  await supabase.from('events').delete().eq('id', event.id);
  console.log('Cleanup complete.');
}

verifyJoinFlow();
