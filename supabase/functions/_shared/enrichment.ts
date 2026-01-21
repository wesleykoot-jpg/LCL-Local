import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Geocodes an address string to {lat, lng} using Mapbox (preferred) or Google Maps.
 * Returns null if failing.
 */
export async function geocodeLocation(
  address: string,
  mapboxToken?: string
): Promise<{ lat: number; lng: number } | null> {
  if (!address || address.length < 5) return null;
  if (!mapboxToken) {
    console.warn("Geocoding skipped: No Mapbox token provided");
    return null;
  }

  try {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${mapboxToken}&limit=1&types=address,poi`;
    
    const res = await fetch(url);
    if (!res.ok) {
        console.warn(`Geocoding failed: ${res.statusText}`);
        return null;
    }

    const data = await res.json();
    if (data.features && data.features.length > 0) {
      const [lng, lat] = data.features[0].center;
      return { lat, lng };
    }
  } catch (err) {
    console.error("Geocoding error:", err);
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
  eventId: string
): Promise<string | null> {
  if (!imageUrl || !imageUrl.startsWith('http')) return null;

  try {
    // 1. Download
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
    const blob = await response.blob();

    // 2. Optimization (Skipped for now in Edge Runtime - minimal resizing tools available without external APIs)
    // Ideally we would use ImageMagick or a third-party service here.
    // For now, we just upload the raw blob to prevent broken links.

    // 3. Upload to Supabase Storage
    const fileExt = imageUrl.split('.').pop()?.split(/[?#]/)[0] || 'jpg';
    const filePath = `events/${eventId}/cover.${fileExt}`;

    const { data: _data, error } = await supabase.storage
      .from('event-images')
      .upload(filePath, blob, {
        contentType: blob.type || 'image/jpeg',
        upsert: true
      });

    if (error) throw error;

    // 4. Get Public URL
    const { data: { publicUrl } } = supabase.storage
      .from('event-images')
      .getPublicUrl(filePath);

    return publicUrl;
  } catch (err) {
    console.warn("Image optimization/upload failed:", err);
    return null; // Fallback to original URL if caller chooses
  }
}
