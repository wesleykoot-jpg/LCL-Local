
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

async function analyze() {
    const envText = await Deno.readTextFile('.env');
    const env = {};
    envText.split('\n').forEach(line => {
        const [key, ...val] = line.split('=');
        if (key && val.length > 0) env[key.trim()] = val.join('=').trim().replace(/^[\"']|[\"']$/g, '');
    });

    const supabase = createClient(env['SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY']);

    // 1. Total Count
    const { count: totalEvents, error: countErr } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true });
    
    if (countErr) {
        console.error('Error fetching count:', countErr);
        return;
    }
    console.log(`Total Events: ${totalEvents}`);

    // Fetch all events
    const { data: events, error: dataErr } = await supabase
        .from('events')
        .select('*');

    if (dataErr) {
        console.error('Error fetching events:', dataErr);
        return;
    }

    // 2. Category Distribution
    const categories: Record<string, number> = {};
    
    // 3. Null Checks
    const nulls = {
        title: 0,
        description: 0,
        event_date: 0,
        location: 0,
        image_url: 0,
        venue_name: 0
    };

    // 4. Content Quality
    let htmlTagsInDesc = 0;
    let shortDescriptions = 0; // < 50 chars
    let pastEvents = 0;
    let futureEvents = 0;
    const now = new Date();

    // 5. Duplicates
    const titles = new Set();
    let duplicates = 0;
    
    // 6. Source Checking
    // assuming metadata column exists, or we check if description contains "Source:"
    
    events.forEach(e => {
        // Category
        const cat = e.category || 'NULL';
        categories[cat] = (categories[cat] || 0) + 1;

        // Nulls
        if (!e.title) nulls.title++;
        if (!e.description) nulls.description++;
        if (!e.event_date) nulls.event_date++;
        if (!e.location) nulls.location++;
        if (!e.image_url) nulls.image_url++;
        if (!e.venue_name) nulls.venue_name++;

        // Quality
        if (e.description && /<[a-z][\s\S]*>/i.test(e.description)) {
            htmlTagsInDesc++;
        }
        if (e.description && e.description.length < 50) {
            shortDescriptions++;
        }

        // Date
        if (e.event_date) {
            const d = new Date(e.event_date);
            if (d < now) pastEvents++;
            else futureEvents++;
        }

        // Duplicates
        if (e.title) {
            if (titles.has(e.title)) duplicates++;
            titles.add(e.title);
        }
    });

    console.log('\n--- Category Distribution ---');
    console.log(categories);

    console.log('\n--- Missing / Null Fields ---');
    console.log(nulls);

    console.log('\n--- Content Quality ---');
    console.log(`HTML Tags in Description: ${htmlTagsInDesc}`);
    console.log(`Short Descriptions (<50 chars): ${shortDescriptions}`);
    console.log(`Past Events: ${pastEvents}`);
    console.log(`Future Events: ${futureEvents}`);
    console.log(`Duplicate Titles: ${duplicates}`);
    
    // Sample a few bad ones
    if (htmlTagsInDesc > 0) {
        console.log('\nSample Event with HTML in Description:');
         const badDesc = events.find(e => e.description && /<[a-z][\s\S]*>/i.test(e.description));
         if(badDesc) console.log(`ID: ${badDesc.id}, Title: ${badDesc.title}`);
    }
}

analyze();
