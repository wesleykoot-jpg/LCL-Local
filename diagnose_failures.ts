/**
 * Diagnose why staging items are failing to process
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const envText = await Deno.readTextFile(".env");
const env: Record<string, string> = {};
envText.split("\n").forEach((line) => {
  const [key, ...val] = line.split("=");
  if (key && val.length > 0) {
    env[key.trim()] = val.join("=").trim().replace(/^["']|["']$/g, "");
  }
});

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

console.log("🔍 Diagnosing staging failures...\n");

// Check failed items
const { data: failed, error: failedErr } = await supabase
  .from("raw_event_staging")
  .select("id, title, status, source_url, raw_html, error_message, retry_count, created_at")
  .eq("status", "failed")
  .limit(10);

if (failedErr) {
  console.log("❌ Error fetching failed items:", failedErr.message);
} else {
  console.log(`📊 Failed items: ${failed?.length || 0}`);
  failed?.forEach((f, i) => {
    console.log(`\n${i+1}. ID: ${f.id}`);
    console.log(`   Title: ${f.title || 'N/A'}`);
    console.log(`   Error: ${f.error_message || 'No error message'}`);
    console.log(`   Retry count: ${f.retry_count}`);
    console.log(`   Has raw_html: ${!!f.raw_html} (length: ${f.raw_html?.length || 0})`);
    console.log(`   Source URL: ${f.source_url?.substring(0, 60) || 'N/A'}`);
  });
}

// Check quarantined items
const { data: quarantined } = await supabase
  .from("raw_event_staging")
  .select("id, title, status, error_message")
  .eq("status", "quarantined");

console.log(`\n📊 Quarantined items: ${quarantined?.length || 0}`);

// Check DLQ
const { data: dlq, error: dlqErr } = await supabase
  .from("dead_letter_queue")
  .select("*")
  .limit(5);

if (dlqErr) {
  console.log("Note: DLQ table may not exist or error:", dlqErr.message);
} else {
  console.log(`\n📊 Dead Letter Queue: ${dlq?.length || 0} items`);
  dlq?.forEach((d, i) => {
    console.log(`   ${i+1}. Stage: ${d.stage}, Error: ${d.error?.substring(0, 80)}...`);
  });
}

// Check error_logs
const { data: errorLogs, error: errorLogsErr } = await supabase
  .from("error_logs")
  .select("*")
  .order("created_at", { ascending: false })
  .limit(10);

if (errorLogsErr) {
  console.log("Note: error_logs table error:", errorLogsErr.message);
} else {
  console.log(`\n📊 Recent error_logs: ${errorLogs?.length || 0}`);
  errorLogs?.forEach((e, i) => {
    console.log(`   ${i+1}. [${e.function_name}] ${e.error_message?.substring(0, 80)}...`);
  });
}

// Show status breakdown
const { data: allStaging } = await supabase
  .from("raw_event_staging")
  .select("status");

const statusCounts: Record<string, number> = {};
allStaging?.forEach(r => {
  statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
});
console.log("\n📊 Current staging status breakdown:", statusCounts);

// Get sample of raw_html to understand data
console.log("\n📊 Sample staging row data:");
const { data: sample } = await supabase
  .from("raw_event_staging")
  .select("id, title, raw_html, source_id, source_url")
  .limit(1);

if (sample && sample[0]) {
  console.log(`   ID: ${sample[0].id}`);
  console.log(`   Title: ${sample[0].title}`);
  console.log(`   Source ID: ${sample[0].source_id}`);
  console.log(`   Raw HTML preview: ${sample[0].raw_html?.substring(0, 200)}...`);
}
