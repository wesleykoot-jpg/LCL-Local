
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

async function check() {
    const envText = await Deno.readTextFile('.env');
    const env = {};
    envText.split('\n').forEach(line => {
        const [key, ...val] = line.split('=');
        if (key && val.length > 0) env[key.trim()] = val.join('=').trim().replace(/^[\"']|[\"']$/g, '');
    });

    const supabase = createClient(env['SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY']);

    const { count: eventCount } = await supabase.from('events').select('*', { count: 'exact', head: true });
    console.log('Total events in DB:', eventCount);

    const { data: staging, error: stagingErr } = await supabase
        .from('raw_event_staging')
        .select('status');
        
    if (!stagingErr) {
        const stats = staging.reduce((acc, r) => {
            acc[r.status] = (acc[r.status] || 0) + 1;
            return acc;
        }, {});
        console.log('Staging status:', stats);
    }
}

check();
