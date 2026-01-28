// Stage a single raw_event_staging row using local sample HTML
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
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    Deno.exit(2);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Pick an existing scraper source (first available)
  const { data: sources, error: srcErr } = await supabase.from('scraper_sources').select('id, url').limit(1);
  if (srcErr) {
    console.error('Failed to query scraper_sources:', srcErr.message || srcErr);
    Deno.exit(3);
  }
  let source = sources && sources[0];
  if (!source) {
    console.log('No scraper_sources found; creating a local sample source...');
    const insertPayload = { name: 'local-sample', url: 'https://example.com/meppel', enabled: true, created_at: new Date().toISOString() };
    const { data: ins, error: insErr } = await supabase.from('scraper_sources').insert(insertPayload).select();
    if (insErr) {
      console.error('Failed to create scraper_source:', insErr.message || insErr);
      Deno.exit(6);
    }
    source = ins && ins[0];
  }

  // Load local sample HTML
  const samplePath = new URL('../meppel_source.html', import.meta.url).pathname;
  const html = await Deno.readTextFile(samplePath);

  const payload = {
    source_id: source.id,
    source_url: source.url || 'https://example.com/meppel',
    detail_url: source.url || 'https://example.com/meppel',
    detail_html: html,
    status: 'pending',
    title: 'Sample Staged Event',
    created_at: new Date().toISOString()
  };

  console.log('Staging one raw_event_staging row for source:', source.id);
  const { data, error } = await supabase.from('raw_event_staging').insert(payload).select();
  if (error) {
    console.error('Staging failed:', error.message || error);
    Deno.exit(5);
  }

  console.log('Staged row:', data);
}

main();
