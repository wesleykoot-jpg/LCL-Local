import { memo, useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Heart } from 'lucide-react';
import { getCategoryConfig } from '@/lib/categories';
import { cn } from '@/lib/utils';

interface EventCardProps {
  id: string;
  title: string;
  category: string;
  venue: string;
  date: string;
  imageUrl?: string;
  attendees?: Array<{ id: string; image: string; name?: string; isFriend?: boolean }>;
  totalAttendees?: number;
  onClick?: () => void;
  className?: string;
}

export const EventCard = memo(function EventCard({
  id,
  title,
  category,
  venue,
  date,
  imageUrl,
  attendees = [],
  totalAttendees = 0,
  onClick,
  className,
}: EventCardProps) {
  const [saved, setSaved] = useState(false);
  const categoryConfig = getCategoryConfig(category);
  
  // Fallback gradient for cards without images
  const fallbackBg = `linear-gradient(135deg, hsl(var(--muted)) 0%, hsl(var(--secondary)) 100%)`;

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSaved(!saved);
  };

  return (
    <motion.article
      onClick={onClick}
      className={cn(
        'relative overflow-hidden cursor-pointer group rounded-2xl bg-card',
        'shadow-sm hover:shadow-lg transition-shadow duration-300',
        className
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
    >
      {/* Image Section - 60% height, Airbnb style */}
      <div 
        className="relative w-full aspect-[4/3] overflow-hidden rounded-t-2xl"
        style={{ background: !imageUrl ? fallbackBg : undefined }}
      >
        {imageUrl && (
          <img
            src={imageUrl}
            alt=""
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        )}
        
        {/* Save/Heart Button - Airbnb style */}
        <button
          onClick={handleSave}
          className={cn(
            'absolute top-3 right-3 p-2 rounded-full transition-all duration-200',
            'bg-white/80 backdrop-blur-sm hover:bg-white hover:scale-110',
            saved && 'bg-white'
          )}
        >
          <Heart 
            size={18} 
            className={cn(
              'transition-colors',
              saved ? 'fill-red-500 text-red-500' : 'text-foreground'
            )}
          />
        </button>

        {/* Category pill overlay - bottom left of image */}
        <div className="absolute bottom-3 left-3">
          <span className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
            'bg-white/90 backdrop-blur-sm text-foreground'
          )}>
            <span className={cn('w-1.5 h-1.5 rounded-full', categoryConfig.dotClass)} />
            {categoryConfig.label}
          </span>
        </div>
      </div>

      {/* Content Section - Clean, minimal */}
      <div className="p-4">
        {/* Title - Bold, 2 lines max */}
        <h3 className="font-semibold text-base text-foreground leading-snug line-clamp-2 mb-1.5">
          {title}
        </h3>

        {/* Venue + Date - Muted, single line */}
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-3">
          <MapPin size={14} className="shrink-0 opacity-60" />
          <span className="truncate">{venue}</span>
          <span className="opacity-40">·</span>
          <span className="whitespace-nowrap">{date}</span>
        </div>

        {/* Social proof - Avatar stack + count */}
        {(attendees.length > 0 || totalAttendees > 0) && (
          <div className="flex items-center gap-2">
            {/* Avatar stack */}
            {attendees.length > 0 && (
              <div className="flex -space-x-2">
                {attendees.slice(0, 3).map((attendee) => (
                  <div
                    key={attendee.id}
                    className="w-6 h-6 rounded-full border-2 border-card overflow-hidden"
                  >
                    <img
                      src={attendee.image}
                      alt={attendee.name || ''}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            )}
            <span className="text-xs text-muted-foreground">
              {totalAttendees} going
            </span>
          </div>
        )}
      </div>
    </motion.article>
  );
});
