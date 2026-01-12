import React from 'react';
import { motion } from 'framer-motion';
import { MapPin, Clock, Users, ChevronRight } from 'lucide-react';
import { CATEGORIES } from '@/lib/categories';
import type { EventWithAttendees } from '@/lib/hooks';

interface TimelineEventCardProps {
  event: EventWithAttendees & { ticket_number?: string };
  isPast?: boolean;
}

// Fallback images for timeline cards
const TIMELINE_FALLBACK_IMAGES: Record<string, string> = {
  nightlife: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=400&fit=crop',
  food: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&h=400&fit=crop',
  sports: 'https://images.unsplash.com/photo-1461896836934- voices-of-youth?w=400&h=400&fit=crop',
  family: 'https://images.unsplash.com/photo-1536940385103-c729049165e6?w=400&h=400&fit=crop',
  culture: 'https://images.unsplash.com/photo-1531058020387-3be344556be6?w=400&h=400&fit=crop',
  wellness: 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=400&h=400&fit=crop',
  gaming: 'https://images.unsplash.com/photo-1493711662062-fa541f7f39d8?w=400&h=400&fit=crop',
  default: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400&h=400&fit=crop',
};

export function TimelineEventCard({ event, isPast }: TimelineEventCardProps) {
  const categoryConfig = CATEGORIES[event.category] || CATEGORIES.nightlife;
  const imageUrl = event.image_url || TIMELINE_FALLBACK_IMAGES[event.category] || TIMELINE_FALLBACK_IMAGES.default;

  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      className={`bg-card rounded-xl border border-border overflow-hidden shadow-bento transition-all hover:shadow-bento-hover ${
        isPast ? 'opacity-60' : ''
      }`}
    >
      <div className="flex">
        {/* Image */}
        <div className="relative w-24 h-24 flex-shrink-0">
          <img
            src={imageUrl}
            alt={event.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = TIMELINE_FALLBACK_IMAGES.default;
            }}
          />
          {/* Category badge overlay */}
          <div
            className={`absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${categoryConfig.bgClass} ${categoryConfig.textClass}`}
          >
            {categoryConfig.icon}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-3 min-w-0 flex flex-col justify-between">
          <div>
            <h3 className="font-semibold text-foreground text-sm leading-tight line-clamp-1">
              {event.title}
            </h3>
            <div className="flex items-center gap-1 mt-1 text-muted-foreground">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              <span className="text-xs truncate">{event.venue_name}</span>
            </div>
          </div>

          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>{formatTime(event.event_time)}</span>
              </div>
              {(event.attendee_count ?? 0) > 0 && (
                <div className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  <span>{event.attendee_count} going</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Chevron */}
        <div className="flex items-center pr-3">
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </div>
      </div>

      {/* Ticket number (if available) */}
      {event.ticket_number && (
        <div className="px-3 py-2 bg-muted/50 border-t border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Ticket</span>
            <span className="text-xs font-mono font-medium text-foreground">
              #{event.ticket_number}
            </span>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function formatTime(time: string): string {
  // Use 24-hour format for Dutch/European locale
  const [hours, minutes] = time.split(':');
  return `${hours}:${minutes}`;
}
