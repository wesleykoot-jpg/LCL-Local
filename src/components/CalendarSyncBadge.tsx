import React, { useState, useEffect } from 'react';
import { Calendar, CheckCircle2 } from 'lucide-react';
import { isEventSynced } from '@/lib/googleCalendarService';
import { useAuth } from '@/contexts/useAuth';

interface CalendarSyncBadgeProps {
  eventId: string;
}

/**
 * Badge component that shows if an event is synced to Google Calendar
 */
export function CalendarSyncBadge({ eventId }: CalendarSyncBadgeProps) {
  const { profile } = useAuth();
  const [isSynced, setIsSynced] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkSync() {
      if (!profile?.id) {
        setLoading(false);
        return;
      }

      try {
        const synced = await isEventSynced(profile.id, eventId);
        setIsSynced(synced);
      } catch (error) {
        console.error('Error checking sync status:', error);
      } finally {
        setLoading(false);
      }
    }

    checkSync();
  }, [eventId, profile?.id]);

  if (loading || !isSynced) {
    return null;
  }

  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-green-500/10 rounded-full border border-green-500/20">
      <Calendar className="w-3 h-3 text-green-500" />
      <CheckCircle2 className="w-3 h-3 text-green-500" />
      <span className="text-xs font-medium text-green-500">Synced</span>
    </div>
  );
}
