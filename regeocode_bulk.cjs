const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

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
    return {};
  }
}

const env = loadEnv();
const host = env.SUPABASE_DB_HOST;
const port = env.SUPABASE_DB_PORT_SESSION || 5432;
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

async function geocode(address) {
  if (!address || address.length < 3) return null;
  try {
    const encodedAddress = encodeURIComponent(address + ", Netherlands");
    const url = `https://nominatim.openstreetmap.org/search?q=${encodedAddress}&format=json&limit=1`;
    
    // Using global fetch (available in Node 18+)
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'LCL-Local-Maintenance/1.0 (https://lcl.social)'
      }
    });
    
    if (res.ok) {
      const data = await res.json();
      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon)
        };
      }
    }
  } catch (e) {
    console.error(`Geocoding error for "${address}":`, e.message);
  }
  return null;
}

async function main() {
  try {
    await client.connect();
    console.log('Connected to Supabase Postgres\n');

    // 1. Find problematic events
    const findQuery = `
      SELECT id, title, venue_name 
      FROM events 
      WHERE ST_Equals(location::geometry, ST_SetSRID(ST_Point(0, 0), 4326)::geometry)
      OR location IS NULL
      LIMIT 100; -- Batch to avoid rate limiting
    `;
    
    const res = await client.query(findQuery);
    console.log(`Found ${res.rows.length} events needing coordinates.\n`);

    let successCount = 0;
    
    for (const row of res.rows) {
      const query = row.venue_name || row.title;
      console.log(`Processing [${row.id}]: "${query}"...`);
      
      const coords = await geocode(query);
      
      if (coords) {
        const updateQuery = `
          UPDATE events 
          SET location = ST_SetSRID(ST_Point($1, $2), 4326) 
          WHERE id = $3
        `;
        await client.query(updateQuery, [coords.lng, coords.lat, row.id]);
        console.log(`✅ Success: (${coords.lat}, ${coords.lng})`);
        successCount++;
      } else {
        console.log(`❌ Failed: Could not find coordinates`);
      }
      
      // Delay to respect Nominatim rate limits (1 req/sec)
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`\nMaintenance Complete: ${successCount} events re-geocoded.`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

main();
