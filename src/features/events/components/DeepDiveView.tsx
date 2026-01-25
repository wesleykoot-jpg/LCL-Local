import { memo, useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Map,
  Clock,
  Users,
  MapPin,
  Heart,
  Loader2,
  Check,
  SlidersHorizontal,
} from "lucide-react";
import { LoadingSkeleton } from "@/shared/components/index.ts";
import { TimeFilterPills, type TimeFilter } from "./TimeFilterPills.tsx";
import EventMap from "./EventMap.tsx";
import { hapticImpact } from "@/shared/lib/haptics.ts";
import { useImageFallback } from "../hooks/useImageFallback.ts";
import type { EventWithAttendees } from "../hooks/hooks.ts";
import { Button } from "@/shared/components/ui/button.tsx";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef, useEffect } from "react";

interface DeepDiveViewProps {
  events: EventWithAttendees[];
  onEventClick?: (eventId: string) => void;
  onJoinEvent?: (eventId: string) => Promise<void>;
  isJoining: (eventId: string) => boolean;
  isSaved: (eventId: string) => boolean;
  onSave: (event: EventWithAttendees) => void;
  currentUserProfileId?: string;
  loading?: boolean;
  /** Callback when filter button is clicked */
  onFilterClick?: () => void;
  /** Callback for infinite scroll */
  onLoadMore?: () => void;
  hasMore?: boolean;
}

// Helper to parse date as local
function parseLocalDate(dateString: string): Date {
  const datePart = dateString.split("T")[0].split(" ")[0];
  const [year, month, day] = datePart.split("-").map(Number);
  return new Date(year, month - 1, day);
}

// Filter events by time
function filterByTime(
  events: EventWithAttendees[],
  filter: TimeFilter,
): EventWithAttendees[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  switch (filter) {
    case "tonight":
      return events.filter((e) => {
        if (!e.event_date) return false;
        const eventDay = parseLocalDate(e.event_date);
        return eventDay.getTime() === today.getTime();
      });
    case "tomorrow": {
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      return events.filter((e) => {
        if (!e.event_date) return false;
        const eventDay = parseLocalDate(e.event_date);
        return eventDay.getTime() === tomorrow.getTime();
      });
    }
    case "weekend": {
      const dayOfWeek = today.getDay();
      const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7;
      const friday = new Date(today);
      friday.setDate(today.getDate() + daysUntilFriday);
      friday.setHours(0, 0, 0, 0);
      const sunday = new Date(friday);
      sunday.setDate(friday.getDate() + 2);
      sunday.setHours(23, 59, 59, 999);
      return events.filter((e) => {
        if (!e.event_date) return false;
        const eventDay = parseLocalDate(e.event_date);
        return eventDay >= friday && eventDay <= sunday;
      });
    }
    case "all":
    default:
      return events;
  }
}

// Format event time
function formatTime(timeStr: string | null): string {
  if (!timeStr) return "";
  if (/^\d{1,2}:\d{2}$/.test(timeStr)) {
    const [hours, minutes] = timeStr.split(":").map(Number);
    const period = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
  }
  return timeStr;
}

// Format event date
function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const datePart = dateStr.split("T")[0].split(" ")[0];
  const eventDate = new Date(datePart + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  if (eventDate.getTime() === today.getTime()) {
    return "Vandaag";
  } else if (eventDate.getTime() === tomorrow.getTime()) {
    return "Morgen";
  }

  return eventDate.toLocaleDateString("nl-NL", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// Masonry Card component
const MasonryEventCard = memo(function MasonryEventCard({
  event,
  onClick,
  onJoin,
  isJoining,
  isSaved,
  onSave,
  hasJoined,
  tall = false,
}: {
  event: EventWithAttendees;
  onClick?: () => void;
  onJoin?: () => void;
  isJoining?: boolean;
  isSaved?: boolean;
  onSave?: () => void;
  hasJoined?: boolean;
  tall?: boolean;
}) {
  const { src: imageUrl, onError: handleImageError } = useImageFallback(
    event.image_url || "",
    event.category,
  );

  const handleSave = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      await hapticImpact("light");
      onSave?.();
    },
    [onSave],
  );

  const handleJoinClick = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!hasJoined) {
        await hapticImpact("medium");
        onJoin?.();
      }
    },
    [hasJoined, onJoin],
  );

  return (
    <motion.div
      className="rounded-xl overflow-hidden bg-card shadow-sm border border-border/50 cursor-pointer group"
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      layout
    >
      {/* Image */}
      <div
        className={`relative overflow-hidden bg-muted ${tall ? "aspect-3/4" : "aspect-square"}`}
      >
        <img
          src={imageUrl}
          onError={handleImageError}
          alt={event.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />

        {/* Heart button */}
        <button
          type="button"
          onClick={handleSave}
          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90  flex items-center justify-center hover:scale-110 transition-transform shadow-sm"
        >
          <Heart
            size={16}
            className={
              isSaved ? "text-primary fill-primary" : "text-foreground"
            }
          />
        </button>

        {/* Date badge */}
        <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-white/95  text-[11px] font-semibold text-foreground shadow-sm">
          {formatDate(event.event_date)}
        </div>
      </div>

      {/* Content */}
      <div className="p-3 space-y-1.5">
        <h3 className="text-[14px] font-semibold text-foreground leading-tight line-clamp-2">
          {event.title}
        </h3>

        <p className="text-[12px] text-muted-foreground line-clamp-1 flex items-center gap-1">
          <MapPin size={11} className="shrink-0" />
          {event.venue_name}
        </p>

        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          {formatTime(event.event_time) && (
            <span className="flex items-center gap-1">
              <Clock size={10} />
              {formatTime(event.event_time)}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Users size={10} />
            {event.attendee_count || 0}
          </span>
        </div>

        {/* Quick join button */}
        <button
          type="button"
          onClick={handleJoinClick}
          disabled={isJoining || hasJoined}
          className={`
            w-full py-2 rounded-lg text-[12px] font-semibold transition-all active:scale-[0.98] mt-2
            ${
              hasJoined
                ? "bg-muted text-muted-foreground"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            }
          `}
        >
          {isJoining ? (
            <Loader2 size={14} className="animate-spin mx-auto" />
          ) : hasJoined ? (
            <span className="flex items-center justify-center gap-1">
              <Check size={12} /> Aangemeld
            </span>
          ) : (
            "Meedoen"
          )}
        </button>
      </div>
    </motion.div>
  );
});

/**
 * DeepDiveView - Search/filter view with masonry layout
 *
 * Features:
 * - Sticky filter bar with date pills and filter button
 * - Glass header that hides scrolling content
 * - 2-column masonry grid
 * - Floating map toggle button
 */
export const DeepDiveView = memo(function DeepDiveView({
  events,
  onEventClick,
  onJoinEvent,
  isJoining,
  isSaved,
  onSave,
  currentUserProfileId,
  loading,
  onFilterClick,
  onLoadMore,
  hasMore,
}: DeepDiveViewProps) {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [showMap, setShowMap] = useState(false);

  const filteredEvents = useMemo(
    () => filterByTime(events, timeFilter),
    [events, timeFilter],
  );

  const handleTimeFilterChange = useCallback(async (filter: TimeFilter) => {
    await hapticImpact("light");
    setTimeFilter(filter);
  }, []);

  const handleMapToggle = useCallback(async () => {
    await hapticImpact("medium");
    setShowMap(!showMap);
    // Map view implementation would go here
  }, [showMap]);

  const handleFilterClick = useCallback(async () => {
    await hapticImpact("light");
    onFilterClick?.();
  }, [onFilterClick]);

  // Virtualization setup
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: Math.ceil(filteredEvents.length / 2),
    getScrollElement: () => parentRef.current,
    estimateSize: () => 320, // Estimated height of a card
    overscan: 5,
  });

  // Infinite scroll detection
  useEffect(() => {
    const scrollElement = parentRef.current;
    if (!scrollElement || !hasMore || loading) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollElement;
      if (scrollHeight - scrollTop <= clientHeight * 1.5) {
        onLoadMore?.();
      }
    };

    scrollElement.addEventListener("scroll", handleScroll);
    return () => scrollElement.removeEventListener("scroll", handleScroll);
  }, [hasMore, loading, onLoadMore]);

  // Split events into two columns for masonry effect (using virtual rows)
  const columns = useMemo(() => {
    const col1: { event: EventWithAttendees; tall: boolean }[] = [];
    const col2: { event: EventWithAttendees; tall: boolean }[] = [];

    filteredEvents.forEach((event, index) => {
      const tall = index % 3 === 0; // Every 3rd item is tall
      if (index % 2 === 0) {
        col1.push({ event, tall });
      } else {
        col2.push({ event, tall });
      }
    });

    return [col1, col2];
  }, [filteredEvents]);

  return (
    <div className="min-h-screen pb-24">
      {/* Sticky Header - Solid Background */}
      <div className="sticky top-0 z-50 bg-white border-b border-border pb-4 pt-safe">
        <div className="px-6 pt-4">
          {/* Filter Row: Pills + Filter Button */}
          <div className="flex items-center gap-3">
            {/* Time Filter Pills - takes available space */}
            <div
              className={`flex-1 min-w-0 transition-opacity duration-200 ${showMap ? "opacity-0 pointer-events-none" : "opacity-100"}`}
            >
              <TimeFilterPills
                activeFilter={timeFilter}
                onFilterChange={handleTimeFilterChange}
              />
            </div>

            {/* Filter Button */}
            <Button
              variant="outline"
              size="icon"
              onClick={handleFilterClick}
              className={`shrink-0 rounded-full w-11 h-11 ${showMap ? "opacity-0 pointer-events-none" : "opacity-100"}`}
              aria-label="Open filters"
            >
              <SlidersHorizontal size={18} />
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="relative min-h-[50vh]">
        <AnimatePresence mode="wait">
          {showMap ? (
            <motion.div
              key="map"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 h-[calc(100vh-200px)] z-10"
            >
              <EventMap
                events={filteredEvents}
                onEventClick={(event) => onEventClick?.(event.id)}
                // Mock Amsterdam location for now if no user location provided
                userLocation={{ lat: 52.3676, lng: 4.9041 }}
              />
            </motion.div>
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {loading ? (
                <div className="px-6 py-4">
                  <LoadingSkeleton />
                </div>
              ) : filteredEvents.length === 0 ? (
                <div className="text-center py-16 px-6">
                  <p className="text-muted-foreground text-[17px]">
                    Geen evenementen gevonden
                  </p>
                  <p className="text-muted-foreground/60 text-[15px] mt-2">
                    Probeer een andere zoekopdracht of filter
                  </p>
                </div>
              ) : (
                <div
                  ref={parentRef}
                  className="px-4 py-4 h-[calc(100vh-140px)] overflow-y-auto"
                >
                  <div
                    style={{
                      height: `${rowVirtualizer.getTotalSize()}px`,
                      width: "100%",
                      position: "relative",
                    }}
                  >
                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                      const rowItems = [
                        { item: columns[0][virtualRow.index] },
                        { item: columns[1][virtualRow.index] },
                      ].filter((x) => x.item);

                      return (
                        <div
                          key={virtualRow.key}
                          className="flex gap-3"
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            height: `${virtualRow.size}px`,
                            transform: `translateY(${virtualRow.start}px)`,
                          }}
                        >
                          {rowItems.map(({ item }) => {
                            const { event, tall } = item;
                            const hasJoined = Boolean(
                              currentUserProfileId &&
                              event.attendees?.some(
                                (a) => a.profile?.id === currentUserProfileId,
                              ),
                            );

                            return (
                              <div key={event.id} className="flex-1">
                                <MasonryEventCard
                                  event={event}
                                  tall={tall}
                                  onClick={() => onEventClick?.(event.id)}
                                  onJoin={() => onJoinEvent?.(event.id)}
                                  isJoining={isJoining(event.id)}
                                  isSaved={isSaved(event.id)}
                                  onSave={() => onSave(event)}
                                  hasJoined={hasJoined}
                                />
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                  {loading && (
                    <div className="py-4 flex justify-center">
                      <Loader2 className="animate-spin text-primary" />
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Floating Map Toggle */}
      <motion.button
        onClick={handleMapToggle}
        className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 bg-foreground text-background rounded-full px-6 py-3 font-semibold text-[15px] flex items-center gap-2 shadow-xl mb-safe"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {showMap ? (
          <>
            <SlidersHorizontal size={18} />
            Lijst
          </>
        ) : (
          <>
            <Map size={18} />
            Kaart
          </>
        )}
      </motion.button>
    </div>
  );
});
