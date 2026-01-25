import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  MapPin,
  SlidersHorizontal,
  Sparkles,
  Zap,
  RotateCcw,
  Gem,
  Compass,
} from "lucide-react";
import { useEventsQuery } from "./hooks/useEventsQuery";
import { useDiscoveryRails } from "./hooks/useDiscoveryRails";
import { ExploreRail } from "./components/ExploreRail";
import { ExploreEventCard } from "./components/ExploreEventCard";
import { LoadingSkeleton } from "@/shared/components/LoadingSkeleton";
import { hapticImpact } from "@/shared/lib/haptics";
import { FloatingNav } from "@/shared/components/FloatingNav";
import { useAuth } from "@/features/auth";
import { useLocation } from "@/features/location";
import { useJoinEvent } from "./hooks/hooks";
import { EventDetailModal } from "./components/EventDetailModal";
import { TimelineEventCard } from "./components/TimelineEventCard";
import { ChevronDown } from "lucide-react";

export default function ExplorePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<{
    title: string;
    items: any[];
  } | null>(null);
  const { profile } = useAuth();
  const { location: userLocation, preferences: locationPrefs } = useLocation();

  // useEventsQuery returns { events, loading, error, isRefetching, refetch }
  const {
    events: allEvents = [],
    loading,
    error,
  } = useEventsQuery({
    currentUserProfileId: profile?.id,
    userLocation: userLocation || undefined,
    radiusKm: locationPrefs?.radiusKm || 25,
    usePersonalizedFeed: !!userLocation && !!profile?.id,
  });

  const { handleJoinEvent, isJoining } = useJoinEvent(profile?.id, () => {
    // Optional: refine query on join
  });

  const selectedEvent = useMemo(() => {
    return allEvents.find((e) => e.id === selectedEventId) || null;
  }, [allEvents, selectedEventId]);

  // Filter events based on search query
  const filteredEvents = useMemo(() => {
    if (!searchQuery.trim()) return allEvents;
    const query = searchQuery.toLowerCase();
    return allEvents.filter(
      (e) =>
        e.title.toLowerCase().includes(query) ||
        e.description?.toLowerCase().includes(query) ||
        e.venue_name?.toLowerCase().includes(query),
    );
  }, [allEvents, searchQuery]);

  // Generate the 5 specific rails
  const { sections } = useDiscoveryRails({
    allEvents: filteredEvents,
    enabled: !loading && !error,
  });

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const featuredEvent = useMemo(() => {
    return (
      [...allEvents]
        .filter((e) => e.image_url)
        .sort((a, b) => (b.attendee_count || 0) - (a.attendee_count || 0))[0] ||
      allEvents[0]
    );
  }, [allEvents]);

  // Derived location text
  const locationText = useMemo(() => {
    return locationPrefs?.manualZone || profile?.location_city || "Groningen";
  }, [locationPrefs, profile]);

  return (
    <div className="min-h-screen bg-[#F9FAFB] pb-32">
      {/* Search Header - Social Air 6.0 Style */}
      <header className="sticky top-0 z-30 bg-white border-b border-[#E5E7EB] shadow-[0_2px_8px_rgba(0,0,0,0.04)] px-6 pt-safe pb-4">
        <div className="pt-4 flex items-center gap-4 mb-4">
          <button
            className="flex items-center gap-1.5 text-[#1A1A1A] font-bold text-lg active:scale-95 transition-transform"
            onClick={() => hapticImpact("light")}
          >
            <MapPin size={20} className="text-[#6366F1]" />
            <span>{locationText}</span>
          </button>
        </div>

        <div className="relative group">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#4B5563]">
            <Search size={18} />
          </div>
          <input
            type="text"
            placeholder="Search local events..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full bg-[#F3F4F6] border-none rounded-2xl py-3 pl-12 pr-12 text-[15px] font-medium focus:ring-2 focus:ring-[#6366F1] transition-all shadow-sm"
          />
          <button
            className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6366F1] p-1 active:scale-90 transition-transform"
            onClick={() => hapticImpact("light")}
          >
            <SlidersHorizontal size={18} />
          </button>
        </div>
      </header>

      <main>
        {loading ? (
          <div className="px-6 py-8 space-y-8">
            <LoadingSkeleton className="h-[200px] w-full rounded-3xl" />
            <div className="space-y-4">
              <LoadingSkeleton className="h-6 w-1/3" />
              <div className="flex gap-4 overflow-hidden">
                <LoadingSkeleton className="h-[280px] w-[240px] shrink-0 rounded-3xl" />
                <LoadingSkeleton className="h-[280px] w-[240px] shrink-0 rounded-3xl" />
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="px-6 py-12 text-center text-[#4B5563]">
            <p className="font-medium">
              Failed to load events. Please try again later.
            </p>
          </div>
        ) : (
          <>
            {/* Featured Hero - Netflix Style Scrim */}
            <AnimatePresence mode="wait">
              {featuredEvent && (
                <motion.div
                  key={featuredEvent.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.4 }}
                  className="px-6 py-6"
                >
                  <div
                    className="relative aspect-video rounded-3xl overflow-hidden bg-zinc-900 shadow-lg group cursor-pointer"
                    onClick={() => {
                      hapticImpact("medium");
                      setSelectedEventId(featuredEvent.id);
                    }}
                  >
                    <img
                      src={featuredEvent.image_url || ""}
                      alt={featuredEvent.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent" />
                    <div className="absolute bottom-6 left-6 right-6">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="bg-[#6366F1] text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                          Featured
                        </span>
                      </div>
                      <h1 className="text-2xl font-bold text-white mb-1 line-clamp-1">
                        {featuredEvent.title}
                      </h1>
                      <p className="text-white/80 text-[14px] line-clamp-2 font-medium">
                        {featuredEvent.description ||
                          "Join this amazing event in your neighborhood."}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Discovery Rails */}
            <div className="mt-2 space-y-2">
              {sections.map((section) => {
                const getIcon = (title: string) => {
                  if (title.includes("Pulse")) return <Zap size={20} />;
                  if (title.includes("Wildcard"))
                    return <RotateCcw size={20} />;
                  if (title.includes("Ritual")) return <Sparkles size={20} />;
                  if (title.includes("Gems")) return <Gem size={20} />;
                  return <Compass size={20} />;
                };

                return (
                  <ExploreRail
                    key={section.title}
                    title={section.title}
                    description={section.description}
                    icon={getIcon(section.title)}
                    onSeeAll={() => {
                      hapticImpact("light");
                      setActiveSection(section);
                    }}
                  >
                    {section.items.slice(0, 8).map((event) => (
                      <ExploreEventCard
                        key={event.id}
                        event={event}
                        onClick={() => {
                          hapticImpact("light");
                          setSelectedEventId(event.id);
                        }}
                      />
                    ))}
                  </ExploreRail>
                );
              })}
            </div>
          </>
        )}
      </main>
      <FloatingNav activeView="feed" />

      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          onClose={() => setSelectedEventId(null)}
          onJoin={() => handleJoinEvent(selectedEvent.id)}
          isJoining={isJoining(selectedEvent.id)}
          currentUserProfileId={profile?.id}
          hasJoined={selectedEvent.attendees?.some(
            (a) => a.profile?.id === profile?.id,
          )}
        />
      )}

      {/* Full Screen Section View (See All) */}
      <AnimatePresence>
        {activeSection && (
          <motion.div
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-50 bg-[#F9FAFB] flex flex-col pt-safe"
          >
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 shrink-0 shadow-sm z-10 sticky top-0">
              <button
                onClick={() => setActiveSection(null)}
                className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-900 active:scale-90 transition-transform"
              >
                <ChevronDown size={24} className="rotate-90" />
              </button>
              <div>
                <h2 className="text-lg font-bold text-[#1A1A1A] leading-tight">
                  {activeSection.title}
                </h2>
                <p className="text-xs text-gray-500 font-medium">
                  {activeSection.items.length} events
                </p>
              </div>
            </div>

            {/* List Content */}
            <div className="flex-1 overflow-y-auto p-4 pb-32">
              <div className="space-y-4 max-w-lg mx-auto">
                {activeSection.items.map((event) => (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => {
                      hapticImpact("light");
                      setSelectedEventId(event.id);
                      // Don't close section view, just show modal on top
                    }}
                  >
                    <TimelineEventCard event={event} />
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
