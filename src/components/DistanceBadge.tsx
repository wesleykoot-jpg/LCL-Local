import { memo, useMemo } from 'react';
import { MapPin, Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';
import { calculateDistanceKm, getDistanceDisplay } from '@/lib/distance';

interface DistanceBadgeProps {
  /** Pre-calculated distance in meters from database (PostGIS) */
  distMeters?: number | null;
  /** Coordinates of the venue/event location */
  venueCoordinates?: { lat: number; lng: number } | null;
  /** User's current location */
  userLocation?: { lat: number; lng: number } | null;
  /** City name as fallback when coordinates are unavailable */
  city?: string | null;
  /** Whether to show walking time for close distances */
  showWalkTime?: boolean;
  /** Badge size */
  size?: 'sm' | 'md';
  /** Additional CSS classes */
  className?: string;
}

/**
 * Format distance using Intl.NumberFormat for consistent display
 * @param distanceKm Distance in kilometers
 * @returns Formatted distance string (e.g., "1.2 km" or "350 m")
 */
function formatDistanceIntl(distanceKm: number): string {
  if (distanceKm < 0.1) {
    return 'right here';
  }
  if (distanceKm < 1) {
    // Use meters for short distances
    const meters = Math.round(distanceKm * 1000);
    return new Intl.NumberFormat('en', { 
      style: 'unit', 
      unit: 'meter',
      maximumFractionDigits: 0 
    }).format(meters);
  }
  // Use km for longer distances
  return new Intl.NumberFormat('en', { 
    style: 'unit', 
    unit: 'kilometer',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1 
  }).format(distanceKm);
}

/**
 * DistanceBadge - Displays distance between user and event venue
 * 
 * Priority logic:
 * 1. Database distance (dist_meters from PostGIS)
 * 2. Client-side calculation (if user location and venue coordinates available)
 * 3. City name fallback (if coordinates missing but city available)
 * 4. "Location Unknown" as final fallback
 */
export const DistanceBadge = memo(function DistanceBadge({
  distMeters,
  venueCoordinates,
  userLocation,
  city,
  showWalkTime = true,
  size = 'md',
  className,
}: DistanceBadgeProps) {
  // Calculate distance and determine display mode
  const { distanceKm, displayMode } = useMemo(() => {
    // Priority 1: Use dist_meters from database (PostGIS)
    if (typeof distMeters === 'number' && distMeters >= 0) {
      return { distanceKm: distMeters / 1000, displayMode: 'distance' as const };
    }
    
    // Priority 2: Client-side calculation
    if (venueCoordinates && userLocation) {
      const km = calculateDistanceKm(
        userLocation.lat,
        userLocation.lng,
        venueCoordinates.lat,
        venueCoordinates.lng
      );
      return { distanceKm: km, displayMode: 'distance' as const };
    }
    
    // Priority 3: City fallback
    if (city && city.trim()) {
      return { distanceKm: null, displayMode: 'city' as const };
    }
    
    // Priority 4: Final fallback
    return { distanceKm: null, displayMode: 'unknown' as const };
  }, [distMeters, venueCoordinates, userLocation, city]);

  // Consistent icon sizes
  const iconSize = size === 'sm' ? 12 : 14;

  // Render based on display mode
  if (displayMode === 'distance' && distanceKm !== null) {
    const display = getDistanceDisplay(distanceKm);
    const formattedDistance = formatDistanceIntl(distanceKm);
    const isVeryClose = distanceKm < 0.1;
    const isWalkable = distanceKm < 2;

    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 text-muted-foreground',
          size === 'sm' ? 'text-[13px]' : 'text-[14px]',
          isVeryClose && 'text-primary',
          className
        )}
      >
        {isWalkable ? (
          <Navigation size={iconSize} className={cn(isVeryClose && 'text-primary')} />
        ) : (
          <MapPin size={iconSize} />
        )}
        <span className={cn('font-medium', isVeryClose && 'text-primary')}>
          {isVeryClose ? display.primary : formattedDistance}
        </span>
        {showWalkTime && display.secondary && (
          <>
            <span className="opacity-50">·</span>
            <span className="opacity-75">{display.secondary}</span>
          </>
        )}
      </span>
    );
  }

  if (displayMode === 'city' && city) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 text-muted-foreground',
          size === 'sm' ? 'text-[13px]' : 'text-[14px]',
          className
        )}
      >
        <MapPin size={iconSize} />
        <span className="font-medium">{city}</span>
      </span>
    );
  }

  // Final fallback: Location Unknown
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-muted-foreground',
        size === 'sm' ? 'text-[13px]' : 'text-[14px]',
        className
      )}
    >
      <MapPin size={iconSize} />
      <span className="font-medium">Location Unknown</span>
    </span>
  );
});