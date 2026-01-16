import { useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Link2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { FloatingNav } from '@/shared/components';
import { Button } from '@/shared/components/ui/button';
import { ItineraryTimeline } from './components/ItineraryTimeline';
import { useUnifiedItinerary } from './hooks/useUnifiedItinerary';

type FilterTab = 'upcoming' | 'past';

export default function MyEvents() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<FilterTab>('upcoming');

  // Use the unified itinerary hook that merges LCL events with Google Calendar
  const { dayGroups, totalItems, loading, isGoogleConnected } = useUnifiedItinerary(activeTab);

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
        {/* Google Calendar Connection Status */}
        {isGoogleConnected && (
          <div className="mx-5 mt-3 mb-2">
            <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
              <Link2 size={12} />
              <span>Synced with Google Calendar</span>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-pulse flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-muted" />
              <div className="h-4 w-32 bg-muted rounded" />
            </div>
          </div>
        ) : totalItems === 0 ? (
          <EmptyState 
            tab={activeTab} 
            onBrowse={() => navigate('/feed')} 
          />
        ) : (
          <ItineraryTimeline dayGroups={dayGroups} />
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
      {/* Animated Timeline Illustration */}
      <div className="relative mb-8">
        {/* Vertical Line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-[2px] bg-gradient-to-b from-muted via-muted/50 to-transparent transform -translate-x-1/2" />
        
        {/* Empty Nodes */}
        <div className="flex flex-col items-center gap-4 py-4">
          <motion.div 
            className="w-12 h-12 rounded-full bg-muted/50 border-2 border-dashed border-muted-foreground/30 flex items-center justify-center"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <span className="text-lg">📅</span>
          </motion.div>
          <motion.div 
            className="w-10 h-10 rounded-full bg-muted/30 border-2 border-dashed border-muted-foreground/20"
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}
          />
          <motion.div 
            className="w-8 h-8 rounded-full bg-muted/20 border-2 border-dashed border-muted-foreground/10"
            animate={{ opacity: [0.2, 0.4, 0.2] }}
            transition={{ duration: 2, repeat: Infinity, delay: 0.6 }}
          />
        </div>
      </div>

      <h2 className="text-[20px] font-bold text-foreground mb-2">
        {tab === 'upcoming' ? 'Your timeline is empty' : 'No past events'}
      </h2>
      <p className="text-[15px] text-muted-foreground mb-8 max-w-xs leading-relaxed">
        {tab === 'upcoming' 
          ? "Start building your itinerary by joining events or connecting your calendar."
          : "You don't have any past events to show."
        }
      </p>
      {tab === 'upcoming' && (
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Button
            onClick={onBrowse}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-3 rounded-xl text-[15px] font-semibold"
          >
            Browse Events
          </Button>
          <Button
            variant="outline"
            onClick={onBrowse}
            className="w-full px-6 py-3 rounded-xl text-[15px] font-semibold border-dashed"
          >
            Suggest a Plan
          </Button>
        </div>
      )}
    </motion.div>
  );
}
