import { supabase } from '../src/integrations/supabase/client.ts';

async function verifyDiscoveryRails() {
  console.log('--- Verifying Discovery Rails RPC ---');
  
  const testUserId = '00000000-0000-0000-0000-000000000000'; // Anonymous fallback test
  const testLocation = { lat: 53.2194, lng: 6.5665 }; // Groningen
  
  console.log('1. Calling RPC with location...');
  const { data: dataWithLoc, error: errorWithLoc } = await supabase.rpc('get_discovery_rails', {
    p_user_id: testUserId,
    p_user_lat: testLocation.lat,
    p_user_long: testLocation.lng,
    p_radius_km: 25,
    p_limit_per_rail: 5
  });
  
  if (errorWithLoc) {
    console.error('Error with location:', errorWithLoc.message);
  } else {
    console.log('Success with location! Rails found:', dataWithLoc?.sections?.length || 0);
    dataWithLoc?.sections?.forEach((s: any) => {
      console.log(`- Rail: "${s.title}" (${s.items?.length || 0} items)`);
    });
  }

  console.log('\n2. Calling RPC WITHOUT location (Null params)...');
  const { data: dataNoLoc, error: errorNoLoc } = await supabase.rpc('get_discovery_rails', {
    p_user_id: testUserId,
    p_user_lat: null,
    p_user_long: null,
    p_radius_km: 25,
    p_limit_per_rail: 5
  });

  if (errorNoLoc) {
    console.error('Error without location:', errorNoLoc.message);
  } else {
    console.log('Success without location! Rails found:', dataNoLoc?.sections?.length || 0);
    dataNoLoc?.sections?.forEach((s: any) => {
      console.log(`- Rail: "${s.title}" (${s.items?.length || 0} items)`);
    });
  }
}

verifyDiscoveryRails();
