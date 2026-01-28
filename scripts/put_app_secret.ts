// Upsert a secret into app_secrets table using service role key from .env(.local)
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

  const secretValue = Deno.args[0] || Deno.env.get('APP_SECRET_VALUE');
  if (!secretValue) {
    console.error('Usage: deno run -A scripts/put_app_secret.ts <secretValue>');
    Deno.exit(2);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  console.log('Upserting app_secrets.key=service_role_key ...');
  const payload = { key: 'service_role_key', value: secretValue };
  const { data, error } = await supabase.from('app_secrets').upsert(payload, { onConflict: 'key' }).select();

  if (error) {
    console.error('Supabase upsert error:', error.message || error);
    Deno.exit(3);
  }

  console.log('Upsert result:', data);
}

main();
