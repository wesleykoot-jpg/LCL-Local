// run_process_worker_loop.ts
// Triggers process-worker repeatedly until all pending rows are processed

const loadEnv = async () => {
    const envText = await Deno.readTextFile(".env");
    envText.split("\n").forEach((line) => {
        const [key, ...val] = line.split("=");
        if (key && val.length > 0) {
            const v = val.join("=").trim().replace(/^["']|["']$/g, "");
            Deno.env.set(key.trim(), v);
        }
    });
    console.log("Loading .env from:", Deno.cwd() + "/.env");
};

async function main() {
    await loadEnv();
    
    // Dynamic import after env is loaded
    const { createClient } = await import("npm:@supabase/supabase-js@2.49.1");
    const { supabaseUrl, supabaseServiceRoleKey } = await import("./supabase/functions/_shared/env.ts");
    
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    let totalProcessed = 0;
    let hasPending = true;
    let batchCount = 0;
    
    while (hasPending) {
        batchCount++;
        console.log(`\n--- Batch ${batchCount} (Total processed: ${totalProcessed}) ---`);
        
        // Trigger process-worker via HTTP
        try {
            const res = await fetch(`${supabaseUrl}/functions/v1/process-worker`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${supabaseServiceRoleKey}`,
                    "Content-Type": "application/json"
                }
            });
            
            const txt = await res.text();
            console.log("Response:", txt);
            
            try {
                const json = JSON.parse(txt);
                if (json.message === "No pending rows" || json.processed === 0) {
                    console.log("No more pending rows. Finishing.");
                    hasPending = false;
                } else {
                    totalProcessed += (json.processed || 0);
                    // Small delay to be nice to rate limits
                    await new Promise(r => setTimeout(r, 2000));
                }
            } catch (e) {
                console.error("Failed to parse response:", txt);
                hasPending = false;
            }
        } catch (e) {
            console.error("HTTP request failed:", e);
            hasPending = false;
        }
    }
    
    // Final count
    const { count: eventCount } = await supabase.from("events").select("*", { count: "exact", head: true });
    const { count: stagingCount } = await supabase.from("raw_event_staging").select("*", { count: "exact", head: true });
    
    console.log("\n=== Final Stats ===");
    console.log("Total batches processed:", batchCount);
    console.log("Total rows processed:", totalProcessed);
    console.log("Events in DB:", eventCount);
    console.log("Staging rows:", stagingCount);
}

main().catch((e) => console.error("Error:", e));
