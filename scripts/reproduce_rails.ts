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

async function verifyDiscoveryRails() {
  console.log('--- Verifying Discovery Rails RPC (Post-Fix) ---');
  
  const testUserId = '00000000-0000-0000-0000-000000000000'; // Anonymous fallback
  const testLocation = { lat: 53.2194, lng: 6.5665 }; 
  const radiusKm = 25;

  console.log(`Calling RPC with location: ${JSON.stringify(testLocation)}, Radius: ${radiusKm}km`);
  
  try {
      const { data: dataWithLoc, error: errorWithLoc } = await supabase.rpc('get_discovery_rails', {
        p_user_id: testUserId,
        p_user_lat: testLocation.lat,
        p_user_long: testLocation.lng,
        p_radius_km: radiusKm,
        p_limit_per_rail: 5
      });
      
      if (errorWithLoc) {
        console.error('❌ Error with location:', errorWithLoc.message);
        process.exit(1);
      } else {
        const sections = dataWithLoc?.sections || [];
        console.log(`✅ Rails found: ${sections.length}`);
        
        if (sections.length === 0) {
            console.log('WARN: No sections returned! (RPC works but no content)');
        } else {
            sections.forEach((s: any) => {
              console.log(`  - Rail: "${s.title}" (${s.items?.length || 0} items)`);
              if (s.items?.length > 0) {
                  console.log(`    First item: ${s.items[0].title}`);
              }
            });
        }
      }
  } catch (e) {
      console.error('Exception calling RPC:', e);
      process.exit(1);
  }
}

verifyDiscoveryRails();
