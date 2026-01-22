const { Client } = require('pg');
require('dotenv').config();

// Parse Supabase connection string
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const projectRef = supabaseUrl ? new URL(supabaseUrl).hostname.split('.')[0] : null;

if (!projectRef) {
  console.error('Could not extract project ref from SUPABASE_URL');
  process.exit(1);
}

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Connection config for Supabase Postgres
const client = new Client({
  host: `db.${projectRef}.supabase.co`,
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: serviceRoleKey,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    await client.connect();
    console.log('Connected to Supabase Postgres\n');

    const query = `
      SELECT proname, proargnames, proargtypes
      FROM pg_proc 
      WHERE proname = 'get_discovery_rails';
    `;
    
    const res = await client.query(query);
    if (res.rows.length === 0) {
        console.log('Function get_discovery_rails not found');
        return;
    }
    
    const row = res.rows[0];
    console.log('Function found:', row.proname);
    console.log('Arg names:', row.proargnames);
    
    // Resolve types
    const typeOids = row.proargtypes.split(' ');
    console.log('Arg types OIDs:', typeOids);
    
    for (let i = 0; i < typeOids.length; i++) {
        const oid = typeOids[i];
        const typeRes = await client.query(`SELECT typname FROM pg_type WHERE oid = $1`, [oid]);
        const typeName = typeRes.rows[0] ? typeRes.rows[0].typname : 'unknown';
        console.log(`Arg ${i} (${row.proargnames ? row.proargnames[i] : '?'}) type: ${typeName}`);
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

main();
