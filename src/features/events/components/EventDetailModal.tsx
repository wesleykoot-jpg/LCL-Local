import { memo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  MapPin,
  Clock,
  Calendar,
  Users,
  Share2,
  Bookmark,
  Navigation,
  ShieldCheck,
  ChevronDown,
  GitFork,
  Loader2,
  Globe
} from 'lucide-react';
import { CategoryBadge } from './CategoryBadge';
import { EventActionsMenu } from './EventActionsMenu';
import { Facepile } from './Facepile';
import { DistanceBadge } from './DistanceBadge';
import { ForkEventCard } from './ForkEventCard';
import { CATEGORY_MAP } from '@/shared/lib/categories';
import { useLocation } from '@/features/location';
import { hapticImpact } from '@/shared/lib/haptics';
import { formatEventLocation, getEventCoordinates } from '@/shared/lib/formatters';
import { useEvents, type EventWithAttendees } from '../hooks/hooks';

interface EventDetailModalProps {
  event: EventWithAttendees;
  onClose: () => void;
  onJoin?: () => Promise<void>;
  isJoining?: boolean;
  hasJoined?: boolean;
  currentUserProfileId?: string;
  onEventSelect?: (event: EventWithAttendees) => void;
}

// Fallback images by category
const CATEGORY_FALLBACK_IMAGES: Record<string, string> = {
  active: 'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?auto=format&fit=crop&w=1200&q=80',
  gaming: 'https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?auto=format&fit=crop&w=1200&q=80',
  family: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1200&q=80',
  social: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80',
  outdoors: 'https://images.unsplash.com/photo-1534351590666-13e3e96b5017?auto=format&fit=crop&w=1200&q=80',
  music: 'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?auto=format&fit=crop&w=1200&q=80',
  workshops: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=1200&q=80',
  foodie: 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=1200&q=80',
  community: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=80',
  entertainment: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1200&q=80',
  default: 'https://images.unsplash.com/photo-1534351590666-13e3e96b5017?auto=format&fit=crop&w=1200&q=80',
};

// Dutch date format
const formatDate = (dateStr: string) => {
  const datePart = dateStr.split('T')[0].split(' ')[0];
  const date = new Date(datePart + 'T00:00:00');
  return date.toLocaleDateString('nl-NL', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
};

// Short date for pills
const formatDateShort = (dateStr: string) => {
  const datePart = dateStr.split('T')[0].split(' ')[0];
  const eventDate = new Date(datePart + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  if (eventDate.getTime() === today.getTime()) return 'Vandaag';
  if (eventDate.getTime() === tomorrow.getTime()) return 'Morgen';

  return eventDate.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' });
};

import { isMidnightValidCategory } from '@/shared/lib/categories';

// Dutch 24-hour time format with smart midnight suppression
const formatTime = (timeStr: string | undefined | null, category?: string) => {
  if (!timeStr) return null;

  // Check for midnight time - suppress unless it's a nightlife category
  const isMidnight = /^0{1,2}:00(:00)?$/.test(timeStr.trim());

  if (isMidnight && !isMidnightValidCategory(category)) {
    return null; // Return null to hide the time pill entirely
  }

  if (/^\d{1,2}:\d{2}$/.test(timeStr)) {
    const [hours, minutes] = timeStr.split(':');
    return `${hours.padStart(2, '0')}:${minutes}`;
  }
  return timeStr;
};

/**
 * Check if a value is valid for display (not null, undefined, empty, or "Unknown")
 */
function isValidDisplayValue(value: string | null | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized !== '' && normalized !== 'unknown' && normalized !== 'unknown location';
}

/**
 * Open location in native maps app
 */
function openInMaps(lat: number, lng: number, label: string) {
  const encodedLabel = encodeURIComponent(label);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  if (isIOS) {
    window.open(`maps://maps.apple.com/?q=${encodedLabel}&ll=${lat},${lng}`, '_blank');
  } else {
    window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, '_blank');
  }
}

export const EventDetailModal = memo(function EventDetailModal({
  event,
  onClose,
  onJoin,
  isJoining = false,
  hasJoined = false,
  currentUserProfileId,
  onEventSelect,
}: EventDetailModalProps) {
  const [isSaved, setIsSaved] = useState(false);
  const [imageError, setImageError] = useState(false);
  const { location: userLocation } = useLocation();

  const { events: forks, loading: forksLoading } = useEvents({
    parentEventId: event.id,
    currentUserProfileId
  });

  const categoryLabel = CATEGORY_MAP[event.category] || event.category;
  const imageUrl = imageError
    ? (CATEGORY_FALLBACK_IMAGES[categoryLabel] || CATEGORY_FALLBACK_IMAGES.default)
    : (event.image_url || CATEGORY_FALLBACK_IMAGES[categoryLabel] || CATEGORY_FALLBACK_IMAGES.default);

  const parsedCoords = getEventCoordinates(event.location, event.structured_location);
  const hasValidCoords = !!parsedCoords;
  const venueCoords = parsedCoords || null;
  const locationLabel = formatEventLocation(event.venue_name, event.structured_location);
  const staticMapUrl = venueCoords
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${venueCoords.lng - 0.003},${venueCoords.lat - 0.002},${venueCoords.lng + 0.003},${venueCoords.lat + 0.002}&layer=mapnik&marker=${venueCoords.lat},${venueCoords.lng}`
    : '';

  const attendeeDisplay = event.attendees?.slice(0, 8).map(a => ({
    id: a.profile?.id || '',
    image: a.profile?.avatar_url || 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=100',
    alt: a.profile?.full_name || 'Attendee',
  })) || [];

  const trustLabel = event.match_percentage && event.match_percentage >= 70
    ? `${event.match_percentage}% match`
    : event.created_by
      ? 'Actieve host'
      : null;

  // Pre-compute formatted time to avoid duplicate calls
  const formattedTime = formatTime(event.event_time, event.category);

  const handleOpenMaps = useCallback(async () => {
    if (!venueCoords) return;
    await hapticImpact('light');
    openInMaps(venueCoords.lat, venueCoords.lng, event.venue_name);
  }, [venueCoords, event.venue_name]);

  const handleShare = useCallback(async () => {
    await hapticImpact('light');
    if (navigator.share) {
      try {
        await navigator.share({
          title: event.title,
          text: `Check out this event: ${event.title} at ${event.venue_name}`,
          url: window.location.href,
        });
      } catch (err) {
        console.log('Share cancelled');
      }
    }
  }, [event]);

  const handleClose = useCallback(async () => {
    await hapticImpact('light');
    onClose();
  }, [onClose]);

  const handleSave = useCallback(async () => {
    await hapticImpact('light');
    setIsSaved(!isSaved);
  }, [isSaved]);

  const handleJoin = useCallback(async () => {
    if (hasJoined) return;
    await hapticImpact('medium');
    onJoin?.();
  }, [onJoin, hasJoined]);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/70"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        />

        {/* Modal Content - Design System v5.0 "Social Air" */}
        <motion.div
          className="relative w-full max-w-lg bg-white rounded-t-[20px] sm:rounded-[20px] max-h-[92vh] overflow-hidden border border-gray-200 shadow-floating"
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        >
          {/* Drag handle for mobile */}
          <div className="flex justify-center pt-3 pb-1 sm:hidden">
            <div className="w-12 h-1.5 rounded-full bg-gray-200" />
          </div>

          {/* Close button and actions menu - 48pt touch targets */}
          <div className="absolute top-4 right-4 z-20 flex gap-2">
            {/* Actions Menu (Report/Block) */}
            <div className="w-12 h-12 min-h-[48px] min-w-[48px] rounded-[20px] bg-white shadow-card flex items-center justify-center border border-gray-200">
              <EventActionsMenu
                eventId={event.id}
                hostUserId={event.created_by || undefined}
                currentUserProfileId={currentUserProfileId}
                event={event}
              />
            </div>

            {/* Close button - Design System v5.0 */}
            <button
              onClick={handleClose}
              className="w-12 h-12 min-h-[48px] min-w-[48px] rounded-[20px] bg-white shadow-card flex items-center justify-center text-foreground hover:bg-gray-50 transition-all active:scale-[0.95] border border-gray-200"
            >
              <X size={22} strokeWidth={2.5} />
            </button>
          </div>

          <div className="overflow-y-auto max-h-[88vh]">
            {/* Hero Image - Full bleed */}
            <div className="relative aspect-[16/10] overflow-hidden">
              <img
                src={imageUrl}
                alt={event.title}
                className="w-full h-full object-cover"
                onError={() => setImageError(true)}
              />
              {/* Gradient overlay for text readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent" />

              {/* Top badges */}
              <div className="absolute top-4 left-4 flex items-center gap-2">
                <CategoryBadge category={categoryLabel} variant="glass" />
                {trustLabel && (
                  <div className="px-3 py-1.5 rounded-[1rem] bg-primary/90  text-[13px] font-semibold text-primary-foreground flex items-center gap-1.5">
                    <ShieldCheck size={13} />
                    {trustLabel}
                  </div>
                )}
              </div>

              {/* Date pill */}
              <div className="absolute top-4 right-16 px-3 py-1.5 rounded-[1rem] bg-background/90  text-[13px] font-semibold text-foreground border-[0.5px] border-border/20">
                {formatDateShort(event.event_date)}
              </div>

              {/* Title overlay - Bottom of hero */}
              <div className="absolute bottom-0 left-0 right-0 p-5 pt-16">
                <h2 className="text-[26px] font-bold text-foreground leading-tight tracking-tight line-clamp-2">
                  {event.title}
                </h2>
              </div>
            </div>

            {/* Content - iOS spacing with Design System v5.0 "Social Air" */}
            <div className="p-6 pt-3 space-y-5">
              {/* Quick info pills - only render pills with valid data */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-[12px] bg-muted text-[14px] text-foreground font-medium shadow-card">
                  <Calendar size={15} className="text-primary" />
                  {formatDate(event.event_date)}
                </div>
                {/* Time pill - conditionally rendered (hides 00:00 for non-nightlife events) */}
                {formattedTime && (
                  <div className="flex items-center gap-1.5 px-3 py-2 rounded-[12px] bg-muted text-[14px] text-foreground font-medium shadow-card">
                    <Clock size={15} className="text-primary" />
                    {formattedTime}
                  </div>
                )}
                <DistanceBadge
                  venueCoordinates={venueCoords}
                  userLocation={userLocation}
                  className="px-3 py-2 rounded-[12px] bg-muted shadow-card"
                />
              </div>

              {/* Location with Map - only show if we have valid location data */}
              {(hasValidCoords || isValidDisplayValue(event.venue_name)) && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-[15px]">
                    <MapPin size={16} className="text-primary flex-shrink-0" />
                    <span className="text-foreground font-medium">
                      {hasValidCoords ? locationLabel : (isValidDisplayValue(event.venue_name) ? event.venue_name : 'Location TBA')}
                    </span>
                  </div>

                  {/* Static Map - Squircle geometry */}
                  {hasValidCoords ? (
                    <motion.div
                      className="relative h-44 rounded-[20px] overflow-hidden bg-muted cursor-pointer group border border-gray-200 shadow-card"
                      onClick={handleOpenMaps}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                    >
                      <iframe
                        src={staticMapUrl}
                        className="w-full h-full border-0 pointer-events-none"
                        title="Event location map"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />

                      {/* Open in Maps button - Squircle */}
                      <div className="absolute bottom-3 right-3">
                        <div
                          className="flex items-center gap-2 px-4 py-2.5 rounded-[12px] bg-white text-[14px] font-semibold border border-gray-200 shadow-floating"
                        >
                          <Navigation size={15} className="text-primary" />
                          Route
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="relative h-44 rounded-[20px] border border-dashed border-gray-300 bg-muted flex items-center justify-center text-muted-foreground">
                      Location TBA
                    </div>
                  )}
                </div>
              )}

              {/* Description - iOS 17pt equivalent */}
              {event.description && (
                <div className="space-y-2">
                  <h3 className="text-[15px] font-semibold text-foreground">Over dit evenement</h3>
                  <p className="text-muted-foreground text-[16px] leading-relaxed">
                    {event.description}
                  </p>
                </div>
              )}

              {/* Forks / Linked Events Section */}
              {forks.length > 0 && (
                <div className="space-y-3 pt-2">
                  <h3 className="text-[15px] font-semibold text-foreground flex items-center gap-2">
                    <GitFork size={15} />
                    Gekoppelde Events
                  </h3>
                  <div className="space-y-3">
                    {forks.map((fork: EventWithAttendees) => (
                      <ForkEventCard
                        key={fork.id}
                        event={fork}
                        currentUserProfileId={currentUserProfileId}
                        onClick={() => {
                          onEventSelect?.(fork);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        showConnector={false}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Attendees section */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-[15px] font-semibold text-foreground">
                    Wie gaan er?
                  </h3>
                  <span className="text-[14px] text-muted-foreground font-medium">
                    {event.attendee_count || 0} personen
                    {event.max_attendees && ` · ${event.max_attendees - (event.attendee_count || 0)} plekken over`}
                  </span>
                </div>

                {attendeeDisplay.length > 0 && (
                  <div className="flex items-center gap-3">
                    <Facepile
                      users={attendeeDisplay}
                      extraCount={Math.max(0, (event.attendee_count || 0) - attendeeDisplay.length)}
                    />
                  </div>
                )}
              </div>

              {/* Scroll indicator */}
              <div className="flex justify-center py-2">
                <ChevronDown size={20} className="text-muted-foreground/40 animate-bounce" />
              </div>
            </div>
          </div>

          {/* Fixed Bottom Action Bar - Design System v5.0 "Social Air" */}
          <div
            className="sticky bottom-0 left-0 right-0 p-4 pb-safe bg-white border-t border-gray-200 shadow-bottom-nav"
          >
            <div className="flex gap-3 items-center">
              {/* Secondary actions - 52pt buttons */}
              {event.website_url && (
                <button
                  onClick={() => {
                    hapticImpact('light');
                    window.open(event.website_url!, '_blank');
                  }}
                  className="w-[52px] h-[52px] min-h-[48px] min-w-[48px] rounded-[12px] bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-gray-200 transition-all active:scale-[0.95] border border-gray-200"
                  aria-label="Event Website"
                >
                  <Globe size={22} />
                </button>
              )}

              <button
                onClick={handleShare}
                className="w-[52px] h-[52px] min-h-[48px] min-w-[48px] rounded-[12px] bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-gray-200 transition-all active:scale-[0.95] border border-gray-200"
              >
                <Share2 size={22} />
              </button>

              <button
                onClick={handleSave}
                className={`w-[52px] h-[52px] min-h-[48px] min-w-[48px] rounded-[12px] flex items-center justify-center transition-all active:scale-[0.95] border ${isSaved
                  ? 'bg-primary/10 text-primary border-primary/30'
                  : 'bg-muted text-muted-foreground border-gray-200 hover:bg-gray-200 hover:text-foreground'
                  }`}
              >
                <Bookmark size={22} fill={isSaved ? 'currentColor' : 'none'} />
              </button>

              {/* Primary CTA - Design System v5.0 */}
              <button
                onClick={handleJoin}
                disabled={isJoining || hasJoined}
                className={`flex-1 h-[52px] min-h-[48px] rounded-[12px] text-[17px] font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.97] shadow-card ${hasJoined
                  ? 'bg-muted text-muted-foreground'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
                  }`}
              >
                {isJoining ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    <span>Aanmelden...</span>
                  </>
                ) : hasJoined ? (
                  <>
                    <span>✓</span>
                    <span>Je bent aangemeld</span>
                  </>
                ) : (
                  <>
                    <Users size={20} />
                    <span>Meedoen</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
});

export default EventDetailModal;
