import { memo, useMemo } from 'react';
import { calculateDistanceKm } from '@/lib/distance';

interface User {
  id: string;
  image: string;
  alt: string;
  /** User's current location for proximity detection */
  location?: { lat: number; lng: number } | null;
}

interface FacepileProps {
  users: User[];
  extraCount?: number;
  /** Current device location for proximity calculations */
  deviceLocation?: { lat: number; lng: number } | null;
  /** Proximity threshold in km (default: 1km) */
  proximityThresholdKm?: number;
}

// Proximity threshold for applying pulse animation (1km = 1000m)
const DEFAULT_PROXIMITY_THRESHOLD_KM = 1;

/**
 * Check if a user is within proximity of the device
 */
function isUserNearby(
  user: User,
  deviceLocation: { lat: number; lng: number } | null | undefined,
  thresholdKm: number
): boolean {
  if (!deviceLocation || !user.location) return false;
  
  const distance = calculateDistanceKm(
    deviceLocation.lat,
    deviceLocation.lng,
    user.location.lat,
    user.location.lng
  );
  
  return distance <= thresholdKm;
}

/**
 * Displays a row of overlapping user avatars with IO26 proximity awareness.
 * Users within the proximity threshold display a ProximityPulse animation.
 */
export const Facepile = memo(function Facepile({ 
  users, 
  extraCount = 0,
  deviceLocation,
  proximityThresholdKm = DEFAULT_PROXIMITY_THRESHOLD_KM,
}: FacepileProps) {
  // Pre-compute which users are nearby
  const nearbyUserIds = useMemo(() => {
    if (!deviceLocation) return new Set<string>();
    
    return new Set(
      users
        .filter(user => isUserNearby(user, deviceLocation, proximityThresholdKm))
        .map(user => user.id)
    );
  }, [users, deviceLocation, proximityThresholdKm]);

  if (users.length === 0) return null;

  return (
    <div className="flex items-center h-8">
      <div className="flex -space-x-2">
        {users.slice(0, 6).map((user, index) => {
          const isNearby = nearbyUserIds.has(user.id);
          
          return (
            <div
              key={user.id || index}
              className="relative"
              style={{ zIndex: users.length - index }}
            >
              {/* IO26: ProximityPulse ring for nearby users */}
              {isNearby && (
                <div 
                  className="proximity-pulse-ring"
                  style={{ 
                    '--proximity-color': 'hsl(var(--primary))',
                  } as React.CSSProperties}
                  aria-hidden="true"
                />
              )}
              <div
                className={`w-8 h-8 rounded-full border-2 overflow-hidden bg-muted ${
                  isNearby 
                    ? 'border-primary' 
                    : 'border-background'
                }`}
              >
                <img
                  src={user.image}
                  alt={user.alt}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback to initials on error
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      {extraCount > 0 && (
        <span className="ml-2 text-[13px] text-muted-foreground font-medium">
          +{extraCount} meer
        </span>
      )}
    </div>
  );
});