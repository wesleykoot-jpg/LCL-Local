// check_db_schema.ts
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl, supabaseServiceRoleKey } from "./supabase/functions/_shared/env.ts";

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function checkColumns(tableName: string) {
  const query = `
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = '${tableName}'
  `;
  const { data, error } = await supabase.rpc('pg_sql', { sql: query });
  console.log(`--- Columns for ${tableName} ---`);
  if (error) console.error(error);
  else console.log(JSON.stringify(data, null, 2));
}

async function main() {
  await checkColumns('scraper_sources');
  await checkColumns('raw_event_staging');
}

main().catch(console.error);
