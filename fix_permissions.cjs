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

async function main() {
  try {
    await client.connect();
    console.log('Connected to Supabase Postgres\n');

    // 1. Check Permissions
    console.log('Checking permissions for get_discovery_rails...');
    const permQuery = `
      SELECT grantee, privilege_type 
      FROM information_schema.role_routine_grants 
      WHERE routine_name = 'get_discovery_rails';
    `;
    const res = await client.query(permQuery);
    console.log('Current Grants:', res.rows);

    const hasAnon = res.rows.some(r => r.grantee === 'anon' && r.privilege_type === 'EXECUTE');
    const hasAuth = res.rows.some(r => r.grantee === 'authenticated' && r.privilege_type === 'EXECUTE');

    if (!hasAnon) {
        console.log('\n❌ "anon" role MISSING EXECUTE permission. Granting now...');
        await client.query(`GRANT EXECUTE ON FUNCTION get_discovery_rails(uuid, double precision, double precision, double precision, integer) TO anon;`);
        console.log('✅ Granted EXECUTE to anon.');
    } else {
        console.log('\n✅ "anon" role has EXECUTE permission.');
    }

    if (!hasAuth) {
        console.log('\n❌ "authenticated" role MISSING EXECUTE permission. Granting now...');
        await client.query(`GRANT EXECUTE ON FUNCTION get_discovery_rails(uuid, double precision, double precision, double precision, integer) TO authenticated;`);
        console.log('✅ Granted EXECUTE to authenticated.');
    } else {
         console.log('\n✅ "authenticated" role has EXECUTE permission.');
    }

    // Double check signature match in case params are different
    if (!hasAnon && !hasAuth && res.rows.length === 0) {
        console.log('Warning: No grants found at all. Attempting generic grant on function name...');
        // Try without signature if specific one fails
        try {
            await client.query(`GRANT EXECUTE ON FUNCTION get_discovery_rails TO anon, authenticated, service_role;`);
            console.log('✅ Generic GRANT successful.');
        } catch (e) {
            console.log('Generic GRANT failed:', e.message);
        }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

main();
