/**
 * Deep inspect staging rows to understand data structure
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

console.log("🔍 Deep inspection of staging rows...\n");

// Get all columns from a staging row
const { data: sample, error } = await supabase
  .from("raw_event_staging")
  .select("*")
  .limit(3);

if (error) {
  console.log("❌ Error:", error.message);
} else if (sample && sample.length > 0) {
  console.log("📊 Columns in raw_event_staging:");
  console.log(Object.keys(sample[0]).join(", "));
  
  console.log("\n📊 Sample rows:");
  sample.forEach((row, i) => {
    console.log(`\n--- Row ${i+1} ---`);
    Object.entries(row).forEach(([key, value]) => {
      if (value === null) {
        console.log(`  ${key}: null`);
      } else if (typeof value === 'string' && value.length > 100) {
        console.log(`  ${key}: [string, ${value.length} chars] "${value.substring(0, 100)}..."`);
      } else if (typeof value === 'object') {
        console.log(`  ${key}: [object] ${JSON.stringify(value).substring(0, 100)}...`);
      } else {
        console.log(`  ${key}: ${value}`);
      }
    });
  });
}

// Check processed rows
console.log("\n📊 Processed staging rows (for comparison):");
const { data: completed } = await supabase
  .from("raw_event_staging")
  .select("*")
  .eq("pipeline_status", "processed")
  .limit(2);

completed?.forEach((row, i) => {
  console.log(`\n--- Processed Row ${i+1} ---`);
  Object.entries(row).forEach(([key, value]) => {
    if (value === null) {
      console.log(`  ${key}: null`);
    } else if (typeof value === 'string' && value.length > 100) {
      console.log(`  ${key}: [string, ${value.length} chars] "${value.substring(0, 100)}..."`);
    } else if (typeof value === 'object') {
      console.log(`  ${key}: [object] ${JSON.stringify(value).substring(0, 100)}...`);
    } else {
      console.log(`  ${key}: ${value}`);
    }
  });
});

// Check raw HTML lengths
const { data: htmlLengths } = await supabase
  .from("raw_event_staging")
  .select("id, title, pipeline_status, raw_html, detail_html");

console.log("\n📊 raw_html/detail_html stats:");
let withRawHtml = 0;
let withDetailHtml = 0;
let withNeither = 0;

htmlLengths?.forEach(row => {
  if (row.raw_html && row.raw_html.length > 0) withRawHtml++;
  if (row.detail_html && row.detail_html.length > 0) withDetailHtml++;
  if ((!row.raw_html || row.raw_html.length === 0) && (!row.detail_html || row.detail_html.length === 0)) {
    withNeither++;
  }
});

console.log(`  With raw_html: ${withRawHtml}`);
console.log(`  With detail_html: ${withDetailHtml}`);
console.log(`  With neither: ${withNeither}`);
console.log(`  Total: ${htmlLengths?.length || 0}`);
