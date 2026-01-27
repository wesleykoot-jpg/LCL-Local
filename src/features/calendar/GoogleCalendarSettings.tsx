import { useEffect, useState } from 'react';
import { ChevronLeft, Calendar, Check, Loader2, AlertCircle, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useGoogleCalendar } from './hooks/useGoogleCalendar';
import { useAuth } from '@/features/auth';

export function GoogleCalendarSettings() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { 
    isConfigured, 
    isConnected, 
    isLoading,
    connectCalendar, 
    disconnectCalendar,
    handleOAuthCallback,
  } = useGoogleCalendar();
  
  const [isProcessingCallback, setIsProcessingCallback] = useState(false);

  // Handle OAuth callback on page load
  useEffect(() => {
    async function processCallback() {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.has('code')) {
        setIsProcessingCallback(true);
        const success = await handleOAuthCallback();
        
        if (success) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
        setIsProcessingCallback(false);
      }
    }

    processCallback();
  }, [handleOAuthCallback]);

  const handleConnect = () => {
    connectCalendar();
  };

  const handleDisconnect = async () => {
    await disconnectCalendar();
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans pb-8">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95  border-b border-border pt-safe">
        <div className="max-w-lg mx-auto px-5 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="flex items-center gap-2">
            <Calendar size={20} className="text-primary" />
            <h1 className="font-display text-xl text-foreground tracking-tight">
              Google Calendar
            </h1>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-5 py-6 space-y-6">
        {/* Processing callback state */}
        {isProcessingCallback && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-12 gap-4"
          >
            <Loader2 size={40} className="text-primary animate-spin" />
            <p className="text-muted-foreground">Connecting to Google Calendar...</p>
          </motion.div>
        )}

        {!isProcessingCallback && (
          <>
            {/* Integration Info */}
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-border rounded-2xl overflow-hidden"
            >
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-green-500 flex items-center justify-center">
                    <Calendar size={28} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <h2 className="font-semibold text-foreground text-lg">
                      Google Calendar Sync
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Automatically sync events you join
                    </p>
                  </div>
                  {isConnected && (
                    <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
                      <Check size={18} className="text-green-600" />
                    </div>
                  )}
                </div>

                {!isConfigured ? (
                  <div className="bg-amber-500/10 rounded-xl p-4 flex gap-3">
                    <AlertCircle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-amber-700 font-medium">
                        Integration Not Available
                      </p>
                      <p className="text-xs text-amber-600 mt-1">
                        Google Calendar integration is not configured for this app.
                      </p>
                    </div>
                  </div>
                ) : !profile ? (
                  <div className="bg-amber-500/10 rounded-xl p-4 flex gap-3">
                    <AlertCircle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-amber-700 font-medium">
                        Sign In Required
                      </p>
                      <p className="text-xs text-amber-600 mt-1">
                        Please sign in to connect your Google Calendar.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      When you connect Google Calendar, events you join will be automatically added to your calendar. 
                      Updates to event details will also sync automatically.
                    </p>

                    {isConnected ? (
                      <button
                        onClick={handleDisconnect}
                        disabled={isLoading}
                        className="w-full py-3 px-4 rounded-xl bg-red-500/10 text-red-600 font-medium hover:bg-red-500/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 size={18} className="animate-spin" />
                            Disconnecting...
                          </>
                        ) : (
                          'Disconnect Google Calendar'
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={handleConnect}
                        disabled={isLoading}
                        className="w-full py-3 px-4 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 size={18} className="animate-spin" />
                            Connecting...
                          </>
                        ) : (
                          <>
                            <Calendar size={18} />
                            Connect with Google
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </motion.section>

            {/* Features */}
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="space-y-3"
            >
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">
                What gets synced
              </h3>
              
              <div className="bg-card border border-border rounded-2xl divide-y divide-border">
                <div className="p-4 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Check size={16} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Event Details</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Title, description, date, time, and location
                    </p>
                  </div>
                </div>

                <div className="p-4 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Check size={16} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Automatic Reminders</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Get notified 1 day and 1 hour before events
                    </p>
                  </div>
                </div>

                <div className="p-4 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Check size={16} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Event Updates</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Changes to events are automatically synced
                    </p>
                  </div>
                </div>
              </div>
            </motion.section>

            {/* Privacy Notice */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-muted/50 rounded-lg p-4"
            >
              <p className="text-xs text-muted-foreground">
                <strong>Privacy:</strong> We only access your calendar to add and update events you join. 
                We never read your existing calendar entries or share your data with third parties. 
                You can disconnect at any time.
              </p>
            </motion.div>

            {/* Help Link */}
            <motion.a
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              href="https://support.google.com/calendar"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
            >
              Learn more about Google Calendar
              <ExternalLink size={14} />
            </motion.a>
          </>
        )}
      </div>
    </div>
  );
}

export default GoogleCalendarSettings;
