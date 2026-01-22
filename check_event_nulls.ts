
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

async function checkNulls() {
    const envText = await Deno.readTextFile('.env');
    const env = {};
    envText.split('\n').forEach(line => {
        const [key, ...val] = line.split('=');
        if (key && val.length > 0) env[key.trim()] = val.join('=').trim().replace(/^[\"']|[\"']$/g, '');
    });

    const supabase = createClient(env['SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY']);

    console.log('Fetching events...');
    // Fetch all events. If > 1000, we might need pagination, but let's try max limit first.
    // Supabase JS default limit is usually small, so assume 1000 is max per page?
    // Let's loop to get ALL events.
    
    let allEvents = [];
    let page = 0;
    const pageSize = 1000;
    
    while (true) {
        const { data, error } = await supabase
            .from('events')
            .select('*')
            .range(page * pageSize, (page + 1) * pageSize - 1);
            
        if (error) {
            console.error('Error fetching events:', error);
            return;
        }
        
        if (!data || data.length === 0) break;
        allEvents = allEvents.concat(data);
        if (data.length < pageSize) break;
        page++;
    }

    console.log(`Total events analyzed: ${allEvents.length}`);
    if (allEvents.length === 0) return;

    // Identify all columns
    const columns = new Set();
    allEvents.forEach(e => Object.keys(e).forEach(k => columns.add(k)));
    
    const stats = {};
    columns.forEach(col => {
        stats[col] = { nullCount: 0, total: allEvents.length };
    });

    allEvents.forEach(e => {
        columns.forEach(col => {
            if (e[col] === null || e[col] === undefined) {
                stats[col].nullCount++;
            }
        });
    });

    console.log('\n--- NULL Analysis ---');
    console.log('Column'.padEnd(30) + ' | Nulls'.padEnd(10) + ' | % Null');
    console.log('-'.repeat(55));
    
    const sortedCols = Array.from(columns).sort();
    
    sortedCols.forEach(col => {
        const { nullCount, total } = stats[col];
        const pct = ((nullCount / total) * 100).toFixed(1);
        if (nullCount > 0) {
             console.log(`${col.padEnd(30)} | ${nullCount.toString().padEnd(10)} | ${pct}%`);
        }
    });

    console.log('\n--- Fully Populated Columns (0% Null) ---');
    const cleanCols = sortedCols.filter(c => stats[c].nullCount === 0);
    console.log(cleanCols.join(', '));
}

checkNulls();
