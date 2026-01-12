import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { FloatingNav } from '@/components/FloatingNav';
import { EventTimeline } from '@/components/EventTimeline';
import { useAuth } from '@/contexts/useAuth';
import { useAllUserCommitments } from '@/lib/hooks';
import { Button } from '@/components/ui/button';

export default function MyEvents() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { commitments, loading, groupedByMonth } = useAllUserCommitments(profile?.id || '');

  const totalEvents = commitments.length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-headline text-foreground">My Events</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {totalEvents} upcoming {totalEvents === 1 ? 'event' : 'events'}
              </p>
            </div>
            <motion.div
              whileTap={{ scale: 0.95 }}
              className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center"
            >
              <Calendar className="w-5 h-5 text-foreground" />
            </motion.div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="pb-32">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-pulse flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-muted" />
              <div className="h-4 w-32 bg-muted rounded" />
            </div>
          </div>
        ) : totalEvents === 0 ? (
          <EmptyState onBrowse={() => navigate('/feed')} />
        ) : (
          <EventTimeline groupedByMonth={groupedByMonth} />
        )}
      </div>

      <FloatingNav />
    </div>
  );
}

function EmptyState({ onBrowse }: { onBrowse: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center px-8 py-20 text-center"
    >
      <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6">
        <Calendar className="w-10 h-10 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-headline text-foreground mb-2">
        No upcoming events
      </h2>
      <p className="text-muted-foreground mb-8 max-w-xs">
        You haven't joined any events yet. Explore the feed to find something fun to do!
      </p>
      <Button
        onClick={onBrowse}
        className="btn-action px-6 py-3"
      >
        Browse Events
      </Button>
    </motion.div>
  );
}
