
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

async function resetStuck() {
    const envText = await Deno.readTextFile('.env');
    const env = {};
    envText.split('\n').forEach(line => {
        const [key, ...val] = line.split('=');
        if (key && val.length > 0) env[key.trim()] = val.join('=').trim().replace(/^[\"']|[\"']$/g, '');
    });

    const supabase = createClient(env['SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY']);

    console.log('Resetting stuck jobs...');

    const { error, count } = await supabase
        .from('raw_event_staging')
        .update({ status: 'awaiting_enrichment', updated_at: new Date().toISOString() })
        .eq('status', 'processing')
        .select('id', { count: 'exact' });
        
    if (error) {
        console.error('Error resetting jobs:', error);
        return;
    }

    console.log(`Successfully reset ${count} jobs from 'processing' to 'awaiting_enrichment'.`);
}

resetStuck();
