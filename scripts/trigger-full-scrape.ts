
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import "jsr:@std/dotenv/load";

async function main() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing credentials");
    Deno.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // 1. Get all enabled sources
  const { data: sources, error: sourceError } = await supabase
    .from("scraper_sources")
    .select("id, name")
    .eq("enabled", true);

  if (sourceError || !sources) {
    console.error("Error fetching sources", sourceError);
    return;
  }

  console.log(`🚀 Enqueueing scrape jobs for ${sources.length} sources...`);

  // 2. Enqueue jobs (using insert instead of RPC if RPC is not available or reliable)
  // We'll try RPC first if it exists, otherwise manual insert
  // Actually, let's just insert into scrape_jobs directly for control
  const jobs = sources.map(s => ({
    source_id: s.id,
    status: 'pending',
    priority: 1,
    payload: { scheduledAt: new Date().toISOString() }
  }));

  const { data: insertedJobs, error: insertError } = await supabase
    .from("scrape_jobs")
    .insert(jobs)
    .select("id");

  if (insertError) {
    console.error("Failed to enqueue jobs:", insertError);
    return;
  }

  console.log(`✅ Enqueued ${insertedJobs.length} jobs. Monitoring progress...`);

  // 3. Monitor Loop
  let completed = 0;
  let failed = 0;
  const total = insertedJobs.length;
  const startTime = Date.now();

  while (completed + failed < total) {
    await new Promise(r => setTimeout(r, 5000)); // poll every 5s

    const { data: jobStatus } = await supabase
      .from("scrape_jobs")
      .select("status, count(*)", { count: 'exact', head: false })
      .in("id", insertedJobs.map(j => j.id));
    
    // Aggregate status
    // Supabase select with count doesn't group automatically unless .rpc or manual grouping
    /*
     We can just query pending/processing count
    */
    const { count: pendingCount } = await supabase.from("scrape_jobs").select("*", { count: 'exact', head: true }).in("id", insertedJobs.map(j => j.id)).eq("status", "pending");
    const { count: processingCount } = await supabase.from("scrape_jobs").select("*", { count: 'exact', head: true }).in("id", insertedJobs.map(j => j.id)).eq("status", "processing");
    const { count: completedCount } = await supabase.from("scrape_jobs").select("*", { count: 'exact', head: true }).in("id", insertedJobs.map(j => j.id)).eq("status", "completed");
    const { count: failedCount } = await supabase.from("scrape_jobs").select("*", { count: 'exact', head: true }).in("id", insertedJobs.map(j => j.id)).eq("status", "failed");

    completed = completedCount || 0;
    failed = failedCount || 0;
    const pending = pendingCount || 0;
    const processing = processingCount || 0;

    console.log(`[${new Date().toLocaleTimeString()}] Progress: ${completed + failed}/${total} (Pending: ${pending}, Processing: ${processing}, Completed: ${completed}, Failed: ${failed})`);
    
    // Timeout safety
    if ((Date.now() - startTime) > 1000 * 60 * 10) { // 10 mins
        console.warn("⚠️ Timeout reached (10 mins). Stopping monitor.");
        break;
    }
    
    if (completed + failed === total) break;
  }

  console.log("\n🏁 All jobs finished!");

  // 4. Analysis
  console.log("\n📊 ANALYSIS RESULTS (Data-First Architecture)");
  
  // Total events found in this run
  // We can sum events_scraped from jobs
  const { data: jobStats } = await supabase
    .from("scrape_jobs")
    .select("events_scraped, events_inserted")
    .in("id", insertedJobs.map(j => j.id));
  
  const totalScraped = jobStats?.reduce((sum, j) => sum + (j.events_scraped || 0), 0) || 0;
  const totalInserted = jobStats?.reduce((sum, j) => sum + (j.events_inserted || 0), 0) || 0;

  console.log(`\nTotals:\n- Scraped: ${totalScraped}\n- Inserted (New): ${totalInserted}`);

  // Breakdown by Strategy (from scraper_insights)
  // We need insights linked to these sources or run time. 
  // Since we don't have run_id on insights easily linked to job_id in the worker yet (maybe?), 
  // we filter by created_at > startTime
  
  const { data: insights } = await supabase
    .from("scraper_insights")
    .select("winning_strategy, events_found")
    .gte("created_at", new Date(startTime).toISOString());

  const strategyStats: Record<string, number> = {};
  
  insights?.forEach(i => {
      const strat = i.winning_strategy || "unknown";
      strategyStats[strat] = (strategyStats[strat] || 0) + (i.events_found || 0);
  });

  console.log("\nEvents by Strategy:");
  console.table(strategyStats);

  if (totalInserted >= 300) {
      console.log("\n✅ SUCCESS: Target of 300 new events reached!");
  } else {
      console.log(`\n❌ MISSED TARGET: Only ${totalInserted} new events.`);
  }
}

main();
