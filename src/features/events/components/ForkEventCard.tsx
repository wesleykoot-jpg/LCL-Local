import { memo, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { formatEventTime } from '@/shared/lib/formatters';
import { hapticImpact } from '@/shared/lib/haptics';
import { useImageFallback, getEventImage } from '../hooks/useImageFallback';
import type { EventWithAttendees } from '../hooks/hooks';

export interface ForkEventCardProps {
    event: EventWithAttendees;
    parentTitle?: string;
    onClick?: () => void;
    onJoin?: () => void;
    isJoining?: boolean;
    isLast?: boolean;
    currentUserProfileId?: string;
    showConnector?: boolean;
}

export const ForkEventCard = memo(function ForkEventCard({
    event,
    // parentTitle,
    onClick,
    onJoin,
    isJoining,
    isLast,
    currentUserProfileId,
    showConnector = true,
}: ForkEventCardProps) {
    const primaryImageUrl = getEventImage(event.image_url, event.category);
    const { src: imageUrl, onError: handleImageError } = useImageFallback(primaryImageUrl, event.category);
    const [imageLoaded, setImageLoaded] = useState(false);

    const hasJoined = Boolean(
        currentUserProfileId && event.attendees?.some(
            attendee => attendee.profile?.id === currentUserProfileId
        )
    );

    const handleImageLoad = useCallback(() => {
        setImageLoaded(true);
    }, []);

    return (
        <div className="flex">
            {/* Thread connector - optional */}
            {showConnector && (
                <div className="w-6 flex-shrink-0 relative">
                    <div className={`absolute top-0 left-[3px] w-0.5 bg-border ${isLast ? 'h-6' : 'h-full'} rounded-full`} />
                    <div className="absolute top-6 left-[3px] h-0.5 w-5 bg-border rounded-full" />
                </div>
            )}

            {/* Fork card */}
            <motion.div
                className={`flex-1 min-w-0 overflow-hidden rounded-xl bg-card border border-border p-3 cursor-pointer hover:border-muted-foreground/30 transition-all ${!showConnector ? 'ml-0' : ''
                    }`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                whileTap={{ scale: 0.98 }}
                onClick={onClick}
            >
                <div className="flex gap-3 items-center">
                    {/* Thumbnail */}
                    <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                        <motion.img
                            src={imageUrl}
                            alt={event.title}
                            className="w-full h-full object-cover"
                            onError={handleImageError}
                            onLoad={handleImageLoad}
                            loading="lazy"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: imageLoaded ? 1 : 0 }}
                            transition={{ duration: 0.3, ease: 'easeOut' }}
                        />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-[15px] text-foreground leading-tight line-clamp-1">
                            {event.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-1 text-[13px] text-muted-foreground">
                            <span>{formatEventTime(event.event_time || "")}</span>
                            <span>•</span>
                            <span>{event.attendee_count || 0} going</span>
                        </div>
                    </div>

                    {/* Join button */}
                    <button
                        onClick={async (e) => {
                            e.stopPropagation();
                            if (!hasJoined) {
                                await hapticImpact('medium');
                                onJoin?.();
                            }
                        }}
                        disabled={isJoining || hasJoined}
                        className={`min-h-[36px] px-4 rounded-lg text-[13px] font-semibold transition-all active:scale-[0.95] ${hasJoined
                                ? 'bg-muted text-muted-foreground'
                                : 'bg-primary text-primary-foreground hover:bg-primary/90'
                            }`}
                    >
                        {isJoining ? (
                            <Loader2 size={14} className="animate-spin" />
                        ) : hasJoined ? (
                            '✓'
                        ) : (
                            'Join'
                        )}
                    </button>
                </div>
            </motion.div>
        </div>
    );
});
