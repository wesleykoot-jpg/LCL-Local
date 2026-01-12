import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { useAuth } from '@/contexts/useAuth';
import { useCalendarIntegration } from '@/hooks/useCalendarIntegration';
import { Button } from '@/components/ui/button';

export default function CalendarCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile } = useAuth();
  const { handleCallback } = useCalendarIntegration(profile?.id || '');
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function processCallback() {
      const code = searchParams.get('code');
      const error = searchParams.get('error');

      // Handle OAuth error
      if (error) {
        setStatus('error');
        setErrorMessage('Authorization was cancelled or failed');
        return;
      }

      // Handle missing code
      if (!code) {
        setStatus('error');
        setErrorMessage('No authorization code received');
        return;
      }

      // Handle missing profile
      if (!profile?.id) {
        setStatus('error');
        setErrorMessage('User profile not found');
        return;
      }

      try {
        await handleCallback(code);
        setStatus('success');
        
        // Redirect to profile after 2 seconds
        setTimeout(() => {
          navigate('/profile');
        }, 2000);
      } catch (err) {
        setStatus('error');
        setErrorMessage(err instanceof Error ? err.message : 'Failed to connect calendar');
      }
    }

    processCallback();
  }, [searchParams, profile, handleCallback, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        <div className="bg-card rounded-3xl p-8 border border-border text-center">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            {status === 'loading' && (
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
            )}
            {status === 'success' && (
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
            )}
            {status === 'error' && (
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
                <XCircle className="w-8 h-8 text-red-500" />
              </div>
            )}
          </div>

          {/* Message */}
          {status === 'loading' && (
            <>
              <h1 className="text-2xl font-headline text-foreground mb-2">
                Connecting Calendar
              </h1>
              <p className="text-muted-foreground">
                Please wait while we connect your Google Calendar...
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <h1 className="text-2xl font-headline text-foreground mb-2">
                Calendar Connected!
              </h1>
              <p className="text-muted-foreground mb-6">
                Your events will now sync automatically with Google Calendar
              </p>
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span>Redirecting to your profile...</span>
              </div>
            </>
          )}

          {status === 'error' && (
            <>
              <h1 className="text-2xl font-headline text-foreground mb-2">
                Connection Failed
              </h1>
              <p className="text-muted-foreground mb-6">
                {errorMessage || 'Something went wrong while connecting your calendar'}
              </p>
              <Button
                onClick={() => navigate('/profile')}
                className="w-full"
              >
                Go to Profile
              </Button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
