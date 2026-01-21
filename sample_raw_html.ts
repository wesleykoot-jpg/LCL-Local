
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

async function sampleRawHtml() {
    const envText = await Deno.readTextFile('.env');
    const env = {};
    envText.split('\n').forEach(line => {
        const [key, ...val] = line.split('=');
        if (key && val.length > 0) env[key.trim()] = val.join('=').trim().replace(/^[\"']|[\"']$/g, '');
    });

    const supabase = createClient(env['SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY']);

    const { data: samples, error } = await supabase
        .from('raw_event_staging')
        .select('id, source_url, raw_html, parsing_method')
        .eq('parsing_method', 'ai')
        .limit(3);
        
    if (error) {
        console.error(error);
        return;
    }

    samples.forEach((s, i) => {
        console.log(`--- Sample ${i+1} (${s.url}) ---`);
        console.log(`ID: ${s.id}`);
        console.log(`HTML Length: ${s.raw_html.length}`);
        console.log(`First 500 chars: ${s.raw_html.substring(0, 500)}`);
        console.log(`JSON-LD tags found: ${s.raw_html.includes('application/ld+json')}`);
        console.log('\n');
    });
}

sampleRawHtml();
