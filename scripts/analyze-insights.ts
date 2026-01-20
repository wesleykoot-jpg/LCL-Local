
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

  console.log("📊 Analyzing Scraper Insights...");

  // Get total insights count
  const { count: totalInsights, error: countError } = await supabase
    .from("scraper_insights")
    .select("*", { count: 'exact', head: true });
    
  if (countError) {
      console.error("Error counting insights:", countError);
      return;
  }

  console.log(`Total Scrape Runs Logged: ${totalInsights}`);

  // Group by strategy
  const { data: insights, error: fetchError } = await supabase
    .from("scraper_insights")
    .select("winning_strategy, total_events_found, detected_cms");

  if (fetchError) {
      console.error("Error fetching insights:", fetchError);
      return;
  }

  const strategyStats: Record<string, { runs: number, events: number }> = {};
  const cmsStats: Record<string, number> = {};

  insights?.forEach(row => {
      const strat = row.winning_strategy || "unknown";
      if (!strategyStats[strat]) strategyStats[strat] = { runs: 0, events: 0 };
      strategyStats[strat].runs++;
      strategyStats[strat].events += (row.total_events_found || 0);

      const cms = row.detected_cms || "unknown";
      cmsStats[cms] = (cmsStats[cms] || 0) + 1;
  });

  console.log("\n🧪 Strategy Effectiveness:");
  console.table(Object.entries(strategyStats).map(([strategy, stats]) => ({
      strategy,
      runs: stats.runs,
      events_found: stats.events,
      avg_events: (stats.events / stats.runs).toFixed(1)
  })));

  console.log("\n🕵️ Detected CMS Distribution:");
  console.table(cmsStats);

}

main();
