/**
 * Calendar Sync Status Indicator
 * 
 * Shows the sync status of an event to connected calendars
 */

import React, { useEffect, useState } from 'react';
import { Calendar, Check, AlertCircle, Clock, Loader2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { calendarSyncService, type CalendarProvider, type CalendarSyncStatus } from '@/lib/calendar';
import { useAuth } from '@/contexts/useAuth';

interface CalendarSyncIndicatorProps {
  eventId: string;
  className?: string;
}

export const CalendarSyncIndicator: React.FC<CalendarSyncIndicatorProps> = ({ 
  eventId,
  className = '',
}) => {
  const { user } = useAuth();
  const [status, setStatus] = useState<{
    synced: boolean;
    providers: { provider: CalendarProvider; status: CalendarSyncStatus }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const loadStatus = async () => {
      const syncStatus = await calendarSyncService.getEventSyncStatus(eventId, user.id);
      setStatus(syncStatus);
      setLoading(false);
    };

    loadStatus();
  }, [eventId, user]);

  if (!user || loading) {
    return null;
  }

  if (!status || status.providers.length === 0) {
    return null;
  }

  const getStatusIcon = () => {
    if (status.providers.some(p => p.status === 'failed')) {
      return <AlertCircle className="w-4 h-4 text-destructive" />;
    }
    if (status.providers.some(p => p.status === 'pending')) {
      return <Clock className="w-4 h-4 text-yellow-500" />;
    }
    if (status.synced) {
      return <Check className="w-4 h-4 text-green-500" />;
    }
    return <Calendar className="w-4 h-4 text-muted-foreground" />;
  };

  const getStatusText = () => {
    const syncedProviders = status.providers
      .filter(p => p.status === 'synced')
      .map(p => p.provider === 'google' ? 'Google' : 'Outlook');
    
    const failedProviders = status.providers
      .filter(p => p.status === 'failed')
      .map(p => p.provider === 'google' ? 'Google' : 'Outlook');

    const pendingProviders = status.providers
      .filter(p => p.status === 'pending')
      .map(p => p.provider === 'google' ? 'Google' : 'Outlook');

    const parts: string[] = [];
    
    if (syncedProviders.length > 0) {
      parts.push(`Synced to ${syncedProviders.join(', ')}`);
    }
    if (pendingProviders.length > 0) {
      parts.push(`Syncing to ${pendingProviders.join(', ')}...`);
    }
    if (failedProviders.length > 0) {
      parts.push(`Failed: ${failedProviders.join(', ')}`);
    }

    return parts.join(' • ');
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`flex items-center gap-1 ${className}`}>
            <Calendar className="w-3 h-3 text-muted-foreground" />
            {getStatusIcon()}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{getStatusText()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default CalendarSyncIndicator;
