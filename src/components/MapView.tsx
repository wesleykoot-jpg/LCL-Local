import React, { useEffect, useMemo, useState, createElement } from 'react';
import { MapPin, Users, Zap, Film, Palette, Trophy, Radio, Shield, Sparkles, X, Loader2 } from 'lucide-react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import type { LatLngTuple } from 'leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
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

const categoryColors: Record<MapEvent['category'], string> = {
  cinema: '#3b82f6',
  crafts: '#f59e0b',
  sports: '#eab308',
  gaming: '#22c55e',
  market: '#a855f7'
};

const defaultIcon = L.icon({
  iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).toString(),
  iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).toString(),
  shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).toString(),
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = defaultIcon;

function FitBounds({ events }: { events: MapEvent[] }) {
  const map = useMap();

  useEffect(() => {
    if (!events.length) return;

    const bounds = L.latLngBounds(
      events.map((event) => [event.lat, event.lng] as LatLngTuple)
    );

    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
  }, [events, map]);

  return null;
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

  const mapCenter: LatLngTuple = filteredEvents.length
    ? [filteredEvents[0].lat, filteredEvents[0].lng]
    : [52.7, 6.2];

  if (loading) {
    return (
      <div className="relative w-full min-h-screen bg-[#E8E4D9] overflow-hidden flex items-center justify-center">
        <div className="text-zinc-600">Loading map...</div>
      </div>
    );
  }

  return <div className="relative w-full min-h-screen bg-[#E8E4D9] overflow-hidden">
      <MapContainer
        center={mapCenter}
        zoom={13}
        scrollWheelZoom
        className="absolute inset-0 z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds events={filteredEvents} />
        {filteredEvents.map((event) => {
          const color = categoryColors[event.category];
          const radius = event.type === 'anchor' ? 14 : event.type === 'fork' ? 10 : 12;
          const fillOpacity = event.type === 'signal' ? 0.25 : 0.85;

          return (
            <CircleMarker
              key={event.id}
              center={[event.lat, event.lng]}
              radius={radius}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity,
                weight: event.type === 'signal' ? 2 : 3,
              }}
              eventHandlers={{
                click: () => setSelectedEvent(event),
              }}
            >
              <Popup>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-zinc-900">{event.title}</p>
                  <p className="text-xs text-zinc-600 flex items-center gap-1">
                    <MapPin size={12} />
                    {event.venue}
                  </p>
                  <p className="text-xs text-zinc-500">{event.time}</p>
                  <button
                    type="button"
                    onClick={() => setSelectedEvent(event)}
                    className="mt-2 w-full rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
                  >
                    View details
                  </button>
                </div>
              </Popup>
            </CircleMarker>
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
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>;
}
