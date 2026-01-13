import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Wrench, ChevronUp, ChevronDown, RefreshCw, X, Settings } from 'lucide-react';
import { triggerScraper } from '@/lib/scraperService';
import { toast } from 'sonner';

interface DevPanelProps {
  onRefetchEvents?: () => void;
}

export function DevPanel({ onRefetchEvents }: DevPanelProps) {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isScraping, setIsScraping] = useState(false);

  useEffect(() => {
    // Enable via URL param or localStorage
    const urlParams = new URLSearchParams(window.location.search);
    const devParam = urlParams.get('dev');
    const storedDev = localStorage.getItem('dev_mode');
    
    if (devParam === 'true') {
      localStorage.setItem('dev_mode', 'true');
      setIsEnabled(true);
    } else if (storedDev === 'true') {
      setIsEnabled(true);
    }
  }, []);

  const handleDisableDevMode = () => {
    localStorage.removeItem('dev_mode');
    setIsEnabled(false);
  };

  const handleScrape = async () => {
    setIsScraping(true);
    try {
      const result = await triggerScraper();
      if (result.success) {
        // Support both new and legacy response formats
        const inserted = result.totals?.inserted ?? result.inserted ?? 0;
        const skipped = result.totals?.skipped ?? result.skipped ?? 0;
        const sourceCount = result.sources?.length ?? 1;
        toast.success(`Scraped ${inserted} new events from ${sourceCount} source(s) (${skipped} duplicates)`);
        onRefetchEvents?.();
      } else {
        toast.error('Scraping failed: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      toast.error('Scraping failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsScraping(false);
    }
  };

  if (!isEnabled) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-24 left-4 z-50"
    >
      <div className="bg-amber-500/95 backdrop-blur-sm rounded-xl shadow-lg border border-amber-400/50 overflow-hidden">
        {/* Header - always visible */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 text-white font-medium text-sm hover:bg-amber-600/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Wrench size={14} />
            <span>DEV</span>
          </div>
          {isExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>

        {/* Expandable content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-3 py-2 space-y-2 border-t border-amber-400/30">
                {/* Admin Dashboard Button */}
                <button
                  onClick={() => navigate('/admin')}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-white text-xs font-medium transition-colors"
                >
                  <Settings size={12} />
                  Admin Dashboard
                </button>

                {/* Quick Scrape Button */}
                <button
                  onClick={handleScrape}
                  disabled={isScraping}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-white text-xs font-medium transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={12} className={isScraping ? 'animate-spin' : ''} />
                  {isScraping ? 'Scraping...' : 'Quick Scrape'}
                </button>

                {/* Disable Dev Mode Button */}
                <button
                  onClick={handleDisableDevMode}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-500/30 hover:bg-red-500/50 rounded-lg text-white text-xs font-medium transition-colors"
                >
                  <X size={12} />
                  Disable Dev Mode
                </button>

                {/* Help text */}
                <p className="text-[10px] text-white/70 text-center pt-1">
                  Enable: ?dev=true in URL
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
