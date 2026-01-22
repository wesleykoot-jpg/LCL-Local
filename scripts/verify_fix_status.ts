import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Manually load env vars
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  envConfig.split('\n').forEach((line) => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["'](.*)["']$/, '$1');
      process.env[key] = value;
    }
  });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspectAndVerify() {
  console.log('--- Inspecting DB Function Source ---');

  // Note: We can't easily query pg_proc via Data API unless 'pg_proc' is exposed or we use RPC.
  // We don't have a generic SQL RPC.
  // BUT we can try to call the function and see if the ERROR tells us meaningful info?
  // The error is 'column "e.location" must appear in the GROUP BY clause'.
  
  // Alternative: Can we infer the version?
  // If the error persists, it's 99% likely the code is old.
  // I'll try to join/invoke it.
  
  const testUserId = '00000000-0000-0000-0000-000000000000'; 
  const testLocation = { lat: 53.2194, lng: 6.5665 }; 
  
  const { error } = await supabase.rpc('get_discovery_rails', {
    p_user_id: testUserId,
    p_user_lat: testLocation.lat,
    p_user_long: testLocation.lng,
    p_radius_km: 25,
    p_limit_per_rail: 1
  });

  if (error) {
    console.error('RPC Error:', error.message);
    if (error.message.includes('GROUP BY')) {
        console.log('❌ CONFIRMED: The "GROUP BY" error is still present.');
        console.log('This indicates the database is likely still running the OLD version of the function.');
    }
  } else {
    console.log('✅ RPC Success! (The error is gone)');
  }
}

inspectAndVerify();
