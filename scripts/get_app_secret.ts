// Small helper to fetch a secret from the app_secrets table using the
// SUPABASE_SERVICE_ROLE_KEY. Reads .env.local or .env if present.
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const loadEnv = async (path: string) => {
  try {
    const txt = await Deno.readTextFile(path);
    txt.split(/\r?\n/).forEach((line) => {
      const m = line.match(/^([^=]+)=(.*)$/);
      if (m) {
        const k = m[1].trim();
        let v = m[2].trim();
        v = v.replace(/^"|"$/g, "");
        Deno.env.set(k, v);
      }
    });
    return true;
  } catch (e) {
    return false;
  }
};

async function main() {
  await loadEnv('.env.local');
  await loadEnv('.env');

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || Deno.env.get('VITE_SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY');

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment or .env(.local)');
    Deno.exit(2);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  console.log('Querying app_secrets for key=service_role_key ...');
  const { data, error } = await supabase
    .from('app_secrets')
    .select('key, value, created_at')
    .eq('key', 'service_role_key')
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Supabase query error:', error.message || error);
    Deno.exit(3);
  }

  if (!data) {
    console.log('No row found for service_role_key in app_secrets');
    Deno.exit(0);
  }

  const masked = data.value.replace(/(.{4}).*(.{4})/, '$1...$2');
  console.log('Found service_role_key (masked):', masked);
  console.log('created_at:', data.created_at);
}

main();
