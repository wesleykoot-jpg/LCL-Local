import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, Link2, Unlink, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCalendarIntegration } from '@/hooks/useCalendarIntegration';
import { useAuth } from '@/contexts/useAuth';
import toast from 'react-hot-toast';

export function CalendarSettings() {
  const { profile } = useAuth();
  const { integration, loading, isConnected, connect, disconnect } = useCalendarIntegration(
    profile?.id || ''
  );

  const handleConnect = () => {
    try {
      connect();
    } catch (error) {
      toast.error('Failed to connect to Google Calendar');
      console.error('Connection error:', error);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      toast.success('Google Calendar disconnected successfully');
    } catch (error) {
      toast.error('Failed to disconnect Google Calendar');
      console.error('Disconnect error:', error);
    }
  };

  if (!profile) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-2xl p-6 border border-border"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Calendar className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">Calendar Integration</h3>
          <p className="text-sm text-muted-foreground">
            Sync your events with Google Calendar
          </p>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : isConnected ? (
        <div className="space-y-4">
          {/* Connected Status */}
          <div className="flex items-start gap-3 p-4 bg-green-500/10 rounded-lg border border-green-500/20">
            <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                Google Calendar Connected
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Your events are automatically synced to Google Calendar
              </p>
              {integration?.last_sync && (
                <p className="text-xs text-muted-foreground mt-2">
                  Last synced: {new Date(integration.last_sync).toLocaleString()}
                </p>
              )}
            </div>
          </div>

          {/* Sync Info */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-foreground">What's synced:</h4>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>Events you join are added to your calendar</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>Event updates are reflected in your calendar</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>Events are removed when you leave them</span>
              </li>
            </ul>
          </div>

          {/* Disconnect Button */}
          <Button
            onClick={handleDisconnect}
            variant="outline"
            className="w-full flex items-center justify-center gap-2"
          >
            <Unlink className="w-4 h-4" />
            Disconnect Google Calendar
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Not Connected Status */}
          <div className="flex items-start gap-3 p-4 bg-muted rounded-lg border border-border">
            <AlertCircle className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                Not Connected
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Connect your Google Calendar to automatically sync events
              </p>
            </div>
          </div>

          {/* Benefits */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-foreground">Benefits:</h4>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>Never miss an event with calendar reminders</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>See all your events in one place</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>Automatic updates when events change</span>
              </li>
            </ul>
          </div>

          {/* Connect Button */}
          <Button
            onClick={handleConnect}
            className="w-full flex items-center justify-center gap-2"
          >
            <Link2 className="w-4 h-4" />
            Connect Google Calendar
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            You'll be redirected to Google to authorize access
          </p>
        </div>
      )}
    </motion.div>
  );
}
