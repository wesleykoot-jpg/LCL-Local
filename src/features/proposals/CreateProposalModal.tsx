import { memo, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Clock, MapPin, ChevronRight, Loader2 } from 'lucide-react';
import { useAuth } from '@/features/auth';
import { createProposal } from '@/lib/proposalService';
import { createEvent } from '@/lib/eventService';
import { type OpeningHours, type DayOfWeek, type OpeningPeriod } from '@/lib/openingHours';
import toast from 'react-hot-toast';
import { hapticNotification } from '@/shared/lib/haptics';

interface CreateProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  venue: {
    id: string;
    title: string;
    venue_name: string;
    category: string;
    opening_hours?: OpeningHours | null;
    time_mode: 'window' | 'anytime';
    location?: unknown;
  };
  onSuccess?: () => void;
}

interface SuggestedTime {
  label: string;
  datetime: Date;
  isAvailable: boolean;
}

/**
 * CreateProposalModal - Modal for creating a meetup at a venue
 * 
 * Opens when user clicks "Plan Here" on a window/anytime venue.
 * Prefills with venue info and suggests times based on opening hours.
 */
export const CreateProposalModal = memo(function CreateProposalModal({
  isOpen,
  onClose,
  venue,
  onSuccess,
}: CreateProposalModalProps) {
  const { profile } = useAuth();
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [customTitle, setCustomTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mode] = useState<'proposal' | 'direct'>('direct'); // Start with direct creation

  // Generate suggested times based on venue opening hours
  const suggestedTimes = useMemo((): SuggestedTime[] => {
    const times: SuggestedTime[] = [];
    const now = new Date();
    
    if (venue.time_mode === 'anytime') {
      // For anytime venues, suggest daylight hours
      const daylightHours = [
        { hour: 10, label: 'Morning' },
        { hour: 14, label: 'Afternoon' },
        { hour: 17, label: 'Late Afternoon' },
      ];
      
      for (let dayOffset = 0; dayOffset < 3; dayOffset++) {
        const date = new Date(now);
        date.setDate(date.getDate() + dayOffset);
        
        for (const { hour } of daylightHours) {
          const datetime = new Date(date);
          datetime.setHours(hour, 0, 0, 0);
          
          // Skip past times
          if (datetime <= now) continue;
          
          times.push({
            label: formatSuggestedTime(datetime),
            datetime,
            isAvailable: true,
          });
          
          if (times.length >= 6) break;
        }
        if (times.length >= 6) break;
      }
    } else if (venue.opening_hours) {
      // For window venues, suggest times during opening hours
      const openingHours = venue.opening_hours;
      
      // Get next 3 days
      for (let dayOffset = 0; dayOffset < 7 && times.length < 6; dayOffset++) {
        const date = new Date(now);
        date.setDate(date.getDate() + dayOffset);
        
        const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase() as DayOfWeek;
        const hoursForDay = openingHours[dayName];

        if (hoursForDay && hoursForDay !== 'closed' && hoursForDay.length > 0) {
          const firstRange = hoursForDay[0];
          const timeParts = firstRange.open.split(':');
          if (timeParts.length < 2) continue;

          const openHour = parseInt(timeParts[0], 10);
          if (isNaN(openHour)) continue;

          const suggestHours = [openHour, 12, 18];

          for (const hour of suggestHours) {
            const datetime = new Date(date);
            datetime.setHours(hour, 0, 0, 0);

            if (datetime <= now) continue;

            const isWithinHours = isTimeWithinHours(hour, hoursForDay);

            if (isWithinHours) {
              times.push({
                label: formatSuggestedTime(datetime),
                datetime,
                isAvailable: true,
              });

              if (times.length >= 6) break;
            }
          }
        }
      }
    }
    
    return times;
  }, [venue.opening_hours, venue.time_mode]);

  const handleSubmit = useCallback(async () => {
    if (!profile?.id || !selectedTime) {
      toast.error('Please select a time');
      return;
    }

    setIsSubmitting(true);

    try {
      const eventTitle = customTitle || `Meetup at ${venue.venue_name || venue.title}`;
      const selectedDateTime = new Date(selectedTime);

      if (mode === 'direct') {
        // Create child event directly
        const { error } = await createEvent({
          title: eventTitle,
          category: venue.category as 'cinema' | 'market' | 'crafts' | 'sports' | 'gaming',
          event_type: 'fork',
          event_date: selectedDateTime.toISOString().split('T')[0],
          event_time: selectedDateTime.toTimeString().slice(0, 5),
          venue_name: venue.venue_name || venue.title,
          location: venue.location ? JSON.stringify(venue.location) : 'POINT(0 0)',
          parent_event_id: venue.id,
          creator_profile_id: profile.id,
        });

        if (error) throw error;

        await hapticNotification('success');
        toast.success('Meetup created! Check your calendar.');
      } else {
        // Create proposal (for negotiation flow)
        const { error } = await createProposal({
          eventId: venue.id,
          creatorId: profile.id,
          proposedTimes: [selectedTime],
        });

        if (error) throw error;

        await hapticNotification('success');
        toast.success('Proposal created! Invite friends to confirm.');
      }

      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Error creating meetup:', error);
      await hapticNotification('error');
      toast.error('Failed to create meetup. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [profile, selectedTime, customTitle, venue, mode, onSuccess, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />

        {/* Modal */}
        <motion.div
          className="relative w-full max-w-lg bg-card rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-xl"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 className="text-lg font-bold text-foreground">Plan a Meetup</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-muted transition-colors"
            >
              <X size={20} className="text-muted-foreground" />
            </button>
          </div>

          {/* Venue Info */}
          <div className="p-4 bg-muted/50 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <MapPin size={20} className="text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{venue.title}</h3>
                <p className="text-sm text-muted-foreground">{venue.venue_name}</p>
              </div>
            </div>
          </div>

          {/* Custom Title Input */}
          <div className="p-4 border-b border-border">
            <label className="block text-sm font-medium text-foreground mb-2">
              Event Title (optional)
            </label>
            <input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder={`Meetup at ${venue.venue_name || venue.title}`}
              className="w-full px-4 py-3 rounded-xl bg-muted border border-border focus:border-primary focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
            />
          </div>

          {/* Time Selection */}
          <div className="p-4">
            <label className="block text-sm font-medium text-foreground mb-3">
              Select a Time
            </label>
            
            <div className="grid grid-cols-2 gap-2">
              {suggestedTimes.map((time, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedTime(time.datetime.toISOString())}
                  className={`p-3 rounded-xl text-left transition-all ${
                    selectedTime === time.datetime.toISOString()
                      ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-card'
                      : 'bg-muted hover:bg-muted/80 text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="opacity-60" />
                    <span className="text-sm font-medium">{time.label}</span>
                  </div>
                </button>
              ))}
            </div>

            {suggestedTimes.length === 0 && (
              <div className="text-center py-6 text-muted-foreground">
                <Clock size={24} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">No suggested times available</p>
              </div>
            )}
          </div>

          {/* Action Button */}
          <div className="p-4 border-t border-border">
            <button
              onClick={handleSubmit}
              disabled={!selectedTime || isSubmitting}
              className={`w-full h-[52px] rounded-xl text-[16px] font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
                selectedTime && !isSubmitting
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <span>Create Meetup</span>
                  <ChevronRight size={18} />
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
});

// Helper functions

function formatSuggestedTime(date: Date): string {
  const time = date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
  
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  if (date.toDateString() === today.toDateString()) {
    return `Today ${time}`;
  } else if (date.toDateString() === tomorrow.toDateString()) {
    return `Tomorrow ${time}`;
  }
  
  const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
  const dayNum = date.getDate();
  return `${dayName} ${dayNum} • ${time}`;
}

function isTimeWithinHours(hour: number, ranges: OpeningPeriod[]): boolean {
  const timeInMinutes = hour * 60;

  for (const range of ranges) {
    const [openHour, openMin] = range.open.split(':').map(Number);
    const [closeHour, closeMin] = range.close.split(':').map(Number);

    if ([openHour, openMin, closeHour, closeMin].some(Number.isNaN)) continue;

    const openMinutes = openHour * 60 + openMin;
    const closeMinutes = closeHour * 60 + closeMin;

    if (range.closes_next_day) {
      if (timeInMinutes >= openMinutes) return true;
      continue;
    }

    if (timeInMinutes >= openMinutes && timeInMinutes < closeMinutes) {
      return true;
    }
  }

  return false;
}
