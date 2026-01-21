
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

async function deduplicate() {
    const envText = await Deno.readTextFile('.env');
    const env: Record<string, string> = {};
    envText.split('\n').forEach(line => {
        const [key, ...val] = line.split('=');
        if (key && val.length > 0) env[key.trim()] = val.join('=').trim().replace(/^[\"']|[\"']$/g, '');
    });

    const supabase = createClient(env['SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY']);

    console.log('Fetching all events for deduplication...');
    // We need title, venue_name, event_date, and id
    // We can also use description length and image_url to pick the "best" one
    
    let allEvents: any[] = [];
    let page = 0;
    const PAGE_SIZE = 1000;
  
    while (true) {
        const { data: pageData, error } = await supabase
            .from('events')
            .select('id, title, venue_name, event_date, description, image_url')
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

        if (error) {
            console.error('Error fetching page', page, error);
            break;
        }
        if (!pageData || pageData.length === 0) break;
        
        allEvents.push(...pageData);
        console.log(`Fetched ${allEvents.length} events...`);
        page++;
    }

    console.log(`Total events fetched: ${allEvents.length}`);

    // Grouping
    const groups: Record<string, any[]> = {};

    for (const e of allEvents) {
        // Create a key: Normalized Title + Date (YYYY-MM-DD generally)
        // Venue name can vary ("Luxor" vs "Luxor Cinema"), so maybe just Title + Date?
        // Let's use Title + Date + First 3 chars of venue (if exists)
        
        const safeTitle = (e.title || '').toLowerCase().trim();
        const safeDate = (e.event_date || '').split('T')[0]; // Just the date part
        const safeVenue = (e.venue_name || '').toLowerCase().trim().substring(0, 5); // First 5 chars
        
        const key = `${safeTitle}|${safeDate}|${safeVenue}`;
        
        if (!groups[key]) groups[key] = [];
        groups[key].push(e);
    }

    let duplicateGroups = 0;
    let eventsToDelete: string[] = [];

    for (const key in groups) {
        const group = groups[key];
        if (group.length > 1) {
            duplicateGroups++;
            
            // Score them to find the best one to KEEP
            // Score: +10 if image exists, +1 for every 10 chars of description
            const scored = group.map(e => {
                let score = 0;
                if (e.image_url) score += 10;
                if (e.description) score += Math.min(e.description.length / 10, 5); // Cap desc score
                return { event: e, score };
            });

            // Sort descending by score
            scored.sort((a, b) => b.score - a.score);

            // Keep the first one (index 0)
            const winner = scored[0].event;
            const losers = scored.slice(1).map(i => i.event.id);

            eventsToDelete.push(...losers);
            
            // console.log(`Duplicate Group: ${key}`);
            // console.log(`  Keeping: ${winner.id} (Score: ${scored[0].score}) - ${winner.title}`);
            // console.log(`  Deleting: ${losers.length} events`);
        }
    }

    console.log(`\nFound ${duplicateGroups} groups with duplicates.`);
    console.log(`Identified ${eventsToDelete.length} events to delete.`);

    if (Deno.args.includes('--dry-run')) {
        console.log('DRY RUN: No events deleted.');
        return;
    }

    if (eventsToDelete.length > 0) {
        console.log('Deleting events...');
        // Delete in batches of 100
        for (let i = 0; i < eventsToDelete.length; i += 100) {
            const batch = eventsToDelete.slice(i, i + 100);
            const { error } = await supabase.from('events').delete().in('id', batch);
            if (error) console.error('Error deleting batch:', error);
            else console.log(`Deleted batch ${i}-${i+batch.length}`);
        }
        console.log('Deletion complete.');
    } else {
        console.log('No events to delete.');
    }
}

deduplicate();
