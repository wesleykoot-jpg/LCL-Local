import { useEffect, useState } from 'react';
import { supabase, getSupabaseConfig, isLocalSupabase } from '@/integrations/supabase/client';

interface ConnectionStatus {
  success: boolean;
  message: string;
  data?: unknown;
  error?: unknown;
  config?: {
    url: string;
    isLocal: boolean;
    isDev: boolean;
    isDebugEnabled: boolean;
  };
}

export function DebugConnection() {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    testConnection();
  }, []);

  async function testConnection() {
    setLoading(true);
    const config = getSupabaseConfig();
    
    try {
      console.log('[DebugConnection] Testing database connection...');
      console.log('[DebugConnection] Config:', config);

      const { data, error } = await supabase
        .from('events')
        .select('*')
        .limit(1);

      if (error) {
        console.error('[DebugConnection] Error:', error);
        setStatus({
          success: false,
          message: 'Database connection failed',
          error: error,
          config
        });
      } else {
        console.log('[DebugConnection] Success:', data);
        setStatus({
          success: true,
          message: isLocalSupabase() ? 'Local Database Connected' : 'Database Connected',
          data: data,
          config
        });
      }
    } catch (err: unknown) {
      console.error('[DebugConnection] Exception:', err);
      setStatus({
        success: false,
        message: 'Connection exception',
        error: err,
        config
      });
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="fixed top-4 right-4 z-50 bg-yellow-500/20 backdrop-blur-sm border border-yellow-500/50 rounded-lg p-4 min-w-[300px]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
          <span className="text-yellow-200 font-medium">Testing Connection...</span>
        </div>
      </div>
    );
  }

  if (!status) return null;

  return (
    <div className="fixed top-4 right-4 z-50 max-w-2xl">
      <div className={`backdrop-blur-sm border rounded-lg p-4 ${
        status.success
          ? 'bg-green-500/20 border-green-500/50'
          : 'bg-red-500/20 border-red-500/50'
      }`}>
        <div className="flex items-start gap-3">
          <div className={`w-3 h-3 rounded-full mt-1 ${
            status.success ? 'bg-green-500' : 'bg-red-500'
          }`} />

          <div className="flex-1">
            <div className={`font-bold text-lg mb-2 ${
              status.success ? 'text-green-200' : 'text-red-200'
            }`}>
              {status.message}
            </div>

            {status.config && (
              <div className="text-xs text-white/50 mb-2">
                {status.config.isLocal ? '🏠 Local' : '☁️ Cloud'} • {status.config.isDev ? 'Dev' : 'Prod'}
              </div>
            )}

            {status.success && status.data && (
              <div className="text-green-300/80 text-sm">
                <div className="mb-1">✓ Successfully fetched {(status.data as unknown[]).length} record(s)</div>
                <div className="text-xs opacity-60">Database is ready</div>
              </div>
            )}

            {!status.success && status.error && (
              <div className="mt-2">
                <div className="text-red-300 font-semibold mb-1 text-sm">Error Details:</div>
                <pre className="bg-black/30 rounded p-2 text-xs text-red-200 overflow-auto max-h-[300px]">
                  {JSON.stringify(status.error, null, 2)}
                </pre>

                <div className="mt-3 text-red-300/80 text-xs">
                  <div className="font-semibold mb-1">Common Issues:</div>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Check RLS policies (ensure public SELECT access)</li>
                    <li>Verify table names match TypeScript types</li>
                    <li>Confirm environment variables are set correctly</li>
                    {status.config?.isLocal && (
                      <li>Ensure local Supabase is running: <code>supabase start</code></li>
                    )}
                  </ul>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={testConnection}
            className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded text-xs transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    </div>
  );
}
