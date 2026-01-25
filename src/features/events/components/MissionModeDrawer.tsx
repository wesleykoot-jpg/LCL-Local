import { memo, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence, PanInfo, useAnimation } from "framer-motion";
import { X, MapPin } from "lucide-react";
import { EventMap } from "./EventMap";
import { useMissionMode } from "../hooks/useMissionMode";
import type { MissionIntent } from "../types/discoveryTypes";
import { INTENT_CONFIGS } from "../types/discoveryTypes";
import { hapticImpact } from "@/shared/lib/haptics";
import { TimelineEventCard } from "./TimelineEventCard";

interface MissionModeDrawerProps {
  intent: MissionIntent | null;
  userLocation: { lat: number; lng: number };
  isOpen: boolean;
  onClose: () => void;
  onEventClick: (eventId: string) => void;
}

const DRAWER_HEIGHT = "85vh";

export const MissionModeDrawer = memo(function MissionModeDrawer({
  intent,
  userLocation,
  isOpen,
  onClose,
  onEventClick,
}: MissionModeDrawerProps) {
  const controls = useAnimation();
  const dragging = useRef(false);

  // Fetch data only when intent is active
  const { data, isLoading } = useMissionMode({
    intent,
    userLocation,
    enabled: isOpen && !!intent,
  });

  const config = intent ? INTENT_CONFIGS[intent] : null;

  // Handle drag gestures to close
  const handleDragEnd = async (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) => {
    dragging.current = false;
    if (info.offset.y > 150 || info.velocity.y > 500) {
      await controls.start({ y: "100%" });
      onClose();
    } else {
      controls.start({ y: 0 });
    }
  };

  useEffect(() => {
    if (isOpen) {
      controls.start({ y: 0 });
      hapticImpact("medium");
    } else {
      controls.start({ y: "100%" });
    }
  }, [isOpen, controls]);

  // Moved early return after hooks
  // if (!intent || !config) return null;

  // Format events for map
  const eventsForMap = useMemo(
    () =>
      data?.events.map((e) => ({
        ...e,
        distanceKm: e.distance_km,
      })) || [],
    [data?.events],
  );

  if (!intent || !config) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-50 touch-none"
        />
      )}

      {isOpen && (
        <motion.div
          key="drawer"
          initial={{ y: "100%" }}
          animate={controls}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          drag="y"
          dragConstraints={{ top: 0 }}
          dragElastic={0.05}
          onDragStart={() => {
            dragging.current = true;
          }}
          onDragEnd={handleDragEnd}
          style={{ height: DRAWER_HEIGHT }}
          className="fixed bottom-0 left-0 right-0 bg-background rounded-t-card shadow-2xl z-50 flex flex-col overflow-hidden border-t pb-safe"
        >
          {/* Drag Handle */}
          <div className="flex justify-center pt-3 pb-1 shrink-0 touch-pan-y">
            <div className="w-12 h-1.5 bg-muted rounded-full" />
          </div>

          {/* Header */}
          <div className="px-5 pb-4 pt-1 flex items-center justify-between shrink-0 border-b">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{config.emoji}</span>
                <h2 className="text-xl font-bold">{config.label}</h2>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5 max-w-[80%]">
                {config.description} • &lt; 1km walk
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 -mr-2 text-muted-foreground hover:text-foreground rounded-full active:bg-muted"
            >
              <X size={24} />
            </button>
          </div>

          {/* Content - Scrollable */}
          <div className="flex-1 overflow-y-auto overscroll-contain bg-muted/30">
            {/* Map Section */}
            <div className="h-[200px] w-full relative z-0">
              <div className="absolute inset-0 pointer-events-auto">
                <EventMap
                  events={eventsForMap}
                  userLocation={userLocation}
                  initialZoom={14}
                  onEventClick={(e) => onEventClick(e.id)}
                />
              </div>
              {/* Gradient overlay to blend map into list */}
              <div className="absolute bottom-0 left-0 right-0 h-12 bg-linear-to-t from-muted/30 to-transparent pointer-events-none" />
            </div>

            {/* Event List */}
            <div className="px-4 py-4 space-y-4">
              <h3 className="font-semibold text-muted-foreground text-sm uppercase tracking-wider pl-1">
                Top Picks for You
              </h3>

              {isLoading ? (
                // Loading skeleton
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-32 bg-muted rounded-xl animate-pulse"
                    />
                  ))}
                </div>
              ) : data?.events && data.events.length > 0 ? (
                data.events.map((event) => (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => onEventClick(event.id)}
                  >
                    {/* Using simplified card for mission mode */}
                    <TimelineEventCard
                      event={event}
                      // showDayHeader={false}
                      // @ts-expect-error - timeline event card props mismatch
                      onClick={() => onEventClick(event.id)}
                    />

                    {/* Extra context overlay for mission mode */}
                    <div className="flex items-center gap-4 px-3 mt-1.5 text-xs font-medium text-emerald-600">
                      <span className="flex items-center gap-1">
                        <MapPin size={12} />
                        {event.walking_time_minutes} min walk
                      </span>
                      {event.distance_km < 0.2 && (
                        <span className="text-amber-600">📍 Very close!</span>
                      )}
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="text-center py-10 text-muted-foreground">
                  <p className="mb-2 text-xl">👻</p>
                  <p>No suitable places found nearby.</p>
                  <p className="text-sm mt-1">
                    Try expanding your search radius.
                  </p>
                </div>
              )}

              {/* Bottom padding for safe area */}
              <div className="h-8" />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
