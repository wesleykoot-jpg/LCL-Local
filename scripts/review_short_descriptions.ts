
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

async function generateReview() {
    const envText = await Deno.readTextFile('.env');
    const env: Record<string, string> = {};
    envText.split('\n').forEach(line => {
        const [key, ...val] = line.split('=');
        if (key && val.length > 0) env[key.trim()] = val.join('=').trim().replace(/^[\"']|[\"']$/g, '');
    });

    const supabase = createClient(env['SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY']);

    // Fetch short descriptions
    const { data: events, error } = await supabase
        .from('events')
        .select('*');
        
    if (error) {
        console.error(error);
        return;
    }

    const shortEvents = events.filter(e => !e.description || e.description.length < 50);
    
    console.log(`# Events Requiring Review (Short Descriptions)`);
    console.log(`**Total Count:** ${shortEvents.length} / ${events.length}`);
    console.log(`\n| Title | Category | Description Length | ID |`);
    console.log(`|---|---|---|---|`);
    
    shortEvents.slice(0, 200).forEach(e => { // Limit to 200 for artifact size
        const desc = (e.description || '').replace(/\n/g, ' ').substring(0, 30);
        console.log(`| ${e.title} | ${e.category} | ${e.description?.length || 0} | \`${e.id}\` |`);
    });
    
    if (shortEvents.length > 200) {
        console.log(`\n... and ${shortEvents.length - 200} more.`);
    }
}

generateReview();
