
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

async function analyze() {
    const envText = await Deno.readTextFile('.env');
    const env = {};
    envText.split('\n').forEach(line => {
        const [key, ...val] = line.split('=');
        if (key && val.length > 0) env[key.trim()] = val.join('=').trim().replace(/^[\"']|[\"']$/g, '');
    });

    const supabase = createClient(env['SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY']);

    const { data: staging, error: stagingErr } = await supabase
        .from('raw_event_staging')
        .select('status, parsing_method');
        
    if (stagingErr) {
        console.error('Error fetching staging data:', stagingErr);
        return;
    }

    const total = staging.length;
    const statusStats = {};
    const methodStats = {};
    const successPerMethod = {};

    staging.forEach(r => {
        const status = r.status || 'unknown';
        const method = r.parsing_method || 'none';
        
        statusStats[status] = (statusStats[status] || 0) + 1;
        methodStats[method] = (methodStats[method] || 0) + 1;
        
        if (!successPerMethod[method]) {
            successPerMethod[method] = { total: 0, completed: 0, failed: 0 };
        }
        successPerMethod[method].total++;
        if (status === 'completed') successPerMethod[method].completed++;
        if (status === 'failed') successPerMethod[method].failed++;
    });

    console.log('--- Overall Stats ---');
    console.log(`Total Raw Events: ${total}`);
    console.log('Status Distribution:', statusStats);
    console.log('Method Distribution:', methodStats);
    
    console.log('\n--- Success Rates by Method ---');
    Object.keys(successPerMethod).forEach(method => {
        const stats = successPerMethod[method];
        const successRate = ((stats.completed / stats.total) * 100).toFixed(2);
        console.log(`${method}: ${stats.completed}/${stats.total} (${successRate}%) - Failed: ${stats.failed}`);
    });
}

analyze();
