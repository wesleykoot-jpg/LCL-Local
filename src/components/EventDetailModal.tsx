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
  ExternalLink,
  Loader2,
  Navigation
} from 'lucide-react';
import { CategoryBadge } from './CategoryBadge';
import { Facepile } from './Facepile';
import { DistanceBadge } from './DistanceBadge';
import { CATEGORY_MAP } from '@/lib/categories';
import { getVenueCoordinates } from '@/lib/distance';
import type { EventWithAttendees } from '@/lib/hooks';

interface EventDetailModalProps {
  event: EventWithAttendees;
  onClose: () => void;
  onJoin?: () => Promise<void>;
  isJoining?: boolean;
}

// Fallback images by category
const CATEGORY_FALLBACK_IMAGES: Record<string, string> = {
  active: 'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?auto=format&fit=crop&w=900&q=80',
  gaming: 'https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?auto=format&fit=crop&w=900&q=80',
  family: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=900&q=80',
  social: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=900&q=80',
  outdoors: 'https://images.unsplash.com/photo-1534351590666-13e3e96b5017?auto=format&fit=crop&w=900&q=80',
  music: 'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?auto=format&fit=crop&w=900&q=80',
  workshops: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=900&q=80',
  foodie: 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=900&q=80',
  community: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=900&q=80',
  entertainment: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=900&q=80',
  default: 'https://images.unsplash.com/photo-1534351590666-13e3e96b5017?auto=format&fit=crop&w=900&q=80',
};

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric',
    year: 'numeric'
  });
};

const formatTime = (timeStr: string) => {
  const [hours, minutes] = timeStr.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
};

/**
 * Open location in native maps app (iOS Maps or Google Maps)
 */
function openInMaps(lat: number, lng: number, label: string) {
  const encodedLabel = encodeURIComponent(label);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  
  if (isIOS) {
    // iOS Maps URL scheme
    window.open(`maps://maps.apple.com/?q=${encodedLabel}&ll=${lat},${lng}`, '_blank');
  } else {
    // Google Maps URL for Android/Web
    window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, '_blank');
  }
}

export const EventDetailModal = memo(function EventDetailModal({
  event,
  onClose,
  onJoin,
  isJoining = false,
}: EventDetailModalProps) {
  const [isSaved, setIsSaved] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  // Check if this is a mock event (cannot be joined)
  const isMockEvent = event.id.startsWith('mock-');

  const categoryLabel = CATEGORY_MAP[event.category] || event.category;
  const imageUrl = imageError 
    ? (CATEGORY_FALLBACK_IMAGES[categoryLabel] || CATEGORY_FALLBACK_IMAGES.default)
    : (event.image_url || CATEGORY_FALLBACK_IMAGES[categoryLabel] || CATEGORY_FALLBACK_IMAGES.default);

  const venueCoords = getVenueCoordinates(event.venue_name);
  
  // Static map using OpenStreetMap
  const staticMapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${venueCoords.lng - 0.003},${venueCoords.lat - 0.002},${venueCoords.lng + 0.003},${venueCoords.lat + 0.002}&layer=mapnik&marker=${venueCoords.lat},${venueCoords.lng}`;

  const attendeeDisplay = event.attendees?.slice(0, 6).map(a => ({
    id: a.profile?.id || '',
    image: a.profile?.avatar_url || 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=100',
    alt: a.profile?.full_name || 'Attendee',
  })) || [];

  const handleOpenMaps = useCallback(() => {
    openInMaps(venueCoords.lat, venueCoords.lng, event.venue_name);
  }, [venueCoords, event.venue_name]);

  const handleShare = useCallback(async () => {
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
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        />

        {/* Modal Content */}
        <motion.div
          className="relative w-full max-w-lg bg-background rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-hidden"
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        >
          {/* Drag handle for mobile */}
          <div className="flex justify-center pt-3 pb-2 sm:hidden">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors"
          >
            <X size={18} />
          </button>

          <div className="overflow-y-auto max-h-[85vh]">
            {/* Hero Image */}
            <div className="relative h-56 overflow-hidden">
              <img
                src={imageUrl}
                alt={event.title}
                className="w-full h-full object-cover"
                onError={() => setImageError(true)}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              
              {/* Category Badge */}
              <div className="absolute bottom-4 left-4">
                <CategoryBadge category={categoryLabel} variant="glass" />
              </div>

              {/* Match percentage */}
              {event.match_percentage && (
                <div className="absolute bottom-4 right-4 px-3 py-1.5 rounded-full bg-primary/90 text-primary-foreground text-xs font-bold">
                  {event.match_percentage}% Match
                </div>
              )}
            </div>

            {/* Content */}
            <div className="p-5 space-y-5">
              {/* Title & Distance */}
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-foreground leading-tight">
                  {event.title}
                </h2>
                <DistanceBadge venueName={event.venue_name} />
              </div>

              {/* Date & Time */}
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-2">
                  <Calendar size={16} className="text-primary" />
                  {formatDate(event.event_date)}
                </span>
                <span className="flex items-center gap-2">
                  <Clock size={16} className="text-primary" />
                  {formatTime(event.event_time)}
                </span>
              </div>

              {/* Location with Static Map */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <MapPin size={16} className="text-primary flex-shrink-0" />
                  <span className="text-foreground font-medium">{event.venue_name}</span>
                </div>

                {/* Static Map */}
                <div 
                  className="relative h-40 rounded-2xl overflow-hidden bg-muted cursor-pointer group"
                  onClick={handleOpenMaps}
                >
                  <iframe
                    src={staticMapUrl}
                    className="w-full h-full border-0 pointer-events-none"
                    title="Event location map"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                  
                  {/* Open in Maps button */}
                  <div className="absolute bottom-3 right-3">
                    <button
                      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-background/95 backdrop-blur-sm text-sm font-medium shadow-lg hover:bg-background transition-colors"
                    >
                      <Navigation size={14} className="text-primary" />
                      Open in Maps
                      <ExternalLink size={12} className="opacity-60" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Description */}
              {event.description && (
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {event.description}
                </p>
              )}

              {/* Attendees */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">
                    {event.attendee_count || 0} people going
                  </span>
                  {event.max_attendees && (
                    <span className="text-xs text-muted-foreground">
                      {event.max_attendees - (event.attendee_count || 0)} spots left
                    </span>
                  )}
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

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 pb-2">
                {/* Secondary actions */}
                <button
                  onClick={handleShare}
                  className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors"
                >
                  <Share2 size={20} />
                </button>
                
                <button
                  onClick={() => setIsSaved(!isSaved)}
                  className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                    isSaved 
                      ? 'bg-primary/10 text-primary' 
                      : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                  }`}
                >
                  <Bookmark size={20} fill={isSaved ? 'currentColor' : 'none'} />
                </button>

                {/* Primary action */}
                <button
                  onClick={() => {
                    if (!isMockEvent) {
                      onJoin?.();
                    }
                  }}
                  disabled={isJoining || isMockEvent}
                  className="flex-1 h-12 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50 active:scale-[0.98]"
                  title={isMockEvent ? 'Demo event - cannot join' : undefined}
                >
                  {isJoining ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Joining...
                    </>
                  ) : isMockEvent ? (
                    <>
                      <Users size={18} />
                      Demo Event
                    </>
                  ) : (
                    <>
                      <Users size={18} />
                      Join Event
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
});

export default EventDetailModal;
