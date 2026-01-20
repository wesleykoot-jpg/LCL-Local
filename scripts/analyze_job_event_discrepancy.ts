/**
 * Analyze Scrape Job to Event Discrepancy
 * 
 * This script investigates why there might be more scrape jobs than events.
 * Common reasons include:
 * 1. Jobs that failed completely
 * 2. Jobs that scraped 0 events (empty pages, broken selectors)
 * 3. Jobs where all events were duplicates
 * 4. Jobs still pending/running
 * 5. Failed event insertions
 * 
 * Run with: deno run --allow-net --allow-env scripts/analyze_job_event_discrepancy.ts
 */

import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface JobStats {
  total_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  pending_jobs: number;
  running_jobs: number;
  jobs_with_zero_events: number;
  total_events_scraped: number;
  total_events_inserted: number;
  total_duplicates: number;
}

async function main() {
  console.log("\n" + "=".repeat(70));
  console.log("📊 SCRAPE JOB vs EVENT DISCREPANCY ANALYSIS");
  console.log("=".repeat(70) + "\n");

  // 1. Get overall job statistics
  console.log("📋 SCRAPE JOBS OVERVIEW\n");

  const { data: allJobs, error: jobsError } = await supabase
    .from("scrape_jobs")
    .select("id, status, events_scraped, events_inserted, error_message, created_at");

  if (jobsError) {
    console.error("Failed to fetch jobs:", jobsError.message);
    return;
  }

  const jobStats: JobStats = {
    total_jobs: allJobs?.length || 0,
    completed_jobs: allJobs?.filter(j => j.status === "completed").length || 0,
    failed_jobs: allJobs?.filter(j => j.status === "failed").length || 0,
    pending_jobs: allJobs?.filter(j => j.status === "pending").length || 0,
    running_jobs: allJobs?.filter(j => j.status === "running").length || 0,
    jobs_with_zero_events: allJobs?.filter(j => j.status === "completed" && (j.events_scraped === 0 || j.events_scraped === null)).length || 0,
    total_events_scraped: allJobs?.reduce((sum, j) => sum + (j.events_scraped || 0), 0) || 0,
    total_events_inserted: allJobs?.reduce((sum, j) => sum + (j.events_inserted || 0), 0) || 0,
    total_duplicates: 0,
  };

  // Calculate duplicates (scraped - inserted for completed jobs)
  const completedJobs = allJobs?.filter(j => j.status === "completed") || [];
  jobStats.total_duplicates = completedJobs.reduce((sum, j) => {
    const scraped = j.events_scraped || 0;
    const inserted = j.events_inserted || 0;
    return sum + Math.max(0, scraped - inserted);
  }, 0);

  console.log(`Total Jobs:             ${jobStats.total_jobs}`);
  console.log(`├── Completed:          ${jobStats.completed_jobs} (${(jobStats.completed_jobs / jobStats.total_jobs * 100).toFixed(1)}%)`);
  console.log(`├── Failed:             ${jobStats.failed_jobs} (${(jobStats.failed_jobs / jobStats.total_jobs * 100).toFixed(1)}%)`);
  console.log(`├── Pending:            ${jobStats.pending_jobs}`);
  console.log(`└── Running:            ${jobStats.running_jobs}`);
  console.log();
  console.log(`Jobs with 0 events:     ${jobStats.jobs_with_zero_events} (${(jobStats.jobs_with_zero_events / jobStats.total_jobs * 100).toFixed(1)}%)`);
  console.log();
  console.log(`Total Events Scraped:   ${jobStats.total_events_scraped}`);
  console.log(`Total Events Inserted:  ${jobStats.total_events_inserted}`);
  console.log(`Total Duplicates:       ${jobStats.total_duplicates}`);

  // 2. Get actual event count in database
  console.log("\n" + "-".repeat(70) + "\n");
  console.log("📅 EVENTS TABLE OVERVIEW\n");

  const { count: totalEvents } = await supabase
    .from("events")
    .select("*", { count: "exact", head: true });

  const { count: scrapedEvents } = await supabase
    .from("events")
    .select("*", { count: "exact", head: true })
    .not("source_id", "is", null);

  console.log(`Total Events in DB:     ${totalEvents || 0}`);
  console.log(`Events with source_id:  ${scrapedEvents || 0} (from scraper)`);
  console.log(`Manual Events:          ${(totalEvents || 0) - (scrapedEvents || 0)}`);

  // 3. Analyze discrepancy
  console.log("\n" + "-".repeat(70) + "\n");
  console.log("🔍 DISCREPANCY ANALYSIS\n");

  const expectedFromJobs = jobStats.total_events_inserted;
  const actualInDb = scrapedEvents || 0;
  const discrepancy = expectedFromJobs - actualInDb;

  console.log(`Expected from jobs:     ${expectedFromJobs}`);
  console.log(`Actual in database:     ${actualInDb}`);
  console.log(`Discrepancy:            ${discrepancy} (${discrepancy > 0 ? "missing" : "extra"} events)`);

  // 4. Breakdown of where events "went"
  console.log("\n" + "-".repeat(70) + "\n");
  console.log("📊 EVENT FATE BREAKDOWN\n");

  const lostToFailures = jobStats.failed_jobs * 5; // Estimate ~5 events per failed job
  const lostToDuplicates = jobStats.total_duplicates;
  const lostToZeroScrapes = jobStats.jobs_with_zero_events;

  console.log(`If each job *could* produce ~5 events, potential total: ${jobStats.total_jobs * 5}`);
  console.log();
  console.log("Where events 'went':");
  console.log(`├── Successfully inserted:     ${jobStats.total_events_inserted}`);
  console.log(`├── Filtered as duplicates:    ${lostToDuplicates}`);
  console.log(`├── Jobs that scraped 0:       ${lostToZeroScrapes} jobs (empty pages/broken selectors)`);
  console.log(`└── Jobs that failed:          ${jobStats.failed_jobs} jobs`);

  // 5. Top failure reasons
  console.log("\n" + "-".repeat(70) + "\n");
  console.log("❌ TOP FAILURE REASONS\n");

  const failedJobsList = allJobs?.filter(j => j.status === "failed") || [];
  const errorCounts: Record<string, number> = {};

  failedJobsList.forEach(j => {
    const errorKey = j.error_message?.slice(0, 80) || "Unknown error";
    errorCounts[errorKey] = (errorCounts[errorKey] || 0) + 1;
  });

  const sortedErrors = Object.entries(errorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  if (sortedErrors.length === 0) {
    console.log("No failed jobs found!");
  } else {
    sortedErrors.forEach(([error, count], i) => {
      console.log(`${i + 1}. [${count}x] ${error}`);
    });
  }

  // 6. Sources with most zero-event jobs
  console.log("\n" + "-".repeat(70) + "\n");
  console.log("🔧 SOURCES WITH MOST ZERO-EVENT COMPLETIONS\n");

  const { data: zeroEventSources } = await supabase
    .from("scrape_jobs")
    .select("source_id")
    .eq("status", "completed")
    .or("events_scraped.eq.0,events_scraped.is.null");

  const sourceZeroCounts: Record<string, number> = {};
  zeroEventSources?.forEach(j => {
    sourceZeroCounts[j.source_id] = (sourceZeroCounts[j.source_id] || 0) + 1;
  });

  const sortedZeroSources = Object.entries(sourceZeroCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  if (sortedZeroSources.length === 0) {
    console.log("No sources with zero-event jobs!");
  } else {
    // Get source names
    const sourceIds = sortedZeroSources.map(([id]) => id);
    const { data: sourceNames } = await supabase
      .from("scraper_sources")
      .select("id, name")
      .in("id", sourceIds);

    const nameMap = new Map(sourceNames?.map(s => [s.id, s.name]) || []);

    sortedZeroSources.forEach(([sourceId, count], i) => {
      const name = nameMap.get(sourceId) || sourceId.slice(0, 8);
      console.log(`${i + 1}. [${count}x] ${name}`);
    });
  }

  // 7. Duplicate detection breakdown
  console.log("\n" + "-".repeat(70) + "\n");
  console.log("🔄 DUPLICATE DETECTION ANALYSIS\n");

  const jobsWithDuplicates = completedJobs.filter(j => {
    const scraped = j.events_scraped || 0;
    const inserted = j.events_inserted || 0;
    return scraped > 0 && inserted < scraped;
  });

  const highDuplicateJobs = jobsWithDuplicates.filter(j => {
    const scraped = j.events_scraped || 0;
    const inserted = j.events_inserted || 0;
    const dupRate = (scraped - inserted) / scraped;
    return dupRate >= 0.5; // 50%+ duplicate rate
  });

  console.log(`Jobs with any duplicates:       ${jobsWithDuplicates.length}`);
  console.log(`Jobs with >50% duplicate rate:  ${highDuplicateJobs.length}`);
  console.log();
  console.log("This is NORMAL and expected! The scraper deduplicates by:");
  console.log("- Content hash (exact match)");
  console.log("- Event fingerprint (title + date + source)");
  console.log("- Semantic embedding similarity (>95% match)");

  // 8. Summary and recommendations
  console.log("\n" + "=".repeat(70));
  console.log("📝 SUMMARY & RECOMMENDATIONS");
  console.log("=".repeat(70) + "\n");

  const duplicateRatio = jobStats.total_events_scraped > 0 
    ? (jobStats.total_duplicates / jobStats.total_events_scraped * 100).toFixed(1)
    : 0;

  const failureRatio = (jobStats.failed_jobs / jobStats.total_jobs * 100).toFixed(1);
  const zeroEventRatio = (jobStats.jobs_with_zero_events / jobStats.total_jobs * 100).toFixed(1);

  console.log("WHY 1700 JOBS → 520 EVENTS?\n");
  console.log("The discrepancy is due to multiple factors:\n");
  console.log(`1. ❌ FAILED JOBS: ${jobStats.failed_jobs} (${failureRatio}%)`);
  console.log("   - These jobs never produced any events due to errors\n");
  console.log(`2. 📭 ZERO-EVENT JOBS: ${jobStats.jobs_with_zero_events} (${zeroEventRatio}%)`);
  console.log("   - Completed jobs but page was empty/selectors broken\n");
  console.log(`3. 🔄 DUPLICATES: ${jobStats.total_duplicates} events (~${duplicateRatio}% of scraped)`);
  console.log("   - Events already existed in database (by hash/fingerprint)\n");

  if (Number(failureRatio) > 20) {
    console.log("⚠️  RECOMMENDATION: High failure rate. Check:");
    console.log("   - Network connectivity to scraped sites");
    console.log("   - Rate limiting (403/429 errors)");
    console.log("   - Source URLs may have changed\n");
  }

  if (Number(zeroEventRatio) > 30) {
    console.log("⚠️  RECOMMENDATION: Many zero-event jobs. Check:");
    console.log("   - Selector configurations in scraper_sources.config");
    console.log("   - Website structure changes");
    console.log("   - Enable self-healing selector feature\n");
  }

  console.log("✅ CONCLUSION:");
  console.log(`   ${jobStats.total_jobs} jobs processed → ${jobStats.total_events_scraped} events found`);
  console.log(`   → ${jobStats.total_duplicates} were duplicates`);
  console.log(`   → ${jobStats.total_events_inserted} new events inserted`);
  console.log(`   → ${actualInDb} events currently in database`);
}

main();
