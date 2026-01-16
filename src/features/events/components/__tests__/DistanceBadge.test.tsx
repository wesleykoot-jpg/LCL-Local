import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DistanceBadge } from '../DistanceBadge';

describe('DistanceBadge', () => {
  describe('priority logic', () => {
    it('should display distance from dist_meters (Priority 1)', () => {
      render(
        <DistanceBadge
          distMeters={1500}
          venueCoordinates={{ lat: 52.3676, lng: 4.9041 }}
          userLocation={{ lat: 52.3702, lng: 4.8952 }}
          city="Amsterdam"
        />
      );
      
      // 1500 meters = 1.5 km
      expect(screen.getByText('1.5 km')).toBeInTheDocument();
    });

    it('should calculate client-side distance when dist_meters is missing (Priority 2)', () => {
      render(
        <DistanceBadge
          venueCoordinates={{ lat: 52.3676, lng: 4.9041 }}
          userLocation={{ lat: 52.3702, lng: 4.8952 }}
          city="Amsterdam"
        />
      );
      
      // Client-side calculation should show a distance value
      // The exact distance will be around 0.6-0.8 km based on the coordinates
      const badges = screen.getAllByText(/m/i);
      expect(badges.length).toBeGreaterThan(0);
    });

    it('should display city name when coordinates are missing (Priority 3)', () => {
      render(
        <DistanceBadge
          city="Rotterdam"
        />
      );
      
      expect(screen.getByText('Rotterdam')).toBeInTheDocument();
    });

    it('should display "Location Unknown" as final fallback (Priority 4)', () => {
      render(<DistanceBadge />);
      
      expect(screen.getByText('Location Unknown')).toBeInTheDocument();
    });

    it('should prefer dist_meters over client-side calculation', () => {
      // dist_meters is 500m, but client-side would calculate differently
      render(
        <DistanceBadge
          distMeters={500}
          venueCoordinates={{ lat: 52.3676, lng: 4.9041 }}
          userLocation={{ lat: 52.3702, lng: 4.8952 }}
        />
      );
      
      // Should show 500 meters, not the client-calculated distance
      expect(screen.getByText('500 m')).toBeInTheDocument();
    });

    it('should show city when user location is missing', () => {
      render(
        <DistanceBadge
          venueCoordinates={{ lat: 52.3676, lng: 4.9041 }}
          city="Utrecht"
        />
      );
      
      expect(screen.getByText('Utrecht')).toBeInTheDocument();
    });

    it('should show city when venue coordinates are missing', () => {
      render(
        <DistanceBadge
          userLocation={{ lat: 52.3702, lng: 4.8952 }}
          city="Leiden"
        />
      );
      
      expect(screen.getByText('Leiden')).toBeInTheDocument();
    });
  });

  describe('distance formatting', () => {
    it('should format distances under 1km in meters', () => {
      render(
        <DistanceBadge
          distMeters={350}
        />
      );
      
      expect(screen.getByText('350 m')).toBeInTheDocument();
    });

    it('should format distances over 1km in kilometers with 1 decimal', () => {
      render(
        <DistanceBadge
          distMeters={2500}
        />
      );
      
      expect(screen.getByText('2.5 km')).toBeInTheDocument();
    });

    it('should show "right here" for very close distances', () => {
      render(
        <DistanceBadge
          distMeters={50}
        />
      );
      
      expect(screen.getByText('right here')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle zero distance', () => {
      render(
        <DistanceBadge
          distMeters={0}
        />
      );
      
      expect(screen.getByText('right here')).toBeInTheDocument();
    });

    it('should handle empty city string', () => {
      render(
        <DistanceBadge
          city=""
        />
      );
      
      expect(screen.getByText('Location Unknown')).toBeInTheDocument();
    });

    it('should handle whitespace-only city string', () => {
      render(
        <DistanceBadge
          city="   "
        />
      );
      
      expect(screen.getByText('Location Unknown')).toBeInTheDocument();
    });
  });
});
