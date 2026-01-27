/**
 * Mission Control 2.0 - Day-of Event Dashboard
 *
 * This component provides a passive "Co-pilot" experience for the day of an event.
 * Features:
 * - Context awareness (auto-expands on event day)
 * - Live weather widget for venue location
 * - Participant "Pulse" rail with arrival status
 * - One-tap status action buttons
 */

import { memo, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  MapPin,
  Cloud,
  CloudRain,
  Sun,
  Clock,
  Car,
  Users,
  CheckCircle2,
} from 'lucide-react';
import { isToday, parseISO, format } from 'date-fns';
import { hapticImpact } from '@/shared/lib/haptics';
import toast from 'react-hot-toast';

/**
 * Participant status for the Pulse rail
 */
export type ParticipantStatus =
  | 'unknown'
  | 'at_home'
  | 'en_route'
  | 'parking'
  | 'arriving_soon'
  | 'at_venue';

/**
 * Participant arrival data
 */
export interface ParticipantArrival {
  id: string;
  displayName: string;
  avatarUrl?: string;
  status: ParticipantStatus;
  /** Estimated time of arrival in minutes (null if unknown or at venue) */
  etaMinutes?: number | null;
  /** Last status update timestamp */
  lastUpdated?: string;
}

/**
 * Weather data for the venue
 */
export interface VenueWeather {
  /** Temperature in Celsius */
  temperature: number;
  /** Weather condition */
  condition: 'sunny' | 'cloudy' | 'rainy' | 'stormy' | 'unknown';
  /** Precipitation probability (0-100) */
  precipitationProbability: number;
  /** Weather description */
  description: string;
}

/**
 * Event data for Mission Control
 */
export interface MissionControlEvent {
  id: string;
  title: string;
  venueName: string;
  eventDate: string; // ISO date string
  eventTime?: string; // HH:MM format
  location?: { lat: number; lng: number };
}

interface MissionControlDrawerProps {
  event: MissionControlEvent;
  /** Current user's profile ID */
  currentUserId: string;
  /** List of participant arrival data */
  participants: ParticipantArrival[];
  /** Weather data for venue (optional, will show placeholder if not provided) */
  weather?: VenueWeather | null;
  /** Whether the drawer should be initially expanded */
  initiallyExpanded?: boolean;
  /** Callback when user updates their status */
  onStatusUpdate?: (status: ParticipantStatus) => void;
  /** Callback to close the drawer */
  onClose: () => void;
}

/**
 * Status button configuration
 */
interface StatusAction {
  id: ParticipantStatus;
  label: string;
  emoji: string;
  icon: typeof Clock;
  color: string;
}

const STATUS_ACTIONS: StatusAction[] = [
  {
    id: 'en_route',
    label: 'Running 5m Late',
    emoji: '🏃',
    icon: Clock,
    color: 'bg-amber-500 text-white',
  },
  {
    id: 'parking',
    label: 'Parking',
    emoji: '🚗',
    icon: Car,
    color: 'bg-blue-500 text-white',
  },
  {
    id: 'at_venue',
    label: 'At Venue',
    emoji: '📍',
    icon: CheckCircle2,
    color: 'bg-emerald-500 text-white',
  },
];

/**
 * Mission Control 2.0 Drawer Component
 */
export const MissionControlDrawer = memo(function MissionControlDrawer({
  event,
  currentUserId,
  participants,
  weather,
  initiallyExpanded,
  onStatusUpdate,
  onClose,
}: MissionControlDrawerProps) {
  // Auto-expand if it's the day of the event
  const isEventToday = useMemo(() => {
    try {
      return isToday(parseISO(event.eventDate));
    } catch {
      return false;
    }
  }, [event.eventDate]);

  const [isExpanded, _setIsExpanded] = useState(
    initiallyExpanded ?? isEventToday
  );

  // Handle status button press
  const handleStatusPress = useCallback(
    async (status: ParticipantStatus) => {
      await hapticImpact('medium');

      // Find the status action for toast message
      const action = STATUS_ACTIONS.find((a) => a.id === status);
      const message =
        status === 'at_venue'
          ? "You're here! 🎉"
          : status === 'parking'
            ? 'Finding parking... 🚗'
            : 'Status updated!';

      toast.success(message, {
        icon: action?.emoji,
        duration: 2000,
      });

      onStatusUpdate?.(status);
    },
    [onStatusUpdate]
  );

  // Format event time
  const formattedTime = useMemo(() => {
    if (!event.eventTime) return 'All day';
    return format(parseISO(`2000-01-01T${event.eventTime}`), 'h:mm a');
  }, [event.eventTime]);

  // Get weather icon
  const WeatherIcon = useMemo(() => {
    if (!weather) return Cloud;
    switch (weather.condition) {
      case 'sunny':
        return Sun;
      case 'rainy':
      case 'stormy':
        return CloudRain;
      default:
        return Cloud;
    }
  }, [weather]);

  // Sort participants: at venue first, then by ETA
  const sortedParticipants = useMemo(() => {
    return [...participants].sort((a, b) => {
      // At venue first
      if (a.status === 'at_venue' && b.status !== 'at_venue') return -1;
      if (b.status === 'at_venue' && a.status !== 'at_venue') return 1;

      // Then by ETA
      const etaA = a.etaMinutes ?? Infinity;
      const etaB = b.etaMinutes ?? Infinity;
      return etaA - etaB;
    });
  }, [participants]);

  // Get status label for participant
  const getStatusLabel = (participant: ParticipantArrival): string => {
    switch (participant.status) {
      case 'at_venue':
        return 'At Venue';
      case 'parking':
        return 'Parking';
      case 'arriving_soon':
        return `Arriving in ${participant.etaMinutes ?? '?'}m`;
      case 'en_route':
        return participant.etaMinutes
          ? `${participant.etaMinutes}m away`
          : 'On the way';
      case 'at_home':
        return 'Not started';
      default:
        return 'Unknown';
    }
  };

  // Get status color
  const getStatusColor = (status: ParticipantStatus): string => {
    switch (status) {
      case 'at_venue':
        return 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30';
      case 'parking':
      case 'arriving_soon':
        return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30';
      case 'en_route':
        return 'text-amber-600 bg-amber-100 dark:bg-amber-900/30';
      default:
        return 'text-muted-foreground bg-muted';
    }
  };

  return (
    <AnimatePresence>
      {isExpanded && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-50 touch-none"
          />

          {/* Drawer */}
          <motion.div
            key="drawer"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 bg-background rounded-t-3xl shadow-2xl z-50 flex flex-col overflow-hidden border-t max-h-[85vh] pb-safe"
          >
            {/* Drag Handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0 touch-pan-y">
              <div className="w-12 h-1.5 bg-muted rounded-full" />
            </div>

            {/* Header */}
            <div className="px-5 pb-4 pt-1 flex items-center justify-between shrink-0 border-b">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🎯</span>
                  <h2 className="text-xl font-bold truncate">{event.title}</h2>
                </div>
                <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <MapPin size={14} />
                    {event.venueName}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={14} />
                    {formattedTime}
                  </span>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 -mr-2 text-muted-foreground hover:text-foreground rounded-full active:bg-muted"
              >
                <X size={24} />
              </button>
            </div>

            {/* Content - Scrollable */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {/* Weather Widget */}
              <div className="px-5 py-4 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <WeatherIcon
                        size={24}
                        className="text-blue-600 dark:text-blue-400"
                      />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">
                        {weather
                          ? `${weather.temperature}°C`
                          : 'Weather loading...'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {weather?.description || 'At venue location'}
                      </p>
                    </div>
                  </div>
                  {weather && weather.precipitationProbability > 30 && (
                    <div className="flex items-center gap-1 text-blue-600 bg-blue-100 dark:bg-blue-900/30 px-3 py-1.5 rounded-full text-sm font-medium">
                      <CloudRain size={14} />
                      <span>{weather.precipitationProbability}%</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Pulse Rail - Participant Status */}
              <div className="px-5 py-4 border-b">
                <div className="flex items-center gap-2 mb-3">
                  <Users size={16} className="text-muted-foreground" />
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                    Who's Coming
                  </h3>
                </div>

                <div className="space-y-3">
                  {sortedParticipants.length > 0 ? (
                    sortedParticipants.map((participant) => (
                      <div
                        key={participant.id}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          {/* Avatar */}
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                            {participant.avatarUrl ? (
                              <img
                                src={participant.avatarUrl}
                                alt={participant.displayName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-sm font-medium text-muted-foreground">
                                {participant.displayName.charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-foreground">
                              {participant.displayName}
                              {participant.id === currentUserId && (
                                <span className="text-xs text-muted-foreground ml-1">
                                  (you)
                                </span>
                              )}
                            </p>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(participant.status)}`}
                        >
                          {getStatusLabel(participant)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No participants yet
                    </p>
                  )}
                </div>
              </div>

              {/* One-Tap Status Actions */}
              <div className="px-5 py-4">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-3">
                  Update Your Status
                </h3>

                <div className="grid grid-cols-3 gap-3">
                  {STATUS_ACTIONS.map((action) => (
                    <button
                      key={action.id}
                      onClick={() => handleStatusPress(action.id)}
                      className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl transition-all active:scale-95 ${action.color}`}
                    >
                      <span className="text-2xl">{action.emoji}</span>
                      <span className="text-xs font-medium text-center leading-tight">
                        {action.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Bottom padding for safe area */}
              <div className="h-8" />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
});

/**
 * Hook to generate mock participant data for testing
 * In production, this would come from real-time subscriptions
 */
export function useMockParticipants(_eventId: string): ParticipantArrival[] {
  return useMemo(
    () => [
      {
        id: 'user-1',
        displayName: 'Sarah',
        status: 'arriving_soon' as ParticipantStatus,
        etaMinutes: 5,
        lastUpdated: new Date().toISOString(),
      },
      {
        id: 'user-2',
        displayName: 'Tom',
        status: 'at_venue' as ParticipantStatus,
        etaMinutes: null,
        lastUpdated: new Date().toISOString(),
      },
      {
        id: 'user-3',
        displayName: 'Emma',
        status: 'en_route' as ParticipantStatus,
        etaMinutes: 12,
        lastUpdated: new Date().toISOString(),
      },
      {
        id: 'user-4',
        displayName: 'Alex',
        status: 'parking' as ParticipantStatus,
        etaMinutes: 2,
        lastUpdated: new Date().toISOString(),
      },
    ],
    []
  );
}

/**
 * Hook to generate mock weather data for testing
 * In production, this would come from a weather API
 */
export function useMockWeather(
  location?: { lat: number; lng: number }
): VenueWeather | null {
  return useMemo(() => {
    if (!location) return null;

    return {
      temperature: 18,
      condition: 'cloudy' as const,
      precipitationProbability: 25,
      description: 'Partly cloudy, mild',
    };
  }, [location]);
}
