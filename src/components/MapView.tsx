import React, { useState, Fragment, createElement, useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Users, Zap, Film, Palette, Trophy, Radio, Shield, Sparkles, X, Loader2 } from 'lucide-react';
import { useEvents, useJoinEvent } from '../lib/hooks';
import { useAuth } from '../contexts/useAuth';
import { parseGeography, formatEventTime } from '../lib/utils';

type PinType = 'anchor' | 'fork' | 'signal';
type MapMode = 'safe' | 'tribe';

interface MapEvent {
  id: string;
  type: PinType;
  title: string;
  category: 'cinema' | 'crafts' | 'sports' | 'gaming' | 'market';
  venue: string;
  time: string;
  attendees: number;
  status?: string;
  lat: number;
  lng: number;
  parentId?: string;
}
const categoryConfig = {
  cinema: {
    icon: Film,
    color: 'bg-blue-500',
    borderColor: 'border-blue-500',
    textColor: 'text-blue-500'
  },
  crafts: {
    icon: Palette,
    color: 'bg-amber-500',
    borderColor: 'border-amber-500',
    textColor: 'text-amber-500'
  },
  sports: {
    icon: Trophy,
    color: 'bg-yellow-500',
    borderColor: 'border-yellow-500',
    textColor: 'text-yellow-500'
  },
  gaming: {
    icon: Radio,
    color: 'bg-green-500',
    borderColor: 'border-green-500',
    textColor: 'text-green-500'
  },
  market: {
    icon: MapPin,
    color: 'bg-purple-500',
    borderColor: 'border-purple-500',
    textColor: 'text-purple-500'
  }
};

// Component to auto-fit map bounds to show all events
function FitBoundsToEvents({ events }: { events: MapEvent[] }) {
  const map = useMap();

  useEffect(() => {
    if (events.length > 0) {
      const bounds = L.latLngBounds(events.map(e => [e.lat, e.lng]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [events, map]);

  return null;
}

// Component to show user location
function UserLocationMarker() {
  const [position, setPosition] = useState<[number, number] | null>(null);
  const map = useMap();

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setPosition([pos.coords.latitude, pos.coords.longitude]);
        },
        (error) => {
          console.log('Geolocation error:', error);
        }
      );
    }
  }, []);

  if (!position) return null;

  const userIcon = L.divIcon({
    className: 'user-location-marker',
    html: `
      <div style="position: relative; width: 40px; height: 40px;">
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 40px;
          height: 40px;
          background: rgba(59, 130, 246, 0.3);
          border-radius: 50%;
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        "></div>
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 16px;
          height: 16px;
          background: rgb(59, 130, 246);
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        "></div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20]
  });

  return <Marker position={position} icon={userIcon} />;
}

// Custom marker component for events
function EventMarker({ 
  event, 
  onSelect,
  isSelected 
}: { 
  event: MapEvent; 
  onSelect: (event: MapEvent) => void;
  isSelected: boolean;
}) {
  const config = categoryConfig[event.category];
  const Icon = config.icon;

  // Get color values for inline styles
  const getColorValue = (colorClass: string) => {
    const colorMap: Record<string, string> = {
      'bg-blue-500': '#3b82f6',
      'bg-amber-500': '#f59e0b',
      'bg-yellow-500': '#eab308',
      'bg-green-500': '#22c55e',
      'bg-purple-500': '#a855f7',
      'border-blue-500': '#3b82f6',
      'border-amber-500': '#f59e0b',
      'border-yellow-500': '#eab308',
      'border-green-500': '#22c55e',
      'border-purple-500': '#a855f7',
    };
    return colorMap[colorClass] || '#3b82f6';
  };

  const bgColor = getColorValue(config.color);
  const borderColor = getColorValue(config.borderColor);

  // Create custom icon based on event type
  const createDivIcon = () => {
    if (event.type === 'anchor') {
      const iconHtml = `
        <div style="
          width: 64px;
          height: 64px;
          border-radius: 16px;
          background-color: ${bgColor};
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          border: 4px solid white;
          position: relative;
          ${isSelected ? 'box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.4);' : ''}
        ">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            ${Icon === Film ? '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18"/><path d="M3 7.5h4"/><path d="M3 12h18"/><path d="M3 16.5h4"/><path d="M17 3v18"/><path d="M17 7.5h4"/><path d="M17 16.5h4"/>' : ''}
            ${Icon === Palette ? '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>' : ''}
            ${Icon === Trophy ? '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>' : ''}
            ${Icon === Radio ? '<circle cx="12" cy="12" r="2"/><path d="M4.93 19.07a10 10 0 0 1 0-14.14"/><path d="M7.76 16.24a6 6 0 0 1 0-8.49"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>' : ''}
            ${Icon === MapPin ? '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>' : ''}
          </svg>
          <div style="
            position: absolute;
            bottom: -8px;
            left: 50%;
            transform: translateX(-50%);
            width: 4px;
            height: 24px;
            background-color: rgba(255, 255, 255, 0.5);
            border-radius: 9999px;
          "></div>
        </div>
      `;
      return L.divIcon({
        className: 'custom-marker-anchor',
        html: iconHtml,
        iconSize: [64, 64],
        iconAnchor: [32, 32]
      });
    }

    if (event.type === 'fork') {
      const iconHtml = `
        <div style="
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background-color: white;
          border: 4px solid ${borderColor};
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          ${isSelected ? 'box-shadow: 0 0 0 4px rgba(168, 85, 247, 0.4);' : ''}
        ">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${borderColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </div>
      `;
      return L.divIcon({
        className: 'custom-marker-fork',
        html: iconHtml,
        iconSize: [48, 48],
        iconAnchor: [24, 24]
      });
    }

    if (event.type === 'signal') {
      const iconHtml = `
        <div style="position: relative; width: 48px; height: 48px;">
          <div style="
            position: absolute;
            top: -6px;
            left: -6px;
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background-color: ${bgColor};
            opacity: 0.3;
            animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;
          "></div>
          <div style="
            position: absolute;
            top: 2px;
            left: 2px;
            width: 44px;
            height: 44px;
            border-radius: 50%;
            background-color: ${bgColor};
            opacity: 0.2;
            filter: blur(4px);
          "></div>
          <div style="
            position: absolute;
            top: 6px;
            left: 6px;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background-color: ${bgColor};
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
            border: 2px solid white;
            ${isSelected ? 'box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.4);' : ''}
          ">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              ${Icon === Film ? '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18"/>' : ''}
              ${Icon === Palette ? '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>' : ''}
              ${Icon === Trophy ? '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M4 22h16"/>' : ''}
              ${Icon === Radio ? '<circle cx="12" cy="12" r="2"/><path d="M4.93 19.07a10 10 0 0 1 0-14.14"/>' : ''}
              ${Icon === MapPin ? '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>' : ''}
            </svg>
          </div>
        </div>
      `;
      return L.divIcon({
        className: 'custom-marker-signal',
        html: iconHtml,
        iconSize: [48, 48],
        iconAnchor: [24, 24]
      });
    }

    return L.divIcon({
      className: 'custom-marker-default',
      html: '<div></div>',
      iconSize: [0, 0]
    });
  };

  return (
    <Marker
      position={[event.lat, event.lng]}
      icon={createDivIcon()}
      eventHandlers={{
        click: () => onSelect(event)
      }}
    />
  );
}

export function MapView() {
  const [mapMode, setMapMode] = useState<MapMode>('safe');
  const [selectedEvent, setSelectedEvent] = useState<MapEvent | null>(null);
  const { profile } = useAuth();
  const { handleJoinEvent, isJoining } = useJoinEvent(profile?.id);

  const { events: allEvents, loading } = useEvents();

  const onJoinEvent = async (eventId: string) => {
    await handleJoinEvent(eventId);
    setSelectedEvent(null);
  };

  const mapEvents: MapEvent[] = useMemo(() => {
    return allEvents.map(event => {
      const coords = parseGeography(event.location);
      return {
        id: event.id,
        type: event.event_type as PinType,
        title: event.title,
        category: event.category,
        venue: event.venue_name,
        time: formatEventTime(event.event_date, event.event_time),
        attendees: event.attendee_count || 0,
        status: event.status,
        lat: coords?.lat || 52.7,
        lng: coords?.lng || 6.2,
        parentId: event.parent_event_id || undefined,
      };
    });
  }, [allEvents]);

  const filteredEvents = mapEvents.filter(event => {
    if (mapMode === 'safe') {
      return ['cinema', 'market'].includes(event.category) || event.type === 'anchor';
    } else {
      return ['gaming', 'sports', 'crafts'].includes(event.category);
    }
  });

  if (loading) {
    return (
      <div className="relative w-full min-h-screen bg-[#E8E4D9] overflow-hidden flex items-center justify-center">
        <div className="text-zinc-600">Loading map...</div>
      </div>
    );
  }

  return <div className="relative w-full min-h-screen bg-[#E8E4D9] overflow-hidden">
      {/* Leaflet Map */}
      <MapContainer 
        center={[52.6912, 6.1927]} 
        zoom={13} 
        className="absolute inset-0 z-0"
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        {/* Auto-fit bounds to show all events */}
        <FitBoundsToEvents events={filteredEvents} />
        
        {/* User location marker */}
        <UserLocationMarker />
        
        {/* Event markers */}
        {filteredEvents.map((event) => (
          <EventMarker
            key={event.id}
            event={event}
            onSelect={setSelectedEvent}
            isSelected={selectedEvent?.id === event.id}
          />
        ))}
        
        {/* Fork connection lines */}
        {filteredEvents
          .filter(event => event.type === 'fork' && event.parentId)
          .map(forkEvent => {
            const parent = mapEvents.find(e => e.id === forkEvent.parentId);
            if (!parent) return null;
            
            // Show line when fork or parent is selected/hovered
            const shouldShow = selectedEvent?.id === forkEvent.id || selectedEvent?.id === parent.id;
            
            if (!shouldShow) return null;
            
            return (
              <Polyline
                key={`line-${forkEvent.id}`}
                positions={[
                  [parent.lat, parent.lng],
                  [forkEvent.lat, forkEvent.lng]
                ]}
                pathOptions={{
                  color: 'white',
                  weight: 2,
                  opacity: 0.6,
                  dashArray: '4, 4'
                }}
              />
            );
          })}
      </MapContainer>

      {/* LCL 2.0: Enhanced header with improved glass effect */}
      <div className="absolute top-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-b border-gray-200/50 p-4 z-30 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
        <div className="flex items-center justify-between max-w-md mx-auto">
          <div>
            <h1 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
              <Zap size={20} className="text-purple-600" />
              LCL Radar
            </h1>
            {/* LCL 2.0: Improved text contrast */}
            <p className="text-xs text-zinc-600">Live in Meppel</p>
          </div>
          <div className="flex items-center gap-2 text-zinc-600 text-sm font-medium">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span>{filteredEvents.length} active</span>
          </div>
        </div>
      </div>

      {/* Mode Toggle */}
      {/* LCL 2.0: Touch targets meet 48px minimum */}
      <div className="absolute top-20 left-0 right-0 z-30 px-4">
        <div className="max-w-md mx-auto bg-white/95 backdrop-blur-xl rounded-2xl shadow-glass p-1.5 flex gap-1 border border-gray-200/50">
          <button onClick={() => setMapMode('safe')} className={`flex-1 px-5 py-3.5 min-h-[48px] rounded-xl font-bold text-sm transition-all duration-300 flex items-center justify-center gap-2 ${mapMode === 'safe' ? 'bg-blue-500 text-white shadow-lg scale-105' : 'text-gray-600 hover:bg-gray-100'}`}>
            <Shield size={16} strokeWidth={2.5} />
            <span>Safe & Local</span>
          </button>
          <button onClick={() => setMapMode('tribe')} className={`flex-1 px-5 py-3.5 min-h-[48px] rounded-xl font-bold text-sm transition-all duration-300 flex items-center justify-center gap-2 ${mapMode === 'tribe' ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg scale-105' : 'text-gray-600 hover:bg-gray-100'}`}>
            <Sparkles size={16} strokeWidth={2.5} />
            <span>My Tribes</span>
          </button>
        </div>
      </div>

      {/* Legend */}
      {/* LCL 2.0: Enhanced glass effect with visible shadow */}
      <div className="absolute top-40 left-4 z-20 bg-white/95 backdrop-blur-xl rounded-2xl shadow-card p-3 border border-gray-200/50 space-y-2">
        <div className="flex items-center gap-2 text-xs">
          <div className="w-6 h-6 rounded-lg bg-blue-500 flex items-center justify-center">
            <div className="w-1 h-3 bg-white/50 rounded-full"></div>
          </div>
          <span className="font-medium text-gray-700">Venue</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <div className="w-6 h-6 rounded-full bg-white border-2 border-blue-500 flex items-center justify-center">
            <Users size={12} className="text-blue-500" />
          </div>
          <span className="font-medium text-gray-700">Group</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <div className="relative w-6 h-6 flex items-center justify-center">
            <span className="absolute w-6 h-6 rounded-full bg-green-500 opacity-20 animate-ping"></span>
            <span className="relative w-4 h-4 rounded-full bg-green-500"></span>
          </div>
          <span className="font-medium text-gray-700">Zone</span>
        </div>
      </div>

      {/* Event Detail Card */}
      {/* LCL 2.0: Enhanced bottom sheet with upward shadow and improved glass */}
      {selectedEvent && <div className="absolute bottom-0 left-0 right-0 z-40 p-4 animate-slide-up">
          <div className="max-w-md mx-auto bg-white/98 backdrop-blur-2xl rounded-3xl shadow-up-sheet border border-gray-100 overflow-hidden">
            <div className={`h-1 ${categoryConfig[selectedEvent.category].color}`}></div>

            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className={`p-2.5 rounded-xl ${categoryConfig[selectedEvent.category].color}`}>
                  {createElement(categoryConfig[selectedEvent.category].icon, {
                size: 24,
                className: 'text-white',
                strokeWidth: 2.5
              })}
                </div>
                {/* LCL 2.0: Close button meets 44px touch target */}
                <button onClick={() => setSelectedEvent(null)} className="min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-gray-100 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="flex items-center gap-2 mb-3">
                {selectedEvent.type === 'anchor' && <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
                    OFFICIAL
                  </span>}
                {selectedEvent.type === 'fork' && <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-bold rounded-full">
                    SOCIAL
                  </span>}
                {selectedEvent.type === 'signal' && <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                    LIVE ZONE
                  </span>}
              </div>

              <h3 className="text-2xl font-bold text-zinc-900 mb-2 leading-tight">
                {selectedEvent.title}
              </h3>

              <div className="space-y-2 text-sm text-zinc-600 mb-4">
                <div className="flex items-center gap-2">
                  <MapPin size={14} strokeWidth={2.5} />
                  <span className="font-medium">{selectedEvent.venue}</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="font-medium">{selectedEvent.time}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Users size={12} />
                    {selectedEvent.attendees} going
                  </span>
                </div>
              </div>

              {selectedEvent.status && <div className="mb-4 px-3 py-2 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl">
                  <p className="text-sm font-bold text-orange-700 flex items-center gap-2">
                    <Zap size={14} className="fill-orange-500 text-orange-500" />
                    {selectedEvent.status}
                  </p>
                </div>}

              {/* LCL 2.0: Touch target exceeds 44px minimum */}
              <button 
                onClick={() => onJoinEvent(selectedEvent.id)}
                disabled={isJoining(selectedEvent.id) || !profile?.id}
                className="w-full bg-zinc-900 text-white font-bold py-4 min-h-[52px] rounded-xl hover:bg-zinc-800 transition-all active:scale-95 shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isJoining(selectedEvent.id) ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Joining...
                  </>
                ) : (
                  <>
                    {selectedEvent.type === 'fork' ? 'Join Group' : 'Join Event'}
                    <Zap size={16} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>}

      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        
        @keyframes ping {
          75%, 100% {
            transform: scale(2);
            opacity: 0;
          }
        }
        
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
        
        /* Custom marker styles */
        :global(.custom-marker-anchor),
        :global(.custom-marker-fork),
        :global(.custom-marker-signal),
        :global(.user-location-marker) {
          background: transparent !important;
          border: none !important;
        }
        
        :global(.custom-marker-anchor):hover,
        :global(.custom-marker-fork):hover,
        :global(.custom-marker-signal):hover {
          cursor: pointer;
        }
        
        /* Pulse animation for user location */
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </div>;
}