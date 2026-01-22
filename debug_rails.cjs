const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Manually parse .env since dotenv might not be installed
function loadEnv() {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (!fs.existsSync(envPath)) return {};
    const envContent = fs.readFileSync(envPath, 'utf8');
    const env = {};
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        let value = match[2].trim();
        if (value.startsWith('"') && value.endsWith('"')) {
            value = value.slice(1, -1);
        }
        env[match[1].trim()] = value;
      }
    });
    return env;
  } catch (e) {
    console.error('Error loading .env:', e);
    return {};
  }
}

const env = loadEnv();
const supabaseUrl = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const host = env.SUPABASE_DB_HOST;
const port = env.SUPABASE_DB_PORT_SESSION || 5432; // Default to transaction or session port
const user = env.SUPABASE_DB_USER;
const password = env.SUPABASE_DB_PASSWORD;
const database = env.SUPABASE_DB_NAME || 'postgres';

if (!host || !user || !password) {
  console.error('Missing DB credentials in .env');
  process.exit(1);
}

const client = new Client({
  host,
  port,
  database,
  user,
  password,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    await client.connect();
    console.log('Connected to Supabase Postgres\n');

    // 1. Check if events exist
    console.log('--- Checking Events Table ---');
    const eventsCount = await client.query('SELECT COUNT(*) FROM events');
    console.log(`Total events: ${eventsCount.rows[0].count}`);

    const futureEvents = await client.query("SELECT COUNT(*) FROM events WHERE event_date >= NOW()");
    console.log(`Future events: ${futureEvents.rows[0].count}`);
    
    // 2. Test get_discovery_rails RPC with NIL UUID
    console.log('\n--- Testing get_discovery_rails RPC (Anonymous) ---');
    const nilUuid = '00000000-0000-0000-0000-000000000000';
    // Use Groningen coordinates or similar default
    const lat = 53.2194; 
    const lng = 6.5665;
    
    try {
        const rpcQuery = `
            SELECT * FROM get_discovery_rails(
                p_user_id := $1,
                p_user_lat := $2,
                p_user_long := $3,
                p_radius_km := 25,
                p_limit_per_rail := 5
            );
        `;
        const res = await client.query(rpcQuery, [nilUuid, lat, lng]);
        
        console.log('RPC Call Success!');
        if (res.rows.length === 0) {
            console.log('RPC returned NO rows.');
        } else {
            const data = res.rows[0];
            // The RPC probably returns a JSON structure or a composite type. 
            // Based on TS types, it returns { sections: [...] }
            console.log('RPC returned data:', JSON.stringify(data, null, 2));
            
            // If it returns a composite type that pg renders as columns, check structure
            if (data.sections) {
                 console.log(`Sections returned: ${data.sections.length}`);
                 data.sections.forEach(s => console.log(` - ${s.title} (${s.type}): ${s.items.length} items`));
            }
        }
    } catch (e) {
        console.error('RPC Call FAILED:', e.message);
    }

    // 3. Fix Data for Testing
    console.log('\n--- Fixing Event Coordinates (Setting to Groningen) ---');
    
    // Update top 5 future events to have Groningen coordinates
    const updateQuery = `
      UPDATE events
      SET location = ST_SetSRID(ST_MakePoint($1, $2), 4326)
      WHERE id IN (
        SELECT id FROM events 
        WHERE event_date >= NOW() 
        ORDER BY event_date ASC 
        LIMIT 5
      )
      RETURNING id, title;
    `;
    
    // Groningen coordinates
    const groningenLng = 6.5665;
    const groningenLat = 53.2194;
    
    const updateRes = await client.query(updateQuery, [groningenLng, groningenLat]);
    
    console.log(`Updated ${updateRes.rowCount} events:`);
    updateRes.rows.forEach(e => console.log(` - Fixed: ${e.title}`));

    // 4. Verify RPC again
    console.log('\n--- Re-Testing get_discovery_rails RPC ---');
    const rpcQuery = `
            SELECT * FROM get_discovery_rails(
                p_user_id := '00000000-0000-0000-0000-000000000000',
                p_user_lat := $1,
                p_user_long := $2,
                p_radius_km := 25,
                p_limit_per_rail := 5
            );
    `;
    const res = await client.query(rpcQuery, [groningenLat, groningenLng]);
    if (res.rows.length > 0) {
        const data = res.rows[0].get_discovery_rails;
        if (data.sections) {
            data.sections.forEach(s => console.log(` - ${s.title} (${s.type}): ${s.items.length} items`));
        }
    }

  } catch (error) {
    console.error('Script Error:', error);
  } finally {
    await client.end();
  }
}

main();
