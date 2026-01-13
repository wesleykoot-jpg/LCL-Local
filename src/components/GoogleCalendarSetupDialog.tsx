import React, { useState } from 'react';
import { ExternalLink, Copy, Check, HelpCircle, Shield } from 'lucide-react';
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
import { toast } from 'sonner';

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
  const [connectionKey, setConnectionKey] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  
  // Get redirect URI safely (avoiding SSR issues)
  const redirectUri = typeof window !== 'undefined' 
    ? `${window.location.origin}/profile/calendar`
    : '/profile/calendar';

  const handleCopyRedirectUri = async () => {
    try {
      await navigator.clipboard.writeText(redirectUri);
      setCopied(true);
      toast.success('Link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleSave = () => {
    const trimmedKey = connectionKey.trim();
    
    if (!trimmedKey) {
      setError('Please paste your connection key');
      return;
    }

    // Basic validation - Google Client IDs end with .apps.googleusercontent.com
    if (!trimmedKey.endsWith('.apps.googleusercontent.com')) {
      setError("This doesn't look right. Your key should end with '.apps.googleusercontent.com'. Make sure you copied the entire key.");
      return;
    }

    // Save the client ID
    setUserProvidedClientId(trimmedKey);
    
    // Reset state and close
    setConnectionKey('');
    setError('');
    onOpenChange(false);
    onConfigured();
    toast.success('Calendar connected successfully!');
  };

  const handleCancel = () => {
    setConnectionKey('');
    setError('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Connect Your Calendar</DialogTitle>
          <DialogDescription className="text-base">
            One-time setup to sync events automatically
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Why this step */}
          <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 flex gap-3">
            <Shield size={20} className="text-primary flex-shrink-0 mt-0.5" />
            <div className="text-sm space-y-1">
              <p className="font-medium text-foreground">Why do I need to do this?</p>
              <p className="text-muted-foreground">
                For your privacy, we don't store Google access for all users. This personal setup ensures only you can access your calendar.
              </p>
            </div>
          </div>

          {/* Setup steps */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</span>
              Open Google's settings page
            </div>
            <Button
              variant="outline"
              className="w-full justify-center gap-2"
              onClick={() => window.open('https://console.cloud.google.com/projectcreate', '_blank')}
            >
              <ExternalLink size={16} />
              Open Google Settings
            </Button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</span>
              Create a new project
            </div>
            <p className="text-sm text-muted-foreground ml-8">
              Name it anything you like, such as "My Calendar Sync"
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">3</span>
              Turn on Calendar access
            </div>
            <div className="ml-8 space-y-2">
              <p className="text-sm text-muted-foreground">
                Go to "APIs & Services" → "Library", search for "Google Calendar API" and click "Enable"
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">4</span>
              Create your connection key
            </div>
            <div className="ml-8 space-y-3">
              <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
                <li>Go to "APIs & Services" → "Credentials"</li>
                <li>Click "Create Credentials" → "OAuth client ID"</li>
                <li>Choose "Web application"</li>
                <li>When asked for a redirect link, paste this:</li>
              </ol>
              
              {/* Copy redirect URI */}
              <div className="flex items-center gap-2 bg-muted rounded-lg p-2">
                <code className="flex-1 text-xs text-foreground truncate">{redirectUri}</code>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 flex-shrink-0"
                  onClick={handleCopyRedirectUri}
                >
                  {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">5</span>
              Paste your connection key below
            </div>
            <div className="ml-8 space-y-2">
              <Input
                id="connectionKey"
                placeholder="Paste your key here..."
                value={connectionKey}
                onChange={(e) => {
                  setConnectionKey(e.target.value);
                  setError('');
                }}
                className={error ? 'border-destructive' : ''}
              />
              {error && (
                <p className="text-xs text-destructive">{error}</p>
              )}
              <p className="text-xs text-muted-foreground">
                It ends with .apps.googleusercontent.com
              </p>
            </div>
          </div>

          {/* Help section */}
          <details className="group">
            <summary className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
              <HelpCircle size={16} />
              Having trouble?
            </summary>
            <div className="mt-3 ml-6 space-y-2 text-sm text-muted-foreground">
              <p><strong>Can't find the credentials page?</strong> Make sure you've selected your project from the dropdown at the top.</p>
              <p><strong>OAuth consent screen?</strong> If asked, just fill in the app name and your email. You can skip optional fields.</p>
              <p><strong>Still stuck?</strong> The key you need looks like a long code ending in .apps.googleusercontent.com</p>
            </div>
          </details>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
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
