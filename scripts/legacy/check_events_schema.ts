
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log("Checking events table schema...");

    // Try to insert a dummy event with a random category to see if it fails
    // (Introspection is hard via client, trial by fire is faster)

    const dummy = {
        title: "Schema Test",
        event_date: "2026-01-01",
        event_time: "12:00",
        venue_name: "Test",
        event_fingerprint: "test-" + Date.now(),
        content_hash: "test-" + Date.now(),
        source_id: "00000000-0000-0000-0000-000000000000", // Need valid uuid?
        category: "EXPERIMENTAL_CATEGORY_" + Date.now()
    };

    // We need a valid source ID? No, insert returns error if FK fail.
    // But category check happens before FK usually? Or DB error?
    // Actually, let's just use `0000...` if FK exists. If not, we might fail on FK.

    // Better: RPC "get_column_types"?
    // Or just try insert.

    const { error } = await supabase.from("events").insert(dummy);

    if (error) {
        console.log("Insert Error:", error.message);
        if (error.message.includes("invalid input value for enum")) {
            console.log("CONCLUSION: Category is ENUM.");
        } else if (error.message.includes("foreign key constraint")) {
            console.log("CONCLUSION: Insert failed on FK (expected), but Category NOT rejected immediately.");
            console.log("Create Source first?");
            // If FK failed, it means Category passed Check Constraint?
            // Not necessarily.
        } else {
            console.log("Unknown error.");
        }
    } else {
        console.log("CONCLUSION: Category accepted arbitrary text. (Deleting test event...)");
        await supabase.from("events").delete().eq("title", "Schema Test");
    }
}

main();
