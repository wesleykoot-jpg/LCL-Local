import { memo, useRef, useCallback, useState } from "react";
import { motion } from "framer-motion";
import { ChevronRight, Users, Clock, MapPin, Heart } from "lucide-react";
import { hapticImpact } from "@/shared/lib/haptics";
import { formatEventDate, formatEventTime } from "@/shared/lib/formatters.ts";
import { useImageFallback } from "../hooks/useImageFallback.ts";
import type { EventWithAttendees } from "../hooks/hooks.ts";

interface HorizontalEventCarouselProps {
  title: string;
  events: EventWithAttendees[];
  onEventClick?: (eventId: string) => void;
  onJoinEvent?: (eventId: string) => Promise<void>;
  joiningEventId?: string;
  currentUserProfileId?: string;
  onSeeAll?: () => void;
}

// Airbnb-style carousel card
const CarouselEventCard = memo(function CarouselEventCard({
  event,
  onClick,
}: {
  event: EventWithAttendees;
  onClick?: () => void;
  onJoin?: () => void;
  isJoining?: boolean;
  hasJoined?: boolean;
}) {
  const [isSaved, setIsSaved] = useState(false);
  const { src: imageUrl, onError: handleImageError } = useImageFallback(
    event.image_url || "",
    event.category,
  );

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await hapticImpact("light");
    setIsSaved(!isSaved);
  };

  return (
    <motion.div
      className="shrink-0 w-[260px] cursor-pointer group"
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
    >
      {/* Image */}
      <div className="relative aspect-4/3 rounded-xl overflow-hidden bg-muted mb-2">
        <img
          src={imageUrl}
          onError={handleImageError}
          alt={event.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />

        {/* Heart button - Airbnb style */}
        <button
          type="button"
          onClick={handleSave}
          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90  flex items-center justify-center hover:scale-110 transition-transform shadow-sm"
        >
          <Heart
            size={14}
            className={
              isSaved ? "text-primary fill-primary" : "text-foreground"
            }
          />
        </button>

        {/* Date badge */}
        <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-white/95  text-[12px] font-semibold text-foreground shadow-sm">
          {formatEventDate(event.event_date || "")}
        </div>
      </div>

      {/* Content - Below image */}
      <div className="space-y-1">
        <h3 className="text-[15px] font-semibold text-foreground leading-tight line-clamp-1">
          {event.title}
        </h3>

        <p className="text-[13px] text-muted-foreground line-clamp-1 flex items-center gap-1">
          <MapPin size={12} className="shrink-0" />
          {event.venue_name}
        </p>

        <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
          {formatEventTime(event.event_time || "") && (
            <span className="flex items-center gap-1">
              <Clock size={11} />
              {formatEventTime(event.event_time || "")}
            </span>
          )}
          <span>•</span>
          <span className="flex items-center gap-1">
            <Users size={11} />
            {event.attendee_count || 0}
          </span>
        </div>
      </div>
    </motion.div>
  );
});

export const HorizontalEventCarousel = memo(function HorizontalEventCarousel({
  title,
  events,
  onEventClick,
  onJoinEvent,
  joiningEventId,
  currentUserProfileId,
  onSeeAll,
}: HorizontalEventCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleSeeAll = useCallback(async () => {
    await hapticImpact("light");
    onSeeAll?.();
  }, [onSeeAll]);

  if (events.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between px-6 mb-4">
        <h2 className="text-[18px] font-semibold text-foreground">{title}</h2>
        {onSeeAll && events.length > 3 && (
          <button
            type="button"
            onClick={handleSeeAll}
            className="flex items-center gap-0.5 text-[14px] font-medium text-foreground hover:underline min-h-[44px] px-2 active:opacity-70"
          >
            <span>See all</span>
            <ChevronRight size={16} />
          </button>
        )}
      </div>

      {/* Horizontal scroll */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-4 px-6 scrollbar-hide snap-x snap-mandatory"
      >
        {events.map((event) => {
          const hasJoined = Boolean(
            currentUserProfileId &&
            event.attendees?.some(
              (attendee) => attendee.profile?.id === currentUserProfileId,
            ),
          );

          return (
            <div key={event.id} className="snap-start">
              <CarouselEventCard
                event={event}
                onClick={() => onEventClick?.(event.id)}
                onJoin={() => onJoinEvent?.(event.id)}
                isJoining={joiningEventId === event.id}
                hasJoined={hasJoined}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
});
