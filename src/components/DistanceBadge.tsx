import { memo } from 'react';
import { MapPin, Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  calculateDistanceKm, 
  getDistanceDisplay, 
  getVenueCoordinates,
  MEPPEL_CENTER 
} from '@/lib/distance';

interface DistanceBadgeProps {
  venueName: string;
  userLocation?: { lat: number; lng: number };
  showWalkTime?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export const DistanceBadge = memo(function DistanceBadge({
  venueName,
  userLocation = MEPPEL_CENTER,
  showWalkTime = true,
  size = 'md',
  className,
}: DistanceBadgeProps) {
  const venueCoords = getVenueCoordinates(venueName);
  const distanceKm = calculateDistanceKm(
    userLocation.lat,
    userLocation.lng,
    venueCoords.lat,
    venueCoords.lng
  );

  const display = getDistanceDisplay(distanceKm);

  const isVeryClose = distanceKm < 0.1;
  const isWalkable = distanceKm < 2;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-muted-foreground',
        size === 'sm' ? 'text-xs' : 'text-sm',
        isVeryClose && 'text-primary',
        className
      )}
    >
      {isWalkable ? (
        <Navigation size={size === 'sm' ? 10 : 12} className={cn(isVeryClose && 'text-primary')} />
      ) : (
        <MapPin size={size === 'sm' ? 10 : 12} />
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
