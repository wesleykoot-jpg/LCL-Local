#!/usr/bin/env node

/**
 * Script to apply new discovery rails migrations directly to Supabase
 * This bypasses the migration history conflicts
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables:');
  console.error('   VITE_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration(filePath, name) {
  console.log(`\n📝 Applying migration: ${name}...`);
  
  try {
    const sql = readFileSync(filePath, 'utf-8');
    
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql }).catch(async () => {
      // If exec_sql doesn't exist, try direct query
      return await supabase.from('_migrations').select('*').limit(0); // This will fail but we'll catch it
    });

    // Since we can't execute arbitrary SQL via RPC easily, let's just log the SQL
    console.log('⚠️  Please apply this SQL manually via Supabase Dashboard SQL Editor:');
    console.log('=' .repeat(80));
    console.log(sql);
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error(`❌ Error applying ${name}:`, error.message);
    throw error;
  }
}

async function main() {
  console.log('🚀 Applying Discovery Rails Migrations\n');
  
  const migrations = [
    {
      file: join(__dirname, 'supabase/migrations/20260121160000_get_discovery_rails.sql'),
      name: 'get_discovery_rails'
    },
    {
      file: join(__dirname, 'supabase/migrations/20260121160100_get_mission_mode_events.sql'),
      name: 'get_mission_mode_events'
    }
  ];

  for (const migration of migrations) {
    await applyMigration(migration.file, migration.name);
  }

  console.log('\n✅ All migrations logged. Please apply them via Supabase Dashboard.');
}

main().catch(console.error);
