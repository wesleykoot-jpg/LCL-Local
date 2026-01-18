/**
 * EventMap Component
 * 
 * A live, interactive map using Leaflet with OpenStreetMap tiles.
 * Displays event markers at their actual coordinates and user's location.
 * 
 * Features:
 * - OpenStreetMap tiles (free, open-source)
 * - User location marker with pulsing animation
 * - Event pins at actual lat/lng coordinates
 * - Interactive popups with event details
 * - Responsive to container size
 */

import { memo, useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { EventWithAttendees } from '../hooks/hooks';
import { getEventCoordinates } from '@/shared/lib/formatters';

// Fix for default marker icons in Leaflet with bundlers
// Leaflet's default icon paths don't work properly with Vite
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Import Leaflet CSS
import 'leaflet/dist/leaflet.css';

// Fix the default icon issue - Leaflet's icon path resolution doesn't work with bundlers
// We use a try-catch to handle potential issues with different Leaflet versions
try {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl;
} catch {
  // Ignore if property doesn't exist
}
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

/** Event with distance information from the live events query */
type EventWithDistance = EventWithAttendees & { distanceKm?: number };

/** Event with parsed coordinates for map display */
interface EventWithCoords extends EventWithDistance {
  coords: { lat: number; lng: number };
}

interface EventMapProps {
  /** User's current location */
  userLocation?: { lat: number; lng: number } | null;
  /** Events to display on the map */
  events: EventWithDistance[];
  /** Callback when an event marker is clicked */
  onEventClick?: (event: EventWithAttendees) => void;
  /** Map height in CSS (default: 100%) */
  height?: string;
  /** Initial zoom level (default: 13) */
  initialZoom?: number;
}

/**
 * Custom user location icon with pulsing effect via CSS
 */
const userLocationIcon = L.divIcon({
  className: 'user-location-marker',
  html: `
    <div class="user-location-pulse"></div>
    <div class="user-location-dot"></div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

/**
 * Map categories to emoji icons for map markers
 */
const CATEGORY_EMOJI_MAP: Record<string, string> = {
  cinema: '🎬',
  music: '🎵',
  nightlife: '🎵',
  sports: '🏃',
  active: '🏃',
  gaming: '🎮',
  market: '🛍️',
  crafts: '🎨',
  food: '🍽️',
  foodie: '🍽️',
  wellness: '🧘',
  family: '👨‍👩‍👧‍👦',
  outdoor: '🌲',
  outdoors: '🌲',
  entertainment: '🎭',
  social: '👥',
  community: '🏘️',
  workshops: '🛠️',
};

function getCategoryEmoji(category?: string | null): string {
  if (!category) return '📍';
  return CATEGORY_EMOJI_MAP[category.toLowerCase()] || '📍';
}

/**
 * Create a custom event marker icon
 */
function createEventIcon(category?: string | null): L.DivIcon {
  const emoji = getCategoryEmoji(category);
  return L.divIcon({
    className: 'event-marker',
    html: `
      <div class="event-marker-container">
        <span class="event-marker-emoji">${emoji}</span>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
}

/**
 * Component to recenter the map when user location changes
 */
function MapRecenter({ center }: { center: [number, number] }) {
  const map = useMap();
  
  useEffect(() => {
    map.setView(center, map.getZoom(), { animate: true });
  }, [center, map]);
  
  return null;
}

// Default map center (Amsterdam as a fallback when no user location is available)
// This should be overridden by user location or event coordinates when available
const DEFAULT_MAP_CENTER: [number, number] = [52.3676, 4.9041];

/**
 * EventMap - Interactive OpenStreetMap with event markers
 */
export const EventMap = memo(function EventMap({
  userLocation,
  events,
  onEventClick,
  height = '100%',
  initialZoom = 13,
}: EventMapProps) {
  // Parse event coordinates from location/structured_location fields
  const eventsWithCoords = useMemo((): EventWithCoords[] => {
    const result: EventWithCoords[] = [];
    for (const event of events) {
      const coords = getEventCoordinates(event.location, event.structured_location);
      if (coords) {
        result.push({ ...event, coords });
      }
    }
    return result;
  }, [events]);

  const mapCenter = useMemo((): [number, number] => {
    if (userLocation) {
      return [userLocation.lat, userLocation.lng];
    }
    // If we have events with coordinates, center on the first one
    if (eventsWithCoords.length > 0) {
      const firstEvent = eventsWithCoords[0];
      return [firstEvent.coords.lat, firstEvent.coords.lng];
    }
    return DEFAULT_MAP_CENTER;
  }, [userLocation, eventsWithCoords]);

  return (
    <div style={{ height, width: '100%', position: 'relative' }}>
      {/* Custom styles for markers */}
      <style>{`
        .user-location-marker {
          background: transparent;
          border: none;
        }
        .user-location-pulse {
          position: absolute;
          width: 40px;
          height: 40px;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          background: rgba(59, 130, 246, 0.3);
          border-radius: 50%;
          animation: pulse 2s infinite;
        }
        .user-location-dot {
          position: absolute;
          width: 14px;
          height: 14px;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          background: #3b82f6;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }
        @keyframes pulse {
          0% {
            transform: translate(-50%, -50%) scale(0.8);
            opacity: 1;
          }
          70% {
            transform: translate(-50%, -50%) scale(2);
            opacity: 0;
          }
          100% {
            transform: translate(-50%, -50%) scale(0.8);
            opacity: 0;
          }
        }
        .event-marker {
          background: transparent;
          border: none;
        }
        .event-marker-container {
          width: 36px;
          height: 36px;
          background: white;
          border-radius: 50%;
          border: 2px solid hsl(var(--primary));
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
          cursor: pointer;
          transition: transform 0.15s ease;
        }
        .event-marker-container:hover {
          transform: scale(1.15);
        }
        .event-marker-emoji {
          font-size: 18px;
          line-height: 1;
        }
        .leaflet-popup-content-wrapper {
          border-radius: 12px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
        }
        .leaflet-popup-content {
          margin: 12px;
          min-width: 180px;
        }
        .event-popup {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .event-popup-title {
          font-weight: 600;
          font-size: 15px;
          color: hsl(var(--foreground));
          line-height: 1.3;
          margin: 0;
        }
        .event-popup-info {
          font-size: 13px;
          color: hsl(var(--muted-foreground));
          margin: 0;
        }
        .event-popup-action {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 8px 12px;
          background: hsl(var(--primary));
          color: hsl(var(--primary-foreground));
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          border: none;
          margin-top: 4px;
          transition: opacity 0.15s;
        }
        .event-popup-action:hover {
          opacity: 0.9;
        }
      `}</style>
      
      <MapContainer
        center={mapCenter}
        zoom={initialZoom}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
        attributionControl={true}
      >
        {/* OpenStreetMap Tiles */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Recenter when location changes */}
        {userLocation && <MapRecenter center={[userLocation.lat, userLocation.lng]} />}
        
        {/* User Location Marker */}
        {userLocation && (
          <Marker
            position={[userLocation.lat, userLocation.lng]}
            icon={userLocationIcon}
            zIndexOffset={1000}
          >
            <Popup closeButton={false}>
              <div className="event-popup">
                <p className="event-popup-title">📍 You are here</p>
              </div>
            </Popup>
          </Marker>
        )}
        
        {/* Event Markers */}
        {eventsWithCoords.map((event) => {
          const distanceKm = event.distanceKm;
          return (
            <Marker
              key={event.id}
              position={[event.coords.lat, event.coords.lng]}
              icon={createEventIcon(event.category)}
            >
              <Popup>
                <div className="event-popup">
                  <p className="event-popup-title">{event.title}</p>
                  {event.venue_name && (
                    <p className="event-popup-info">📍 {event.venue_name}</p>
                  )}
                  {distanceKm !== undefined && (
                    <p className="event-popup-info">
                      🚶 {distanceKm < 1 
                        ? `${Math.round(distanceKm * 1000)}m away`
                        : `${distanceKm.toFixed(1)}km away`}
                    </p>
                  )}
                  <button
                    className="event-popup-action"
                    onClick={() => onEventClick?.(event)}
                  >
                    Get Directions →
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
});

export default EventMap;
