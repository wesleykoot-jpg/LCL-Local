import { motion } from 'framer-motion';
import { MapPin, Clock } from 'lucide-react';
import { cn } from "@/lib/utils";
import { Facepile, FacepileUser } from './Facepile';
import { useMotionPreset } from '@/hooks/useMotionPreset';

/**
 * TicketStub - A timeline event card styled like a physical ticket stub
 * 
 * Part of the v5.0 "Social Air" Design System.
 * Displays event info with date block, title, location, time, and facepile of attendees.
 */

interface TicketStubProps {
  id: string;
  date: Date;
  title: string;
  location?: string;
  time?: string;
  friends?: FacepileUser[];
  imageUrl?: string;
  onClick?: () => void;
  index?: number;
  className?: string;
}

export function TicketStub({
  date,
  title,
  location,
  time,
  friends = [],
  onClick,
  index = 0,
  className,
}: TicketStubProps) {
  const motionPreset = useMotionPreset();
  
  const day = date.toLocaleDateString('en-US', { day: 'numeric' });
  const month = date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const formattedTime = time || date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });

  return (
    <motion.button
      className={cn(
        "w-full bg-surface-card rounded-card shadow-card p-4",
        "flex items-stretch gap-4 text-left",
        "hover:shadow-card-hover transition-shadow",
        "focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2",
        className
      )}
      onClick={onClick}
      {...(motionPreset.prefersReducedMotion ? {} : {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        transition: { delay: index * 0.05, type: 'spring', damping: 20, stiffness: 200 },
        whileHover: { scale: 1.01 },
        whileTap: { scale: 0.99 },
      })}
      aria-label={`${title} on ${month} ${day}${location ? ` at ${location}` : ''}`}
    >
      {/* Date Block */}
      <div className="flex flex-col items-center justify-center w-14 shrink-0">
        <span className="text-2xl font-bold text-text-primary leading-none">
          {day}
        </span>
        <span className="text-xs font-semibold text-text-secondary tracking-wide">
          {month}
        </span>
      </div>

      {/* Divider */}
      <div className="w-px bg-gray-200 self-stretch" aria-hidden="true" />

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
        <h3 className="font-semibold text-text-primary truncate">
          {title}
        </h3>
        
        <div className="flex items-center gap-3 text-text-secondary text-sm">
          {location && (
            <span className="flex items-center gap-1 truncate">
              <MapPin size={14} aria-hidden="true" />
              <span className="truncate">{location}</span>
            </span>
          )}
          
          <span className="flex items-center gap-1 shrink-0">
            <Clock size={14} aria-hidden="true" />
            <span>{formattedTime}</span>
          </span>
        </div>

        {/* Facepile of friends */}
        {friends.length > 0 && (
          <div className="mt-1">
            <Facepile users={friends} size="sm" maxVisible={4} />
          </div>
        )}
      </div>
    </motion.button>
  );
}
