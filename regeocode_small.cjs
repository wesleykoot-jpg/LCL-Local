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
main();
