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
import { useLocation } from '@/contexts/LocationContext';
import { hapticImpact } from '@/lib/haptics';
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

// Dutch date format
const formatDate = (dateStr: string) => {
  // Handle full ISO timestamps from Supabase
  const datePart = dateStr.split('T')[0].split(' ')[0];
  const date = new Date(datePart + 'T00:00:00');
  return date.toLocaleDateString('nl-NL', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric',
    year: 'numeric'
  });
};

// Dutch 24-hour time format
const formatTime = (timeStr: string) => {
  const [hours, minutes] = timeStr.split(':');
  return `${hours}:${minutes}`;
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

/**
 * Parse PostGIS POINT format to coordinates
 */
function parseEventLocation(location: unknown): { lat: number; lng: number } | null {
  if (!location) return null;
  
  // Handle string format: "POINT(lng lat)"
  if (typeof location === 'string') {
    const match = location.match(/POINT\s*\(\s*([+-]?\d+\.?\d*)\s+([+-]?\d+\.?\d*)\s*\)/i);
    if (match) {
      return { lng: parseFloat(match[1]), lat: parseFloat(match[2]) };
    }
  }
  
  return null;
}

export const EventDetailModal = memo(function EventDetailModal({
  event,
  onClose,
  onJoin,
  isJoining = false,
}: EventDetailModalProps) {
  const [isSaved, setIsSaved] = useState(false);
  const [imageError, setImageError] = useState(false);
  const { location: userLocation } = useLocation();

  const categoryLabel = CATEGORY_MAP[event.category] || event.category;
  const imageUrl = imageError 
    ? (CATEGORY_FALLBACK_IMAGES[categoryLabel] || CATEGORY_FALLBACK_IMAGES.default)
    : (event.image_url || CATEGORY_FALLBACK_IMAGES[categoryLabel] || CATEGORY_FALLBACK_IMAGES.default);

  // Get coordinates from event's location column (PostGIS)
  const venueCoords = parseEventLocation(event.location) || { lat: 52.5, lng: 6.0 };
  
  // Static map using OpenStreetMap
  const staticMapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${venueCoords.lng - 0.003},${venueCoords.lat - 0.002},${venueCoords.lng + 0.003},${venueCoords.lat + 0.002}&layer=mapnik&marker=${venueCoords.lat},${venueCoords.lng}`;

  const attendeeDisplay = event.attendees?.slice(0, 6).map(a => ({
    id: a.profile?.id || '',
    image: a.profile?.avatar_url || 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=100',
    alt: a.profile?.full_name || 'Attendee',
  })) || [];

  const handleOpenMaps = useCallback(async () => {
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
    await hapticImpact('medium');
    onJoin?.();
  }, [onJoin]);

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

          {/* Close button - 44pt touch target */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 z-10 w-11 h-11 min-h-[44px] min-w-[44px] rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-all active:scale-[0.95]"
          >
            <X size={20} />
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
                <DistanceBadge venueName={event.venue_name} userLocation={userLocation} />
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
                      Open in Kaarten
                      <ExternalLink size={12} className="opacity-60" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Description - improved legibility (15px) */}
              {event.description && (
                <p className="text-muted-foreground text-[15px] leading-relaxed">
                  {event.description}
                </p>
              )}

              {/* Attendees */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">
                    {event.attendee_count || 0} personen gaan
                  </span>
                  {event.max_attendees && (
                    <span className="text-xs text-muted-foreground">
                      {event.max_attendees - (event.attendee_count || 0)} plekken over
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

              {/* Action Buttons - with safe area padding */}
              <div className="flex gap-3 pt-4 pb-2 pb-safe">
                {/* Secondary actions - 44pt touch targets */}
                <button
                  onClick={handleShare}
                  className="w-12 h-12 min-h-[44px] min-w-[44px] rounded-2xl bg-muted flex items-center justify-center text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-all active:scale-[0.95]"
                >
                  <Share2 size={20} />
                </button>
                
                <button
                  onClick={handleSave}
                  className={`w-12 h-12 min-h-[44px] min-w-[44px] rounded-2xl flex items-center justify-center transition-all active:scale-[0.95] ${
                    isSaved 
                      ? 'bg-primary/10 text-primary' 
                      : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                  }`}
                >
                  <Bookmark size={20} fill={isSaved ? 'currentColor' : 'none'} />
                </button>

                {/* Primary action - rounded-2xl for squircle */}
                <button
                  onClick={handleJoin}
                  disabled={isJoining}
                  className="flex-1 h-12 min-h-[44px] rounded-2xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-all disabled:opacity-50 active:scale-[0.97]"
                >
                  {isJoining ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Aanmelden...
                    </>
                  ) : (
                    <>
                      <Users size={18} />
                      Meedoen
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
