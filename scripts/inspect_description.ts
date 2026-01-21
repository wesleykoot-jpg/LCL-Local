
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const EVENT_ID = '993ed3be-32e5-4f20-bdb7-057403f9ec8c'; // Token spel
const EVENT_IDS = [
    '993ed3be-32e5-4f20-bdb7-057403f9ec8c', 
    'a43740d3-13a2-4740-a5f8-2011fe83c861',
    'e1882ce1-5fa1-412e-9ea7-4d44d21085bd'
];

async function inspect() {
    const envText = await Deno.readTextFile('.env');
    const env: Record<string, string> = {};
    envText.split('\n').forEach(line => {
        const [key, ...val] = line.split('=');
        if (key && val.length > 0) env[key.trim()] = val.join('=').trim().replace(/^[\"']|[\"']$/g, '');
    });

    const supabase = createClient(env['SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY']);

    const { data: events, error } = await supabase
        .from('events')
        .select('id, title, description')
        .in('id', EVENT_IDS);
        
    if (error) {
        console.error(error);
        return;
    }

    console.log('--- Inspection ---');
    events.forEach(e => {
        console.log(`\nID: ${e.id}`);
        console.log(`Title: ${e.title}`);
        console.log(`Description Raw: [${e.description}]`);
        console.log(`Description Length: ${e.description?.length}`);
    });
}

inspect();
