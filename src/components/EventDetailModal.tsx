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
  Loader2,
  ShieldCheck,
  ChevronDown,
  Phone,
  Globe,
  Ticket
} from 'lucide-react';
import { CategoryBadge } from './CategoryBadge';
import { EventActionsMenu } from '@/features/events/components/EventActionsMenu';
import { Facepile } from './Facepile';
import { DistanceBadge } from './DistanceBadge';
import { CATEGORY_MAP } from '@/lib/categories';
import { useLocation } from '@/contexts/LocationContext';
import { hapticImpact } from '@/lib/haptics';
import type { EventWithAttendees } from '@/features/events/hooks/hooks';

interface EventDetailModalProps {
  event: EventWithAttendees;
  onClose: () => void;
  onJoin?: () => Promise<void>;
  isJoining?: boolean;
  hasJoined?: boolean;
  currentUserProfileId?: string;
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

// Dutch 24-hour time format
const formatTime = (timeStr: string) => {
  if (!timeStr) return '';
  if (/^\d{1,2}:\d{2}$/.test(timeStr)) {
    const [hours, minutes] = timeStr.split(':');
    return `${hours.padStart(2, '0')}:${minutes}`;
  }
  return timeStr;
};

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

/**
 * Parse PostGIS POINT format to coordinates
 */
function parseEventLocation(location: unknown): { lat: number; lng: number } | null {
  if (!location) return null;
  
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
  hasJoined = false,
  currentUserProfileId,
}: EventDetailModalProps) {
  const [isSaved, setIsSaved] = useState(false);
  const [imageError, setImageError] = useState(false);
  const { location: userLocation } = useLocation();

  const categoryLabel = CATEGORY_MAP[event.category] || event.category;
  const imageUrl = imageError 
    ? (CATEGORY_FALLBACK_IMAGES[categoryLabel] || CATEGORY_FALLBACK_IMAGES.default)
    : (event.image_url || CATEGORY_FALLBACK_IMAGES[categoryLabel] || CATEGORY_FALLBACK_IMAGES.default);

  const venueCoords = parseEventLocation(event.location) || { lat: 52.5, lng: 6.0 };
  
  const staticMapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${venueCoords.lng - 0.003},${venueCoords.lat - 0.002},${venueCoords.lng + 0.003},${venueCoords.lat + 0.002}&layer=mapnik&marker=${venueCoords.lat},${venueCoords.lng}`;

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
    if (hasJoined) return;
    await hapticImpact('medium');
    onJoin?.();
  }, [onJoin, hasJoined]);

  // Action Bar handlers for venue/event utility actions
  const handleCall = useCallback(async () => {
    const phone = (event as EventWithAttendees & { contact_phone?: string }).contact_phone;
    if (!phone) return;
    await hapticImpact('light');
    window.location.href = `tel:${phone}`;
  }, [event]);

  const handleWebsite = useCallback(async () => {
    const website = (event as EventWithAttendees & { website_url?: string }).website_url;
    if (!website) return;
    await hapticImpact('light');
    window.open(website, '_blank', 'noopener,noreferrer');
  }, [event]);

  const handleTickets = useCallback(async () => {
    const ticketUrl = (event as EventWithAttendees & { ticket_url?: string }).ticket_url;
    if (!ticketUrl) return;
    await hapticImpact('light');
    window.open(ticketUrl, '_blank', 'noopener,noreferrer');
  }, [event]);

  // Check which action buttons should be displayed
  const hasContactPhone = !!(event as EventWithAttendees & { contact_phone?: string }).contact_phone;
  const hasWebsiteUrl = !!(event as EventWithAttendees & { website_url?: string }).website_url;
  const hasTicketUrl = !!(event as EventWithAttendees & { ticket_url?: string }).ticket_url;
  const hasActionBar = hasContactPhone || hasWebsiteUrl || hasTicketUrl;

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
          className="absolute inset-0 bg-black/70 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        />

        {/* Modal Content - Squircle geometry */}
        <motion.div
          className="relative w-full max-w-lg bg-background rounded-t-[2.5rem] sm:rounded-[2.5rem] max-h-[92vh] overflow-hidden border-[0.5px] border-border/20"
          style={{
            boxShadow: '0 -8px 40px -8px rgba(0, 0, 0, 0.3), 0 0 0 0.5px rgba(255, 255, 255, 0.1)'
          }}
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        >
          {/* Drag handle for mobile */}
          <div className="flex justify-center pt-3 pb-1 sm:hidden">
            <div className="w-12 h-1.5 rounded-full bg-muted-foreground/20" />
          </div>

          {/* Close button and actions menu - 48pt touch targets */}
          <div className="absolute top-4 right-4 z-20 flex gap-2">
            {/* Actions Menu (Report/Block) */}
            <div className="w-12 h-12 min-h-[48px] min-w-[48px] rounded-[1.25rem] bg-black/40 backdrop-blur-xl flex items-center justify-center border-[0.5px] border-white/10">
              <EventActionsMenu
                eventId={event.id}
                hostUserId={event.created_by || undefined}
                currentUserProfileId={currentUserProfileId}
              />
            </div>
            
            {/* Close button */}
            <button
              onClick={handleClose}
              className="w-12 h-12 min-h-[48px] min-w-[48px] rounded-[1.25rem] bg-black/40 backdrop-blur-xl flex items-center justify-center text-white hover:bg-black/60 transition-all active:scale-[0.95] border-[0.5px] border-white/10"
            >
              <X size={22} strokeWidth={2.5} />
            </button>
          </div>

          <div className="overflow-y-auto max-h-[88vh]">
            {/* Netflix-style Hero Image - Full bleed, taller */}
            <div className="relative aspect-[16/10] overflow-hidden">
              <img
                src={imageUrl}
                alt={event.title}
                className="w-full h-full object-cover"
                onError={() => setImageError(true)}
              />
              {/* Cinematic gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-background/40 via-transparent to-transparent" />
              
              {/* Top badges */}
              <div className="absolute top-4 left-4 flex items-center gap-2">
                <CategoryBadge category={categoryLabel} variant="glass" />
                {trustLabel && (
                  <div className="px-3 py-1.5 rounded-[1rem] bg-primary/90 backdrop-blur-xl text-[13px] font-semibold text-primary-foreground flex items-center gap-1.5">
                    <ShieldCheck size={13} />
                    {trustLabel}
                  </div>
                )}
              </div>

              {/* Date pill - only show if date is available */}
              {event.event_date && (
                <div className="absolute top-4 right-16 px-3 py-1.5 rounded-[1rem] bg-background/90 backdrop-blur-xl text-[13px] font-semibold text-foreground border-[0.5px] border-border/20">
                  {formatDateShort(event.event_date)}
                </div>
              )}

              {/* Title overlay - Bottom of hero */}
              <div className="absolute bottom-0 left-0 right-0 p-5 pt-16">
                <h2 className="text-[26px] font-bold text-foreground leading-tight tracking-tight line-clamp-2">
                  {event.title}
                </h2>
              </div>
            </div>

            {/* Content - iOS spacing */}
            <div className="p-5 pt-3 space-y-5">
              {/* Quick info pills */}
              <div className="flex flex-wrap items-center gap-2">
                {event.event_date && (
                  <div className="flex items-center gap-1.5 px-3 py-2 rounded-[1rem] bg-muted/50 text-[14px] text-foreground font-medium">
                    <Calendar size={15} className="text-primary" />
                    {formatDate(event.event_date)}
                  </div>
                )}
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-[1rem] bg-muted/50 text-[14px] text-foreground font-medium">
                  <Clock size={15} className="text-primary" />
                  {formatTime(event.event_time)}
                </div>
                <DistanceBadge 
                  venueCoordinates={venueCoords} 
                  userLocation={userLocation}
                  className="px-3 py-2 rounded-[1rem] bg-muted/50"
                />
              </div>

              {/* Location with Map - Squircle */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-[15px]">
                  <MapPin size={16} className="text-primary flex-shrink-0" />
                  <span className="text-foreground font-medium">{event.venue_name}</span>
                </div>

                {/* Static Map - Squircle geometry */}
                <motion.div 
                  className="relative h-44 rounded-[1.5rem] overflow-hidden bg-muted cursor-pointer group border-[0.5px] border-border/30"
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
                      className="flex items-center gap-2 px-4 py-2.5 rounded-[1rem] bg-background/95 backdrop-blur-xl text-[14px] font-semibold border-[0.5px] border-border/30"
                      style={{
                        boxShadow: '0 4px 12px -2px rgba(0, 0, 0, 0.12)'
                      }}
                    >
                      <Navigation size={15} className="text-primary" />
                      Route
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Description - iOS 17pt equivalent */}
              {event.description && (
                <div className="space-y-2">
                  <h3 className="text-[15px] font-semibold text-foreground">Over dit evenement</h3>
                  <p className="text-muted-foreground text-[16px] leading-relaxed">
                    {event.description}
                  </p>
                </div>
              )}

              {/* Action Bar - Utility actions (Call / Website / Tickets) */}
              {hasActionBar && (
                <div className="space-y-2">
                  <h3 className="text-[15px] font-semibold text-foreground">Snelle acties</h3>
                  <div className="flex flex-wrap gap-2">
                    {hasContactPhone && (
                      <button
                        onClick={handleCall}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-[1rem] bg-muted/60 text-foreground text-[14px] font-medium hover:bg-muted transition-all active:scale-[0.97] border-[0.5px] border-border/30"
                        aria-label="Bellen"
                        data-testid="action-call"
                      >
                        <Phone size={16} className="text-primary" />
                        <span>Bellen</span>
                      </button>
                    )}
                    
                    {hasWebsiteUrl && (
                      <button
                        onClick={handleWebsite}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-[1rem] bg-muted/60 text-foreground text-[14px] font-medium hover:bg-muted transition-all active:scale-[0.97] border-[0.5px] border-border/30"
                        aria-label="Website bezoeken"
                        data-testid="action-website"
                      >
                        <Globe size={16} className="text-primary" />
                        <span>Website</span>
                      </button>
                    )}
                    
                    {hasTicketUrl && (
                      <button
                        onClick={handleTickets}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-[1rem] bg-primary/10 text-primary text-[14px] font-semibold hover:bg-primary/20 transition-all active:scale-[0.97] border-[0.5px] border-primary/20"
                        aria-label="Tickets kopen"
                        data-testid="action-tickets"
                      >
                        <Ticket size={16} />
                        <span>Tickets</span>
                      </button>
                    )}
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

          {/* Fixed Bottom Action Bar - Thumb zone optimized */}
          <div 
            className="sticky bottom-0 left-0 right-0 p-4 pb-safe bg-background/95 backdrop-blur-xl border-t border-[0.5px] border-border/30"
            style={{
              boxShadow: '0 -4px 20px -4px rgba(0, 0, 0, 0.08)'
            }}
          >
            <div className="flex gap-3 items-center">
              {/* Secondary actions - 52pt squircle buttons */}
              <button
                onClick={handleShare}
                className="w-[52px] h-[52px] min-h-[48px] min-w-[48px] rounded-[1.5rem] bg-muted/60 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all active:scale-[0.95] border-[0.5px] border-border/30"
              >
                <Share2 size={22} />
              </button>
              
              <button
                onClick={handleSave}
                className={`w-[52px] h-[52px] min-h-[48px] min-w-[48px] rounded-[1.5rem] flex items-center justify-center transition-all active:scale-[0.95] border-[0.5px] ${
                  isSaved 
                    ? 'bg-primary/10 text-primary border-primary/30' 
                    : 'bg-muted/60 text-muted-foreground border-border/30 hover:bg-muted hover:text-foreground'
                }`}
              >
                <Bookmark size={22} fill={isSaved ? 'currentColor' : 'none'} />
              </button>

              {/* Primary CTA - Squircle, full height */}
              <button
                onClick={handleJoin}
                disabled={isJoining || hasJoined}
                className={`flex-1 h-[52px] min-h-[48px] rounded-[1.5rem] text-[17px] font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.97] border-[0.5px] ${
                  hasJoined
                    ? 'bg-muted text-muted-foreground border-border/30'
                    : 'bg-primary text-primary-foreground border-primary/20 hover:bg-primary/90'
                }`}
                style={{
                  boxShadow: hasJoined ? 'none' : '0 4px 12px -2px rgba(var(--primary) / 0.25)'
                }}
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
