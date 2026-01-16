import { useNavigate } from 'react-router-dom';
import { FloatingNav, LoadingSkeleton } from '@/shared/components';
import { Button } from '@/shared/components/ui/button';
import { ItineraryTimeline } from './components/ItineraryTimeline';
import { useUnifiedItinerary } from './hooks/useUnifiedItinerary';

export default function MyEvents() {
  const navigate = useNavigate();
  const { groupedTimeline, isLoading } = useUnifiedItinerary();
  const hasItems = Object.keys(groupedTimeline).length > 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="px-5 pt-6 pb-4">
        <h1 className="text-[24px] font-bold text-foreground">My Events</h1>
      </div>

      <div className="pb-24">
        {isLoading ? (
          <div className="px-5">
            <LoadingSkeleton className="h-40 w-full rounded-2xl" />
          </div>
        ) : hasItems ? (
          <ItineraryTimeline groupedTimeline={groupedTimeline} />
        ) : (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <h2 className="text-[20px] font-semibold text-foreground">No plans yet</h2>
            <p className="mt-2 text-[15px] text-muted-foreground">
              Explore events to start building your itinerary.
            </p>
            <Button
              onClick={() => navigate('/feed')}
              className="mt-6 rounded-xl px-6 py-3 text-[15px] font-semibold"
            >
              Explore Feed
            </Button>
          </div>
        )}
      </div>

      <FloatingNav />
    </div>
  );
}
