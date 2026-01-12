import React, { useState } from 'react';
import { ExternalLink, Info } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { setUserProvidedClientId } from '@/integrations/googleCalendar/client';

interface GoogleCalendarSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfigured: () => void;
}

export function GoogleCalendarSetupDialog({
  open,
  onOpenChange,
  onConfigured,
}: GoogleCalendarSetupDialogProps) {
  const [clientId, setClientId] = useState('');
  const [error, setError] = useState('');
  
  // Get redirect URI safely (avoiding SSR issues)
  const redirectUri = typeof window !== 'undefined' 
    ? `${window.location.origin}/profile/calendar`
    : '/profile/calendar';

  const handleSave = () => {
    const trimmedClientId = clientId.trim();
    
    if (!trimmedClientId) {
      setError('Please paste your connection code');
      return;
    }

    // Basic validation - Google Client IDs end with .apps.googleusercontent.com
    if (!trimmedClientId.endsWith('.apps.googleusercontent.com')) {
      setError('This doesn\'t look right. The code should end with .apps.googleusercontent.com');
      return;
    }

    // Save the client ID
    setUserProvidedClientId(trimmedClientId);
    
    // Reset state and close
    setClientId('');
    setError('');
    onOpenChange(false);
    onConfigured();
  };

  const handleCancel = () => {
    setClientId('');
    setError('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Connect Your Calendar</DialogTitle>
          <DialogDescription>
            Set up calendar sync so events you join automatically appear in your Google Calendar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Info alert */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 flex gap-3">
            <Info size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-700 space-y-2">
              <p className="font-medium">You'll need a free Google account to continue</p>
              <p>Follow these quick steps to connect your calendar:</p>
            </div>
          </div>

          {/* Setup instructions */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3 text-sm">
            <div className="space-y-2">
              <p className="font-semibold">Step 1: Go to Google Cloud Console</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground ml-2">
                <li>Visit <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">Google Cloud Console <ExternalLink size={12} /></a></li>
                <li>Create a new project (give it any name you like)</li>
              </ol>
            </div>

            <div className="space-y-2">
              <p className="font-semibold">Step 2: Turn on Calendar Access</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground ml-2">
                <li>Go to "APIs & Services" then "Library"</li>
                <li>Find "Google Calendar API" and click Enable</li>
              </ol>
            </div>

            <div className="space-y-2">
              <p className="font-semibold">Step 3: Get Your Connection Code</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground ml-2">
                <li>Go to "APIs & Services" then "Credentials"</li>
                <li>Click "Create Credentials" and choose "OAuth client ID"</li>
                <li>Pick "Web application"</li>
                <li>Add this redirect address: <code className="bg-background px-1 py-0.5 rounded text-xs">{redirectUri}</code></li>
                <li>Click "Create" and copy the code it gives you</li>
              </ol>
            </div>
          </div>

          {/* Input field */}
          <div className="space-y-2">
            <label htmlFor="clientId" className="text-sm font-medium">
              Paste Your Connection Code Here
            </label>
            <Input
              id="clientId"
              placeholder="1234567890-abcdefghijklmnop.apps.googleusercontent.com"
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value);
                setError('');
              }}
              className={error ? 'border-red-500' : ''}
            />
            {error && (
              <p className="text-xs text-red-600">{error}</p>
            )}
            <p className="text-xs text-muted-foreground">
              The code should end with .apps.googleusercontent.com
            </p>
          </div>

          {/* Help link */}
          <div className="bg-muted/50 rounded-lg p-3">
            <a
              href="https://developers.google.com/calendar/api/quickstart/js"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline flex items-center gap-2"
            >
              <ExternalLink size={14} />
              Need more help? View the detailed guide
            </a>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Connect Calendar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
