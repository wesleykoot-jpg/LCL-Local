
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

async function scrub() {
    const envText = await Deno.readTextFile('.env');
    const env: Record<string, string> = {};
    envText.split('\n').forEach(line => {
        const [key, ...val] = line.split('=');
        if (key && val.length > 0) env[key.trim()] = val.join('=').trim().replace(/^[\"']|[\"']$/g, '');
    });

    const supabase = createClient(env['SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY']);
    
    // Pattern to scrub
    const BAD_PATTERN = 'Controleer ticketprijs bij evenement';

    console.log(`Scrubbing descriptions matching "${BAD_PATTERN}"...`);

    const { data, error, count } = await supabase
        .from('events')
        .update({ description: null }) // Set to NULL so they can be enriched later
        .eq('description', BAD_PATTERN)
        .select('id', { count: 'exact' });

    if (error) {
        console.error('Error scrubbing:', error);
    } else {
        console.log(`Scrubbed ${data?.length || 0} events.`);
    }
}

scrub();
