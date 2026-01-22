import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Geocodes an address string to {lat, lng} using Nominatim (OpenStreetMap).
 * Returns null if failing.
 */
/**
 * Geocodes an address string to {lat, lng}.
 * Priority 1: Local verified_venues table (Free & Accurate)
 * Priority 2: Nominatim (OpenStreetMap) fallback
 */
export async function geocodeLocation(
  supabase: SupabaseClient,
  address: string,
): Promise<{ lat: number; lng: number } | null> {
  if (!address || address.length < 3) return null;

  try {
    // PHASE 1: Local Verified Register (FREE)
    const cleanAddress = address.trim();
    const { data: localVenue } = await supabase
      .from("verified_venues")
      .select("name, location")
      .or(`name.ilike.${cleanAddress},aliases.cs.{${cleanAddress}}`)
      .maybeSingle();

    if (localVenue?.location) {
      // Parse PostGIS 'POINT(lng lat)'
      const match = localVenue.location.match(/POINT\(([-\d.]+) ([-\d.]+)\)/);
      if (match) {
        console.log(
          `📍 Local Match: "${address}" mapped to "${localVenue.name}"`,
        );
        return { lng: parseFloat(match[1]), lat: parseFloat(match[2]) };
      }
    }

    // PHASE 2: Nominatim Fallback
    const encodedAddress = encodeURIComponent(address + ", Netherlands");
    const url = `https://nominatim.openstreetmap.org/search?q=${encodedAddress}&format=json&limit=1`;

    const res = await fetch(url, {
      headers: {
        "User-Agent": "LCL-Local-Scraper/1.0",
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        if (!isNaN(lat) && !isNaN(lng)) {
          console.log(
            `🌍 Geocoded "${address}" to (${lat}, ${lng}) via Nominatim`,
          );
          return { lat, lng };
        }
      }
    }
  } catch (err) {
    console.error("Geocoding failed:", err);
  }

  return null;
}

/**
 * Downloads an image from a remote URL, optimizes/resizes it (conceptually),
 * and uploads it to Supabase Storage.
 * Returns the public URL of the stored image.
 */
export async function optimizeImage(
  supabase: SupabaseClient,
  imageUrl: string,
  eventId: string,
): Promise<string | null> {
  if (!imageUrl || !imageUrl.startsWith("http")) return null;

  try {
    // 1. Download
    const response = await fetch(imageUrl);
    if (!response.ok)
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    const blob = await response.blob();

    // 2. Optimization (Skipped for now in Edge Runtime - minimal resizing tools available without external APIs)
    // Ideally we would use ImageMagick or a third-party service here.
    // For now, we just upload the raw blob to prevent broken links.

    // 3. Upload to Supabase Storage
    const fileExt = imageUrl.split(".").pop()?.split(/[?#]/)[0] || "jpg";
    const filePath = `events/${eventId}/cover.${fileExt}`;

    const { data: _data, error } = await supabase.storage
      .from("event-images")
      .upload(filePath, blob, {
        contentType: blob.type || "image/jpeg",
        upsert: true,
      });

    if (error) throw error;

    // 4. Get Public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("event-images").getPublicUrl(filePath);

    return publicUrl;
  } catch (err) {
    console.warn("Image optimization/upload failed:", err);
    return null; // Fallback to original URL if caller chooses
  }
}
