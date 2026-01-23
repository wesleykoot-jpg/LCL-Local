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

export default function ExplorePage() {
  const [searchQuery, setSearchQuery] = useState("");
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

  // Generate the 5 specific rails
  const { sections } = useDiscoveryRails({
    allEvents,
    userId: profile?.id,
    userLocation: userLocation || undefined,
    radiusKm: locationPrefs?.radiusKm || 25,
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
      <header className="sticky top-0 z-30 bg-white border-b border-[#E5E7EB] shadow-[0_2px_8px_rgba(0,0,0,0.04)] px-6 py-4">
        <div className="flex items-center gap-4 mb-4">
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
            <p className="font-medium text-red-600 mb-2">
              Failed to load events.
            </p>
            <div className="bg-red-50 p-4 rounded-xl text-left overflow-auto max-h-40">
              <p className="text-xs font-mono text-red-800 whitespace-pre-wrap">
                {error instanceof Error
                  ? error.message
                  : JSON.stringify(error, null, 2)}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Featured Hero - Netflix Style Scrim */}
            <AnimatePresence mode="wait">
              {featuredEvent && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="px-6 py-6"
                >
                  <div
                    className="relative aspect-video rounded-3xl overflow-hidden bg-zinc-900 shadow-lg group cursor-pointer"
                    onClick={() => hapticImpact("medium")}
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
                    onSeeAll={() => console.log("See All", section.title)}
                  >
                    {section.items.map((event) => (
                      <ExploreEventCard
                        key={event.id}
                        event={event}
                        onClick={() => hapticImpact("light")}
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
    </div>
  );
}
