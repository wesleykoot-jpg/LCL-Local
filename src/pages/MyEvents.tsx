import { useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { FloatingNav } from '@/components/FloatingNav';
import { EventTimeline } from '@/components/EventTimeline';
import { useAuth } from '@/contexts/useAuth';
import { useAllUserCommitments } from '@/lib/hooks';
import { Button } from '@/components/ui/button';

type FilterTab = 'upcoming' | 'past';

// Dev fallback profile for testing when not authenticated
const DEV_TEST_PROFILE_ID = 'de595401-5c4f-40fc-8d3a-a627e49780ff';

export default function MyEvents() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  // Use dev profile as fallback when not logged in (development only)
  const profileId = profile?.id || (import.meta.env.DEV ? DEV_TEST_PROFILE_ID : '');
  
  console.log('[MyEvents] Component rendering:', {
    hasProfile: !!profile,
    profileId,
    isDevMode: import.meta.env.DEV,
    devTestProfileId: DEV_TEST_PROFILE_ID
  });
  
  const { commitments, loading, groupedByMonth } = useAllUserCommitments(profileId);
  const [activeTab, setActiveTab] = useState<FilterTab>('upcoming');
  
  console.log('[MyEvents] Data state:', {
    loading,
    commitmentsCount: commitments.length,
    monthsCount: Object.keys(groupedByMonth).length,
    groupedByMonth
  });

  // Filter events based on tab
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const filteredGrouped = Object.entries(groupedByMonth).reduce((acc, [month, events]) => {
    const filtered = events.filter(event => {
      const eventDate = new Date(event.event_date.split('T')[0] + 'T00:00:00');
      if (activeTab === 'upcoming') {
        return eventDate >= today;
      } else {
        return eventDate < today;
      }
    });
    if (filtered.length > 0) {
      acc[month] = filtered;
    }
    return acc;
  }, {} as typeof groupedByMonth);

  const totalFiltered = Object.values(filteredGrouped).flat().length;

  // Get current month for header
  const currentMonth = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen bg-background">
      {/* Header - Airbnb Style */}
      <div className="sticky top-0 z-40 bg-card border-b border-border">
        <div className="px-5 py-4">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-[24px] font-bold text-foreground tracking-tight">
              {currentMonth}
            </h1>
            <button className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center min-h-[44px] min-w-[44px]">
              <Calendar className="w-5 h-5 text-foreground" />
            </button>
          </div>

          {/* Tab Toggle - Segmented Control */}
          <div className="flex bg-secondary rounded-xl p-1">
            <button
              onClick={() => setActiveTab('upcoming')}
              className={`flex-1 py-2.5 text-[15px] font-semibold rounded-lg transition-all ${
                activeTab === 'upcoming'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground'
              }`}
            >
              Upcoming
            </button>
            <button
              onClick={() => setActiveTab('past')}
              className={`flex-1 py-2.5 text-[15px] font-semibold rounded-lg transition-all ${
                activeTab === 'past'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground'
              }`}
            >
              Past
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="pb-24">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-pulse flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-muted" />
              <div className="h-4 w-32 bg-muted rounded" />
            </div>
          </div>
        ) : totalFiltered === 0 ? (
          <EmptyState 
            tab={activeTab} 
            onBrowse={() => navigate('/feed')} 
          />
        ) : (
          <EventTimeline groupedByMonth={filteredGrouped} />
        )}
      </div>

      <FloatingNav />
    </div>
  );
}

function EmptyState({ tab, onBrowse }: { tab: FilterTab; onBrowse: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center px-8 py-20 text-center"
    >
      <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mb-6">
        <Calendar className="w-10 h-10 text-muted-foreground" />
      </div>
      <h2 className="text-[20px] font-bold text-foreground mb-2">
        {tab === 'upcoming' ? 'No upcoming events' : 'No past events'}
      </h2>
      <p className="text-[15px] text-muted-foreground mb-8 max-w-xs leading-relaxed">
        {tab === 'upcoming' 
          ? "You haven't joined any upcoming events yet. Explore the feed to find something fun!"
          : "You don't have any past events to show."
        }
      </p>
      {tab === 'upcoming' && (
        <Button
          onClick={onBrowse}
          className="bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-3 rounded-xl text-[15px] font-semibold"
        >
          Browse Events
        </Button>
      )}
    </motion.div>
  );
}
