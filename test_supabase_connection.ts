import { createClient } from "@supabase/supabase-js";

// Configuration from .env
const SUPABASE_URL = "https://mlpefjsbriqgxcaqxhic.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1scGVmanNicmlxZ3hjYXF4aGljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5MTMwNjMsImV4cCI6MjA4MzQ4OTA2M30.UxuID8hbNO4ZS9qEOJ95QabLPcZ4V_lMXEvp9EuxYZA";

console.log("🔌 Testing Supabase Connection...\n");
console.log("URL:", SUPABASE_URL);

// Create client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testConnection() {
  try {
    // Test 1: Basic connection check
    console.log("\n📡 Test 1: Basic connection check");
    const { data: versionData, error: versionError } =
      await supabase.rpc("version");

    if (versionError) {
      console.log("❌ Version check failed:", versionError.message);
    } else {
      console.log("✅ Connected successfully");
      console.log("   Version:", versionData);
    }

    // Test 2: List tables
    console.log("\n📊 Test 2: Listing tables");
    let tables = null;
    let tablesError = null;
    try {
      const result = await supabase.rpc("get_tables", {
        include_schemas: true,
      });
      tables = result.data;
      tablesError = result.error;
    } catch (e) {
      tablesError = { message: "get_tables RPC not available" };
    }

    if (tablesError) {
      console.log("ℹ️  Could not list tables via RPC (this is expected)");
      console.log("   Alternative: Checking events table directly...");
    } else {
      console.log("✅ Tables found:", tables?.length || 0);
    }

    // Test 3: Query events table
    console.log("\n🎪 Test 3: Querying events table");
    const {
      data: events,
      error: eventsError,
      count,
    } = await supabase
      .from("events")
      .select("*", { count: "exact", head: false })
      .limit(1);

    if (eventsError) {
      console.log("❌ Events query failed:", eventsError.message);
    } else {
      console.log("✅ Events table accessible");
      console.log("   Total events:", count);
      if (events && events.length > 0) {
        console.log("   Sample event:", events[0].title || "Untitled");
      }
    }

    // Test 4: Check profiles table
    console.log("\n👤 Test 4: Querying profiles table");
    const {
      data: profiles,
      error: profilesError,
      count: profileCount,
    } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: false })
      .limit(1);

    if (profilesError) {
      console.log("❌ Profiles query failed:", profilesError.message);
    } else {
      console.log("✅ Profiles table accessible");
      console.log("   Total profiles:", profileCount);
    }

    // Test 5: Test auth service
    console.log("\n🔐 Test 5: Testing auth service");
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      console.log("❌ Auth session check failed:", sessionError.message);
    } else {
      console.log("✅ Auth service accessible");
      console.log("   Current session:", session ? "Active" : "None");
    }

    console.log("\n✅ Supabase connection test completed!");

    return {
      success: true,
      url: SUPABASE_URL,
      eventsCount: count,
      profileCount: profileCount,
      hasSession: !!session,
    };
  } catch (error) {
    console.error("\n❌ Connection test failed:");
    console.error(error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Run the test
testConnection().then((result) => {
  console.log("\n" + "=".repeat(50));
  console.log("FINAL RESULT:");
  console.log("=".repeat(50));
  console.log(JSON.stringify(result, null, 2));
});
