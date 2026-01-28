/**
 * Check error logs
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

// Get the most recent error logs with full details
const { data: logs, error } = await supabase
  .from("error_logs")
  .select("*")
  .order("created_at", { ascending: false })
  .limit(5);

if (error) {
  console.log("Error:", error.message);
} else {
  console.log("Recent error logs:");
  logs?.forEach((log, i) => {
    console.log(`\n--- Error ${i+1} ---`);
    console.log(JSON.stringify(log, null, 2));
  });
}
