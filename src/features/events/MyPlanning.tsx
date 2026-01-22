import { useUnifiedItinerary } from './hooks/useUnifiedItinerary';
import { ItineraryTimeline } from './components/ItineraryTimeline';
import { LoadingSkeleton } from '@/shared/components/LoadingSkeleton';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Compass, RefreshCw, Calendar, Map, Share2, List } from 'lucide-react';
import { FloatingNav } from '@/shared/components/FloatingNav';
import { useState } from 'react';
import { hapticImpact } from '@/shared/lib/haptics';

/**
 * My Planning Page - TripAdvisor-style smart itinerary view
 * Updated to LCL Design System v5.0 "Social Air"
 * 
 * Displays a unified timeline of:
 * - LCL events the user has joined
 * - Google Calendar events (if connected)
 * 
 * Features:
 * - Solid card surface sticky header with Air shadow system
 * - Vertical rail timeline with date grouping
 * - Empty state with journey prompt
 * - Social Indigo (#6366F1) primary action color
 * - Consistent design tokens matching Discovery page
 */
const MyPlanning = () => {
  const { groupedTimeline, timelineItems, isLoading, isEmpty, refresh } = useUnifiedItinerary();

  // Separate Pending Invites
  // No pending invites logic yet
  const confirmedTimeline = timelineItems.filter(i => i.status !== 'pending');
  // Re-group confirmed items only for the main timeline
  // Note: groupedTimeline from hook includes all, so we might need to filter manually or rely on hook update
  // For now, simpler to just pass full groupedTimeline to ItineraryTimeline and let it be (or filter pending out of main list in hook? 
  // actually useUnifiedItinerary mixes them. Let's filter groupedTimeline visually or simplistic filter).
  // BETTER: Filter groupedTimeline excludes pending.

  // Quick Fix: Filter groupedTimeline keys? Accessing groupedTimeline directly might show pending items in "Today"/"Tomorrow" blocks
  // Let's rely on filter inside ItineraryTimeline if we pass it filtered items. 
  // But ItineraryTimeline takes `groupedItems`.
  // Let's do a quick re-group here 
  const filteredGroupedItems: Record<string, typeof timelineItems> = {};
  confirmedTimeline.forEach(item => {
    const dateKey = item.startTime.toLocaleDateString('en-US', {
      weekday: 'long', month: 'short', day: 'numeric'
    });
    if (!filteredGroupedItems[dateKey]) filteredGroupedItems[dateKey] = [];
    filteredGroupedItems[dateKey].push(item);
  });

  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');



  const handleShare = async () => {
    await hapticImpact('light');

    // Generate simple text summary
    const eventCount = timelineItems.length;
    const nextEvent = timelineItems.find(i => i.startTime > new Date());

    const text = nextEvent
      ? `I'm planning ${eventCount} events on LCL! Next up: ${nextEvent.title} at ${nextEvent.startTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`
      : `Check out my travel plans on LCL!`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My LCL Itinerary',
          text: text,
          url: window.location.href,
        });
      } catch (_err) {
        console.log('Share cancelled');
      }
    } else {
      console.log('Share API not supported');
      // Fallback could go here
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-base">
        {/* Sticky Solid Header - LCL Core 2026 */}
        <header className="sticky top-0 z-30 bg-surface-card border-b border-border shadow-card px-6 py-4">
          <h1 className="text-2xl font-bold text-foreground">My Planning</h1>
        </header>
        <div className="pt-4 px-4">
          <LoadingSkeleton />
        </div>
        <FloatingNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-base pb-24">
      {/* Sticky Solid Header - LCL Core 2026 */}
      <header className="sticky top-0 z-30 bg-surface-card border-b border-border shadow-card">
        <div className="px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Map className="w-6 h-6 text-primary" />
              My Planning
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {isEmpty
                ? 'Your upcoming journey awaits'
                : `${timelineItems.length} event${timelineItems.length === 1 ? '' : 's'} planned`
              }
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Share Button */}
            {!isEmpty && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleShare}
                className="text-muted-foreground hover:text-foreground min-h-touch min-w-touch"
                aria-label="Share itinerary"
              >
                <Share2 className="w-5 h-5" />
              </Button>
            )}

            {/* Map/List Toggle */}
            {!isEmpty && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  hapticImpact('light');
                  setViewMode(prev => prev === 'list' ? 'map' : 'list');
                }}
                className={`min-h-touch min-w-touch transition-colors ${viewMode === 'map' ? 'text-brand-primary bg-brand-primary/10' : 'text-muted-foreground hover:text-foreground'
                  }`}
                aria-label={viewMode === 'list' ? "View map" : "View list"}
              >
                {viewMode === 'list' ? <Map className="w-5 h-5" /> : <List className="w-5 h-5" />}
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              onClick={refresh}
              className="text-muted-foreground hover:text-foreground min-h-touch min-w-touch"
              aria-label="Refresh planning"
            >
              <RefreshCw className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Content Area */}
      {isEmpty ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center h-[60vh] px-8 text-center space-y-6">
          <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center shadow-card">
            <Calendar className="w-12 h-12 text-primary" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-foreground">Start Your Journey</h3>
            <p className="text-muted-foreground mt-2 text-sm max-w-xs">
              Explore events near you and join one to build your personal itinerary.
            </p>
          </div>
          <button
            onClick={() => navigate('/feed')}
            className="h-touch bg-primary text-primary-foreground font-bold rounded-2xl shadow-card active:opacity-90 transition-all px-6 flex items-center gap-2"
          >
            <Compass className="w-4 h-4" />
            Explore Events
          </button>
        </div>
      ) : (
        /* TripAdvisor Timeline */
        <ItineraryTimeline groupedItems={groupedTimeline} />
      )}

      {/* Bottom Navigation */}
      <FloatingNav />
    </div>
  );
};

export default MyPlanning;
