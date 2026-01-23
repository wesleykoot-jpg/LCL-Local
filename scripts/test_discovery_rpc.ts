import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

// Load env vars
// Adjusted to look in the current directory since we run from root
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testDiscoveryRails() {
  console.log("Testing get_discovery_rails RPC...");

  const userId = "00000000-0000-0000-0000-000000000000"; // Anonymous
  const userLocation = { lat: 53.2194, lng: 6.5665 }; // Groningen
  const radiusKm = 25;

  console.log("Params:", { userId, userLocation, radiusKm });

  try {
    const { data, error } = await supabase.rpc("get_discovery_rails", {
      p_user_id: userId,
      p_user_lat: userLocation.lat,
      p_user_long: userLocation.lng,
      p_radius_km: radiusKm,
      p_limit_per_rail: 10,
    });

    if (error) {
      console.error("RPC Error:", error);
    } else {
      console.log("RPC Success. Data:", JSON.stringify(data, null, 2));

      const sections = (data as any)?.sections;
      if (!sections || sections.length === 0) {
        console.warn("WARNING: No sections returned!");
      } else {
        console.log(`Received ${sections.length} sections.`);
        sections.forEach((s: any) => {
          console.log(`- ${s.title}: ${s.items.length} items`);
        });
      }
    }
  } catch (err) {
    console.error("Unexpected error:", err);
  }
}

testDiscoveryRails();
