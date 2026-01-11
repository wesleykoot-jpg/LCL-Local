/**
 * Calendar Settings Component
 * 
 * Allows users to connect/disconnect Google and Microsoft calendar accounts
 */

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Calendar, Check, Loader2, Trash2 } from 'lucide-react';
import { calendarSyncService, type CalendarProvider } from '@/lib/calendar';
import { useToast } from '@/hooks/use-toast';

interface CalendarAccountDisplay {
  id: string;
  provider: CalendarProvider;
  providerEmail: string | null;
  syncEnabled: boolean;
  lastSyncAt: Date | null;
  lastSyncError: string | null;
}

export const CalendarSettings: React.FC = () => {
  const [accounts, setAccounts] = useState<CalendarAccountDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<CalendarProvider | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const { toast } = useToast();

  const googleConfigured = calendarSyncService.isProviderConfigured('google');
  const microsoftConfigured = calendarSyncService.isProviderConfigured('microsoft');

  const loadAccounts = async () => {
    const { accounts: fetchedAccounts, error } = await calendarSyncService.getAccounts();
    if (error) {
      toast({
        title: 'Error',
        description: error,
        variant: 'destructive',
      });
    }
    setAccounts(fetchedAccounts.map(a => ({
      id: a.id,
      provider: a.provider,
      providerEmail: a.providerEmail,
      syncEnabled: a.syncEnabled,
      lastSyncAt: a.lastSyncAt,
      lastSyncError: a.lastSyncError,
    })));
    setLoading(false);
  };

  useEffect(() => {
    loadAccounts();
    
    // Check for OAuth callback
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    
    if (code && state) {
      // Determine provider from URL path
      const path = window.location.pathname;
      let provider: CalendarProvider | null = null;
      
      if (path.includes('google')) {
        provider = 'google';
      } else if (path.includes('microsoft')) {
        provider = 'microsoft';
      }
      
      if (provider) {
        handleOAuthCallback(provider, code);
        // Clear URL params
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, []);

  const handleOAuthCallback = async (provider: CalendarProvider, code: string) => {
    setConnecting(provider);
    const { success, error } = await calendarSyncService.handleOAuthCallback(provider, code);
    setConnecting(null);

    if (success) {
      toast({
        title: 'Calendar Connected',
        description: `Your ${provider === 'google' ? 'Google' : 'Microsoft'} calendar has been connected.`,
      });
      loadAccounts();
    } else {
      toast({
        title: 'Connection Failed',
        description: error || 'Failed to connect calendar',
        variant: 'destructive',
      });
    }
  };

  const handleConnect = (provider: CalendarProvider) => {
    const url = calendarSyncService.getAuthorizationUrl(provider);
    window.location.href = url;
  };

  const handleDisconnect = async (accountId: string, provider: CalendarProvider) => {
    setDisconnecting(accountId);
    const { success, error } = await calendarSyncService.disconnectAccount(accountId);
    setDisconnecting(null);

    if (success) {
      toast({
        title: 'Calendar Disconnected',
        description: `Your ${provider === 'google' ? 'Google' : 'Microsoft'} calendar has been disconnected.`,
      });
      setAccounts(accounts.filter(a => a.id !== accountId));
    } else {
      toast({
        title: 'Error',
        description: error || 'Failed to disconnect calendar',
        variant: 'destructive',
      });
    }
  };

  const handleToggleSync = async (accountId: string, enabled: boolean) => {
    const { success, error } = await calendarSyncService.toggleSync(accountId, enabled);

    if (success) {
      setAccounts(accounts.map(a => 
        a.id === accountId ? { ...a, syncEnabled: enabled } : a
      ));
    } else {
      toast({
        title: 'Error',
        description: error || 'Failed to update sync setting',
        variant: 'destructive',
      });
    }
  };

  const getProviderIcon = (provider: CalendarProvider) => {
    if (provider === 'google') {
      return (
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
      );
    }
    return (
      <svg className="w-5 h-5" viewBox="0 0 24 24">
        <path fill="#f25022" d="M1 1h10v10H1z"/>
        <path fill="#00a4ef" d="M1 13h10v10H1z"/>
        <path fill="#7fba00" d="M13 1h10v10H13z"/>
        <path fill="#ffb900" d="M13 13h10v10H13z"/>
      </svg>
    );
  };

  const getConnectedAccount = (provider: CalendarProvider) => {
    return accounts.find(a => a.provider === provider);
  };

  if (!googleConfigured && !microsoftConfigured) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Calendar Sync
          </CardTitle>
          <CardDescription>
            Calendar sync is not configured. Contact your administrator to set up OAuth credentials.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Calendar Sync
        </CardTitle>
        <CardDescription>
          Connect your calendar to automatically add LCL events you join.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Google Calendar */}
            {googleConfigured && (
              <CalendarProviderRow
                provider="google"
                account={getConnectedAccount('google')}
                connecting={connecting === 'google'}
                disconnecting={disconnecting === getConnectedAccount('google')?.id}
                onConnect={() => handleConnect('google')}
                onDisconnect={(id) => handleDisconnect(id, 'google')}
                onToggleSync={handleToggleSync}
                getProviderIcon={getProviderIcon}
              />
            )}

            {/* Microsoft Calendar */}
            {microsoftConfigured && (
              <CalendarProviderRow
                provider="microsoft"
                account={getConnectedAccount('microsoft')}
                connecting={connecting === 'microsoft'}
                disconnecting={disconnecting === getConnectedAccount('microsoft')?.id}
                onConnect={() => handleConnect('microsoft')}
                onDisconnect={(id) => handleDisconnect(id, 'microsoft')}
                onToggleSync={handleToggleSync}
                getProviderIcon={getProviderIcon}
              />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

interface CalendarProviderRowProps {
  provider: CalendarProvider;
  account: CalendarAccountDisplay | undefined;
  connecting: boolean;
  disconnecting: boolean;
  onConnect: () => void;
  onDisconnect: (id: string) => void;
  onToggleSync: (id: string, enabled: boolean) => void;
  getProviderIcon: (provider: CalendarProvider) => React.ReactNode;
}

const CalendarProviderRow: React.FC<CalendarProviderRowProps> = ({
  provider,
  account,
  connecting,
  disconnecting,
  onConnect,
  onDisconnect,
  onToggleSync,
  getProviderIcon,
}) => {
  const providerName = provider === 'google' ? 'Google Calendar' : 'Microsoft Outlook';

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg">
      <div className="flex items-center gap-3">
        {getProviderIcon(provider)}
        <div>
          <p className="font-medium">{providerName}</p>
          {account ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{account.providerEmail}</span>
              {account.lastSyncError ? (
                <Badge variant="destructive" className="text-xs">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Error
                </Badge>
              ) : account.syncEnabled ? (
                <Badge variant="secondary" className="text-xs">
                  <Check className="w-3 h-3 mr-1" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs">
                  Paused
                </Badge>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Not connected</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {account ? (
          <>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Sync</span>
              <Switch
                checked={account.syncEnabled}
                onCheckedChange={(checked) => onToggleSync(account.id, checked)}
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDisconnect(account.id)}
              disabled={disconnecting}
            >
              {disconnecting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 text-destructive" />
              )}
            </Button>
          </>
        ) : (
          <Button onClick={onConnect} disabled={connecting}>
            {connecting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              'Connect'
            )}
          </Button>
        )}
      </div>
    </div>
  );
};

export default CalendarSettings;
