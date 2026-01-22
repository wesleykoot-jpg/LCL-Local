import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUnifiedItinerary } from '@/features/events/hooks/useUnifiedItinerary';
import { useMotionPreset } from '@/hooks/useMotionPreset';
import { TicketStub } from '@/components/ui/TicketStub';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * UpcomingBoardingPasses - Future events list
 * 
 * Part of the v5.0 "Social Air" Design System.
 * Displays "Boarding Passes" for upcoming events.
 * 
 * Features:
 * - "Ticket Stub" style event cards
 * - Zero state for no upcoming plans
 * - Loading skeleton
 */

export function UpcomingBoardingPasses() {
    const { timelineItems, isLoading } = useUnifiedItinerary();

    const navigate = useNavigate();

    // Filter for future events only
    const futureEvents = useMemo(() => {
        const now = new Date();
        return timelineItems.filter(item => item.startTime >= now);
    }, [timelineItems]);

    // Loading State with Skeletons
    if (isLoading) {
        return (
            <div className="space-y-4">
                <LoadingSkeleton />
                <LoadingSkeleton />
            </div>
        );
    }

    // Zero State
    if (futureEvents.length === 0) {
        return <PlansZeroState onDiscoverClick={() => navigate('/')} />;
    }

    return (
        <div className="space-y-4">
            {futureEvents.map((event, index) => (
                <TicketStub
                    key={event.id}
                    id={event.id}
                    date={event.startTime}
                    title={event.title}
                    location={event.location}
                    time={event.originalData?.event_time}
                    friends={[]} // TODO: Fetch co-attendees
                    onClick={() => navigate(`/events/${event.id}`)}
                    index={index}
                    className="border-l-4 border-l-brand-primary" // Highlight for upcoming
                />
            ))}
        </div>
    );
}

/**
 * Loading Skeleton
 */
function LoadingSkeleton() {
    return (
        <div className="flex items-stretch gap-4 p-4 bg-surface-card rounded-card shadow-card">
            <div className="flex flex-col items-center justify-center w-14 shrink-0">
                <Skeleton className="h-7 w-8 mb-1 bg-gray-100" />
                <Skeleton className="h-3 w-10 bg-gray-100" />
            </div>
            <div className="w-px bg-gray-200 self-stretch" />
            <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-3/4 bg-gray-100" />
                <Skeleton className="h-4 w-1/2 bg-gray-100" />
            </div>
        </div>
    );
}

/**
 * Zero State Component - Empty Plans
 */
interface PlansZeroStateProps {
    onDiscoverClick: () => void;
}

function PlansZeroState({ onDiscoverClick }: PlansZeroStateProps) {
    const motionPreset = useMotionPreset();

    return (
        <motion.div
            className="bg-surface-card rounded-card shadow-card p-12 text-center"
            {...motionPreset.slideUp}
        >
            <div className="relative w-24 h-24 mx-auto mb-6 flex items-center justify-center bg-gray-50 rounded-full border border-gray-100">
                <Calendar size={40} className="text-gray-300" strokeWidth={1.5} />
            </div>

            <h3 className="text-xl font-bold text-text-primary mb-2">
                No Upcoming Plans
            </h3>
            <p className="text-sm text-text-secondary mb-6 max-w-xs mx-auto">
                You have no boarding passes yet. Find an event to start your journey!
            </p>

            <motion.button
                onClick={onDiscoverClick}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-button bg-brand-primary hover:bg-brand-secondary text-white font-medium transition-colors"
                whileHover={motionPreset.prefersReducedMotion ? {} : { scale: 1.05 }}
                whileTap={motionPreset.prefersReducedMotion ? {} : { scale: 0.95 }}
            >
                <Sparkles size={18} />
                <span>Find Events</span>
            </motion.button>
        </motion.div>
    );
}
