import { memo } from 'react';
import { MapPin, Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';
import { calculateDistanceKm, getDistanceDisplay } from '@/lib/distance';

interface DistanceBadgeProps {
  /** Coordinates of the venue/event location */
  venueCoordinates?: { lat: number; lng: number } | null;
  /** User's current location */
  userLocation?: { lat: number; lng: number } | null;
  /** Whether to show walking time for close distances */
  showWalkTime?: boolean;
  /** Badge size */
  size?: 'sm' | 'md';
  /** Additional CSS classes */
  className?: string;
}

/**
 * DistanceBadge - Displays distance between user and event venue
 * 
 * Works globally - uses coordinates directly from events and user location.
 * If either location is unavailable, the badge is not rendered.
 */
export const DistanceBadge = memo(function DistanceBadge({
  venueCoordinates,
  userLocation,
  showWalkTime = true,
  size = 'md',
  className,
}: DistanceBadgeProps) {
  // Don't render if we don't have both locations
  if (!venueCoordinates || !userLocation) {
    return null;
  }

  const distanceKm = calculateDistanceKm(
    userLocation.lat,
    userLocation.lng,
    venueCoordinates.lat,
    venueCoordinates.lng
  );

  const display = getDistanceDisplay(distanceKm);

  const isVeryClose = distanceKm < 0.1;
  const isWalkable = distanceKm < 2;
  
  // Consistent icon sizes
  const iconSize = size === 'sm' ? 12 : 14;

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
        {display.primary}
      </span>
      {showWalkTime && display.secondary && (
        <>
          <span className="opacity-50">·</span>
          <span className="opacity-75">{display.secondary}</span>
        </>
      )}
    </span>
  );
});