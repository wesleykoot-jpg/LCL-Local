// Edge Function to retroactively geocode events with missing coordinates
// Can be called manually or via cron job

import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { supabaseUrl, supabaseServiceRoleKey } from "../_shared/env.ts";

async function geocodeLocation(address: string): Promise<{ lat: number; lng: number } | null> {
  if (!address || address.length < 5) return null;

  try {
    const encodedAddress = encodeURIComponent(address + ", Netherlands");
    const url = `https://nominatim.openstreetmap.org/search?q=${encodedAddress}&format=json&limit=1`;
    
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'LCL-Local-Backfill/1.0 (https://lcl.social)'
      }
    });
    
    if (res.ok) {
      const data = await res.json();
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        if (!isNaN(lat) && !isNaN(lng)) {
          return { lat, lng };
        }
      }
    }
  } catch (err) {
    console.error("Geocoding failed:", err);
  }

  return null;
}

export const handler = async (req: Request): Promise<Response> => {
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  
  try {
    const { batchSize = 10 } = await req.json().catch(() => ({ batchSize: 10 }));
    
    // Find events with missing coordinates
    const { data: events, error: fetchError } = await supabase
      .from("events")
      .select("id, venue_name, title")
      .or("location.is.null,location.eq.POINT(0 0)")
      .limit(batchSize);
    
    if (fetchError) throw fetchError;
    if (!events || events.length === 0) {
      return new Response(JSON.stringify({ 
        message: "No events need geocoding",
        processed: 0 
      }), { status: 200 });
    }

    let successCount = 0;
    let failedCount = 0;

    for (const event of events) {
      const query = event.venue_name || event.title;
      
      if (!query) {
        failedCount++;
        continue;
      }

      const coords = await geocodeLocation(query);
      
      if (coords) {
        const { error: updateError } = await supabase
          .from("events")
          .update({ 
            location: `POINT(${coords.lng} ${coords.lat})`
          })
          .eq("id", event.id);
        
        if (updateError) {
          console.error(`Failed to update event ${event.id}:`, updateError);
          failedCount++;
        } else {
          console.log(`✅ Geocoded "${query}" to (${coords.lat}, ${coords.lng})`);
          successCount++;
        }
      } else {
        console.log(`❌ Could not geocode "${query}"`);
        failedCount++;
      }
      
      // Respect Nominatim rate limit (1 req/sec)
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return new Response(JSON.stringify({
      message: "Backfill complete",
      processed: events.length,
      succeeded: successCount,
      failed: failedCount
    }), { 
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error("Backfill error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};

Deno.serve(handler);
