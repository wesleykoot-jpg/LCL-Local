
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

async function checkStuck() {
    const envText = await Deno.readTextFile('.env');
    const env = {};
    envText.split('\n').forEach(line => {
        const [key, ...val] = line.split('=');
        if (key && val.length > 0) env[key.trim()] = val.join('=').trim().replace(/^[\"']|[\"']$/g, '');
    });

    const supabase = createClient(env['SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY']);

    const { data: processing, error } = await supabase
        .from('raw_event_staging')
        .select('id, updated_at, created_at')
        .eq('pipeline_status', 'enriching')
        .order('updated_at', { ascending: true });
        
    if (error) {
        console.error(error);
        return;
    }

    console.log(`Currently enriching: ${processing.length}`);
    const now = new Date();
    processing.forEach(r => {
        const updated = new Date(r.updated_at);
        const diffSec = Math.floor((now.getTime() - updated.getTime()) / 1000);
        console.log(`ID: ${r.id} | Last Update: ${r.updated_at} (${diffSec}s ago)`);
    });
}

checkStuck();
