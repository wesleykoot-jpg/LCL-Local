/**
 * Travel Time Estimation Utility
 * 
 * Provides travel time estimates between locations based on distance.
 * Uses configurable average speeds for different travel modes.
 * 
 * Note: These are estimates only. For accurate travel times,
 * integrate with a routing API like Google Directions or OSRM.
 */

/**
 * Average travel speeds in km/h for different modes
 */
export const TRAVEL_SPEEDS = {
  walking: 5,      // Average walking speed
  cycling: 15,     // Average city cycling speed
  car: 40,         // Average city driving speed (accounting for traffic)
  transit: 25,     // Average public transit speed (including wait times)
} as const;

export type TravelMode = keyof typeof TRAVEL_SPEEDS;

export interface TravelTimeResult {
  /** Estimated travel time in minutes */
  minutes: number;
  /** Distance in kilometers */
  distanceKm: number;
  /** Travel mode used for calculation */
  mode: TravelMode;
  /** Human-readable label (e.g., "🚕 15 min") */
  label: string;
}

/**
 * Calculate distance between two points using Haversine formula
 * 
 * @param lat1 - Latitude of first point
 * @param lng1 - Longitude of first point
 * @param lat2 - Latitude of second point
 * @param lng2 - Longitude of second point
 * @returns Distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Get the appropriate travel mode emoji
 */
function getTravelModeEmoji(mode: TravelMode): string {
  switch (mode) {
    case 'walking':
      return '🚶';
    case 'cycling':
      return '🚴';
    case 'car':
      return '🚕';
    case 'transit':
      return '🚌';
    default:
      return '🚗';
  }
}

/**
 * Suggest the best travel mode based on distance
 */
export function suggestTravelMode(distanceKm: number): TravelMode {
  if (distanceKm < 1) {
    return 'walking';
  } else if (distanceKm < 5) {
    return 'cycling';
  } else if (distanceKm < 15) {
    return 'transit';
  } else {
    return 'car';
  }
}

/**
 * Estimate travel time between two coordinates
 * 
 * @param from - Starting coordinates {lat, lng}
 * @param to - Destination coordinates {lat, lng}
 * @param mode - Travel mode (optional, will be auto-suggested if not provided)
 * @returns TravelTimeResult with estimated time and distance
 */
export function estimateTravelTime(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  mode?: TravelMode
): TravelTimeResult {
  const distanceKm = calculateDistance(from.lat, from.lng, to.lat, to.lng);
  
  // Use suggested mode if not provided
  const travelMode = mode || suggestTravelMode(distanceKm);
  const speedKmh = TRAVEL_SPEEDS[travelMode];
  
  // Calculate time in hours, then convert to minutes
  const timeHours = distanceKm / speedKmh;
  const timeMinutes = Math.round(timeHours * 60);
  
  // Ensure minimum 1 minute for very short distances
  const minutes = Math.max(1, timeMinutes);
  
  const emoji = getTravelModeEmoji(travelMode);
  const label = `${emoji} ${minutes} min`;
  
  return {
    minutes,
    distanceKm: Math.round(distanceKm * 10) / 10, // Round to 1 decimal
    mode: travelMode,
    label,
  };
}

/**
 * Format travel time for display in UI
 * 
 * @param minutes - Travel time in minutes
 * @param mode - Travel mode for emoji
 * @returns Formatted string like "🚕 15 min" or "🚶 5 min"
 */
export function formatTravelTime(minutes: number, mode: TravelMode = 'car'): string {
  const emoji = getTravelModeEmoji(mode);
  
  if (minutes < 60) {
    return `${emoji} ${minutes} min`;
  } else {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) {
      return `${emoji} ${hours} uur`;
    }
    return `${emoji} ${hours}u ${mins}m`;
  }
}

/**
 * Estimate travel time between two events
 * Extracts coordinates from PostGIS POINT format or structured location
 * 
 * @param fromLocation - Location of first event (PostGIS POINT or {lat, lng})
 * @param toLocation - Location of second event
 * @returns TravelTimeResult or null if coordinates cannot be extracted
 */
export function estimateTravelTimeBetweenEvents(
  fromLocation: unknown,
  toLocation: unknown
): TravelTimeResult | null {
  const from = parseLocation(fromLocation);
  const to = parseLocation(toLocation);
  
  if (!from || !to) {
    return null;
  }
  
  return estimateTravelTime(from, to);
}

/**
 * Parse location from various formats
 * Supports PostGIS POINT string, {lat, lng} object, or {coordinates: {lat, lng}}
 */
export function parseLocation(
  location: unknown
): { lat: number; lng: number } | null {
  if (!location) return null;
  
  // Handle PostGIS POINT format: "POINT(lng lat)" or "SRID=4326;POINT(lng lat)"
  if (typeof location === 'string') {
    const match = location.match(/POINT\s*\(\s*([+-]?\d+\.?\d*)\s+([+-]?\d+\.?\d*)\s*\)/i);
    if (match) {
      return {
        lng: parseFloat(match[1]),
        lat: parseFloat(match[2]),
      };
    }
    return null;
  }
  
  // Handle {lat, lng} object
  if (typeof location === 'object' && location !== null) {
    const loc = location as Record<string, unknown>;
    
    // Direct lat/lng properties
    if (typeof loc.lat === 'number' && typeof loc.lng === 'number') {
      return { lat: loc.lat, lng: loc.lng };
    }
    
    // Nested coordinates object
    if (loc.coordinates && typeof loc.coordinates === 'object') {
      const coords = loc.coordinates as Record<string, unknown>;
      if (typeof coords.lat === 'number' && typeof coords.lng === 'number') {
        return { lat: coords.lat, lng: coords.lng };
      }
    }
  }
  
  return null;
}
