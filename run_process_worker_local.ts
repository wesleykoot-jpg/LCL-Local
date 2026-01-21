// run_process_worker_local.ts
// Runs process-worker locally (not via HTTP) to use latest code changes

const loadEnv = async () => {
    const envText = await Deno.readTextFile(".env");
    envText.split("\n").forEach((line) => {
        const [key, ...val] = line.split("=");
        if (key && val.length > 0) {
            const v = val.join("=").trim().replace(/^["']|["']$/g, "");
            Deno.env.set(key.trim(), v);
        }
    });
    console.log("Environment loaded");
};

async function main() {
    await loadEnv();
    
    // Dynamic import after env is loaded
    const { createClient } = await import("npm:@supabase/supabase-js@2.49.1");
    const { supabaseUrl, supabaseServiceRoleKey } = await import("./supabase/functions/_shared/env.ts");
    
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    let totalProcessed = 0;
    let totalSucceeded = 0;
    let totalFailed = 0;
    let batchCount = 0;
    let hasPending = true;
    
    while (hasPending && batchCount < 200) { // Safety limit
        batchCount++;
        console.log(`\n--- Batch ${batchCount} ---`);
        
        // Import the handler locally
        const { default: handler } = await import("./supabase/functions/process-worker/index.ts");
        
        try {
            const req = new Request("http://localhost/process-worker", { method: "POST" });
            const res = await handler(req);
            const txt = await res.text();
            
            try {
                const json = JSON.parse(txt);
                console.log("Response:", json);
                
                if (json.message === "No pending rows" || json.processed === 0) {
                    console.log("No more pending rows.");
                    hasPending = false;
                } else {
                    totalProcessed += (json.processed || 0);
                    totalSucceeded += (json.succeeded || 0);
                    totalFailed += (json.failed || 0);
                    
                    // Small delay
                    await new Promise(r => setTimeout(r, 1000));
                }
            } catch (e) {
                console.error("Failed to parse response:", txt);
                hasPending = false;
            }
        } catch (e) {
            console.error("Handler error:", e);
            hasPending = false;
        }
    }
    
    // Final stats
    const { count: eventCount } = await supabase.from("events").select("*", { count: "exact", head: true });
    
    console.log("\n=== Final Stats ===");
    console.log("Total batches:", batchCount);
    console.log("Total processed:", totalProcessed);
    console.log("Total succeeded:", totalSucceeded);
    console.log("Total failed:", totalFailed);
    console.log("Events in DB:", eventCount);
}

main().catch((e) => console.error("Error:", e));
