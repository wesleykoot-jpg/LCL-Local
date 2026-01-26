
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    console.log("📊 Checking Pipeline Results...");

    // 1. Raw Event Staging Source of Truth
    const { count: pending } = await supabase.from('raw_event_staging').select('*', { count: 'exact', head: true }).eq('status', 'pending');
    const { count: processing } = await supabase.from('raw_event_staging').select('*', { count: 'exact', head: true }).eq('status', 'processing');
    const { count: completed } = await supabase.from('raw_event_staging').select('*', { count: 'exact', head: true }).eq('status', 'completed');
    const { count: failed } = await supabase.from('raw_event_staging').select('*', { count: 'exact', head: true }).eq('status', 'failed');
    
    console.log(`Staging Queue: Pending=${pending}, Processing=${processing}, Completed=${completed}, Failed=${failed}`);

    // 1b. Scrape Jobs (Upstream)
    const { count: jobsPending } = await supabase.from('scrape_jobs').select('*', { count: 'exact', head: true }).eq('status', 'pending');
    const { count: jobsProcessing } = await supabase.from('scrape_jobs').select('*', { count: 'exact', head: true }).eq('status', 'processing');
    const { count: jobsCompleted } = await supabase.from('scrape_jobs').select('*', { count: 'exact', head: true }).eq('status', 'completed');
    const { count: jobsFailed } = await supabase.from('scrape_jobs').select('*', { count: 'exact', head: true }).eq('status', 'failed');
    console.log(`Scrape Jobs: Pending=${jobsPending}, Processing=${jobsProcessing}, Completed=${jobsCompleted}, Failed=${jobsFailed}`);

    // 2. Events Created
    const { data: events } = await supabase.from('events').select('category, source_id, created_at, event_type');
    console.log(`\n✅ Total Final Events: ${events?.length || 0}`);
    
    if (events && events.length > 0) {
        // Group by Category
        const byCategory: Record<string, number> = {};
        events.forEach(e => {
            byCategory[e.category] = (byCategory[e.category] || 0) + 1;
        });
        console.log("By Category:");
        console.table(byCategory);
    }

    // 3. Methods Used (from Staging or Insights)
    // We check `parsing_method` in staging for completed items
    const { data: methods } = await supabase.from('raw_event_staging')
        .select('parsing_method')
        .eq('status', 'completed'); // Only look at completed
        
    if (methods && methods.length > 0) {
        const byMethod: Record<string, number> = {};
        methods.forEach(m => {
            const method = m.parsing_method || 'unknown';
            byMethod[method] = (byMethod[method] || 0) + 1;
        });
        console.log("\nBy Parsing Method (Completed Items):");
        console.table(byMethod);
    } else {
        console.log("\nNo completed staging items => No method stats yet.");
    }
}

main();
