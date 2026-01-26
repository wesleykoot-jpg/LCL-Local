/**
 * Reverse geocode coordinates to get city name using BigDataCloud API
 * @param lat Latitude
 * @param lng Longitude
 * @returns City name or null if failed
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<string | null> {
  try {
    const response = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
    );

    if (!response.ok) {
      console.warn("[Geocoding] Reverse geocode failed:", response.statusText);
      return null;
    }

    const data = await response.json();

    // Prefer city, then locality, then principalSubdivision
    const cityName =
      data.city || data.locality || data.principalSubdivision || null;

    return cityName;
  } catch (error) {
    console.warn("[Geocoding] Reverse geocode error:", error);
    return null;
  }
}
