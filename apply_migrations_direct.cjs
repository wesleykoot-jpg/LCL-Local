/**
 * Script to apply migrations directly to the database
 * Used when supabase CLI has sync issues
 */

const fs = require('fs');
const path = require('path');
const { query, closePool } = require('./scripts/lib/db.cjs');

// Manually load .env file for the db utility
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

async function applyMigration(filePath) {
  console.log(`📄 Reading migration: ${path.basename(filePath)}`);
  const sql = fs.readFileSync(filePath, 'utf8');
  
  try {
    console.log(`🚀 Applying SQL...`);
    await query(sql);
    console.log(`✅ Applied successfully!`);
    return true;
  } catch (err) {
    console.error(`❌ Failed to apply: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('🛠️ Applying Database Migrations Directly\n');
  let migrations;
  if (process.argv[2]) {
    migrations = [process.argv[2]];
    console.log(`🔹 Running single migration: ${process.argv[2]}`);
  } else {
    migrations = [
      'supabase/migrations/20260122000000_add_claim_staging_rows.sql',
      'supabase/migrations/20260122000001_add_security_declarations.sql'
    ];
  }
  let allSuccess = true;
  for (const m of migrations) {
    const migrationPath = path.isAbsolute(m) ? m : path.join(__dirname, m);
    const success = await applyMigration(migrationPath);
    if (!success) allSuccess = false;
  }
  console.log('\n' + '='.repeat(50));
  if (allSuccess) {
    console.log('✅ All migrations applied successfully!');
  } else {
    console.log('⚠️  Some migrations failed. Check output above.');
  }
  console.log('='.repeat(50));
  await closePool();
  process.exit(allSuccess ? 0 : 1);
}

main();
