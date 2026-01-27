
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

async function checkHealth() {
    const envText = await Deno.readTextFile('.env');
    const env = {};
    envText.split('\n').forEach(line => {
        const [key, ...val] = line.split('=');
        if (key && val.length > 0) env[key.trim()] = val.join('=').trim().replace(/^[\"']|[\"']$/g, '');
    });

    const supabase = createClient(env['SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY']);

    const { data, error } = await supabase.rpc('get_pipeline_health');
        
    if (error) {
        console.error('Error calling get_pipeline_health:', error);
        return;
    }

    console.log('--- Pipeline Health Metrics ---');
    console.log(data);
}

checkHealth();
