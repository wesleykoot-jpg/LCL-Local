
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

async function checkSources() {
    const envText = await Deno.readTextFile('.env');
    const env = {};
    envText.split('\n').forEach(line => {
        const [key, ...val] = line.split('=');
        if (key && val.length > 0) env[key.trim()] = val.join('=').trim().replace(/^[\"']|[\"']$/g, '');
    });

    const supabase = createClient(env['SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY']);

    // 1. Check Source Types
    const { data: sources, error: sourceErr } = await supabase
        .from('scraper_sources')
        .select('*');
        
    if (sourceErr) {
        console.error('Error fetching sources:', sourceErr);
        return;
    }

    console.log('--- Active Scraper Sources ---');
    sources.forEach(s => {
        const type = s.config?.type || 'html';
        const url = s.base_url || s.url || s.source_url || 'no-url';
        console.log(`- ${s.name} (${url}) | Type: ${type}`);
    });

    // 2. Sample data from non-HTML sources if they exist
    const { data: staging, error: stagingErr } = await supabase
        .from('raw_event_staging')
        .select('id, source_id, source_url, raw_html, parsing_method')
        .limit(10);

    if (stagingErr) {
        console.error('Error fetching staging:', stagingErr);
        return;
    }

    console.log('\n--- Payload Samples ---');
    staging.forEach(row => {
        const source = sources.find(s => s.id === row.source_id);
        const isJson = row.raw_html.trim().startsWith('{') || row.raw_html.trim().startsWith('[');
        console.log(`ID: ${row.id} | Source: ${source?.name || 'Unknown'} | Is JSON/Structured: ${isJson} | Method: ${row.parsing_method}`);
        if (isJson) {
            console.log('Sample Content:', row.raw_html.substring(0, 100));
        }
    });
}

checkSources();
