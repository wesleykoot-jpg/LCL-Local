/**
 * Distance utility functions for calculating and formatting distances
 * between user location and event locations
 */

// Meppel center coordinates (default user location)
export const MEPPEL_CENTER = {
  lat: 52.6961,
  lng: 6.1944,
};

// Meppel venue coordinates for mock events
export const MEPPEL_VENUES: Record<string, { lat: number; lng: number }> = {
  'Sportpark Ezinge, Meppel': { lat: 52.6985, lng: 6.1876 },
  'Sportkantine Ezinge': { lat: 52.6985, lng: 6.1876 },
  'Café De Kansel, Woldstraat': { lat: 52.6956, lng: 6.1944 },
  'Wilhelminapark Meppel': { lat: 52.6923, lng: 6.1912 },
  'Wilhelminapark grasveld': { lat: 52.6923, lng: 6.1912 },
  'IJssalon op de Markt': { lat: 52.6961, lng: 6.1938 },
  'Café 1761, Prinsengracht': { lat: 52.6961, lng: 6.1938 },
  'Meppeler Haven (Stouwepad)': { lat: 52.6978, lng: 6.1891 },
  'Schouwburg Ogterop': { lat: 52.6952, lng: 6.1972 },
  'Foyer Schouwburg': { lat: 52.6952, lng: 6.1972 },
  'Hoofdstraat Meppel': { lat: 52.6961, lng: 6.1944 },
  'Luxor Cinema': { lat: 52.6968, lng: 6.192 },
  'De Plataan': { lat: 52.6961, lng: 6.1944 },
  'Café de Plataan': { lat: 52.6961, lng: 6.1944 },
  'De Beurs': { lat: 52.6959, lng: 6.1931 },
  'Reestkerk': { lat: 52.705, lng: 6.195 },
  'Markt Meppel': { lat: 52.6958, lng: 6.1935 },
  'Bibliotheek Meppel': { lat: 52.695, lng: 6.1905 },
  'Alcides': { lat: 52.6898, lng: 6.2012 },
  'Meppel Centrum': { lat: 52.696, lng: 6.192 },
};

/**
 * Calculate distance between two points using Haversine formula
 * @returns Distance in kilometers
 */
export function calculateDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Format distance for display
 * @param distanceKm Distance in kilometers
 * @returns Formatted string like "0.4km away" or "350m away"
 */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 0.1) {
    return 'right here';
  }
  if (distanceKm < 1) {
    const meters = Math.round(distanceKm * 1000 / 50) * 50; // Round to nearest 50m
    return `${meters}m away`;
  }
  return `${distanceKm.toFixed(1)}km away`;
}

/**
 * Estimate walking time based on distance
 * Average walking speed: 5km/h = ~12 min per km
 * @param distanceKm Distance in kilometers
 * @returns Formatted string like "5 min walk" or "< 1 min walk"
 */
export function formatWalkingTime(distanceKm: number): string {
  const minutes = Math.round(distanceKm * 12); // 12 min per km
  if (minutes < 1) return '< 1 min walk';
  if (minutes > 60) {
    const hours = Math.round(minutes / 60);
    return `${hours}h walk`;
  }
  return `${minutes} min walk`;
}

/**
 * Get the best distance display format based on distance
 * Closer = show walking time, farther = show km
 */
export function getDistanceDisplay(distanceKm: number): {
  primary: string;
  secondary?: string;
} {
  if (distanceKm < 0.1) {
    return { primary: 'right here' };
  }
  if (distanceKm < 2) {
    // For close distances, show walking time as primary
    return {
      primary: formatWalkingTime(distanceKm),
      secondary: formatDistance(distanceKm),
    };
  }
  // For farther distances, show km
  return {
    primary: formatDistance(distanceKm),
  };
}

/**
 * Get coordinates for a venue name, with fallback to Meppel center
 * Supports fuzzy matching for venue names
 */
export function getVenueCoordinates(venueName: string): { lat: number; lng: number } {
  // Try exact match first
  if (MEPPEL_VENUES[venueName]) {
    return MEPPEL_VENUES[venueName];
  }
  
  // Try fuzzy match (case insensitive, partial match)
  const lowerVenue = venueName.toLowerCase();
  for (const [key, coords] of Object.entries(MEPPEL_VENUES)) {
    if (lowerVenue.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerVenue)) {
      return coords;
    }
  }
  
  // Default to Meppel center
  return MEPPEL_CENTER;
}
