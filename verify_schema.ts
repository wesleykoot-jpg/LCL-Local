// verify_schema.ts
// Simple script to query Supabase information_schema for column verification
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl, supabaseServiceRoleKey } from "./supabase/functions/_shared/env.ts";

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function run() {
  const query1 = `SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'scraper_sources'
  AND column_name IN ('last_payload_hash', 'total_savings_prevented_runs');`;
  const query2 = `SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'raw_event_staging'
  AND column_name = 'parsing_method';`;

  const { data: res1, error: err1 } = await supabase.rpc('pg_sql', { sql: query1 });
  const { data: res2, error: err2 } = await supabase.rpc('pg_sql', { sql: query2 });
  console.log('--- scraper_sources columns ---');
  console.log(JSON.stringify(res1, null, 2));
  if (err1) console.error('Error1', err1);
  console.log('--- raw_event_staging parsing_method column ---');
  console.log(JSON.stringify(res2, null, 2));
  if (err2) console.error('Error2', err2);
}
run();
