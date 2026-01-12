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

  const handleSave = () => {
    const trimmedClientId = clientId.trim();
    
    if (!trimmedClientId) {
      setError('Please enter a Client ID');
      return;
    }

    // Basic validation - Google Client IDs end with .apps.googleusercontent.com
    if (!trimmedClientId.endsWith('.apps.googleusercontent.com')) {
      setError('Client ID should end with .apps.googleusercontent.com');
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
          <DialogTitle>Setup Google Calendar Integration</DialogTitle>
          <DialogDescription>
            Configure your own Google Calendar integration by creating a Google Cloud project and OAuth credentials.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Info alert */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 flex gap-3">
            <Info size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-700 space-y-2">
              <p className="font-medium">You'll need a Google Cloud account (free tier is sufficient)</p>
              <p>Follow these steps to get your Google Client ID:</p>
            </div>
          </div>

          {/* Setup instructions */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3 text-sm">
            <div className="space-y-2">
              <p className="font-semibold">Step 1: Create a Google Cloud Project</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground ml-2">
                <li>Go to <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">Google Cloud Console <ExternalLink size={12} /></a></li>
                <li>Create a new project or select an existing one</li>
              </ol>
            </div>

            <div className="space-y-2">
              <p className="font-semibold">Step 2: Enable Google Calendar API</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground ml-2">
                <li>In your project, go to "APIs & Services" → "Library"</li>
                <li>Search for "Google Calendar API" and enable it</li>
              </ol>
            </div>

            <div className="space-y-2">
              <p className="font-semibold">Step 3: Create OAuth 2.0 Credentials</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground ml-2">
                <li>Go to "APIs & Services" → "Credentials"</li>
                <li>Click "Create Credentials" → "OAuth client ID"</li>
                <li>Select "Web application" as application type</li>
                <li>Add authorized redirect URI: <code className="bg-background px-1 py-0.5 rounded text-xs">{window.location.origin}/profile/calendar</code></li>
                <li>Click "Create" and copy your Client ID</li>
              </ol>
            </div>
          </div>

          {/* Input field */}
          <div className="space-y-2">
            <label htmlFor="clientId" className="text-sm font-medium">
              Google Client ID
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
              Your Client ID ends with .apps.googleusercontent.com
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
              View detailed setup guide from Google
            </a>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Configuration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
