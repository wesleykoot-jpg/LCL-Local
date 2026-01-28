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

console.log("=== AI Job Queue Structure ===\n");

const { data, error } = await supabase
  .from("ai_job_queue")
  .select("*")
  .limit(5);

if (error) {
  console.error("Error:", error);
} else {
  console.log(`Found ${data?.length || 0} jobs in queue\n`);
  
  if (data && data.length > 0) {
    console.log("Sample job:");
    console.log(JSON.stringify(data[0], null, 2));
  } else {
    console.log("Queue is empty");
  }
  
  // Show structure from first row or empty structure
  if (data && data[0]) {
    console.log("\nTable columns:");
    Object.keys(data[0]).forEach(key => {
      console.log(`  - ${key}: ${typeof data[0][key]}`);
    });
  }
}

// Check total count
const { count } = await supabase
  .from("ai_job_queue")
  .select("*", { count: "exact", head: true });

console.log(`\nTotal jobs in ai_job_queue: ${count || 0}`);
