import { Home, Map, User, Users, Baby, Settings } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { hapticImpact } from '@/shared/lib/haptics';
import { motion, AnimatePresence } from 'framer-motion';
import { useFeedMode } from '@/contexts/FeedContext';
import { useState } from 'react';

type NavView = 'feed' | 'planning' | 'profile' | 'scraper';

interface FloatingNavProps {
  activeView?: NavView;
  onNavigate?: (view: NavView) => void;
}

const NAV_ITEMS: { id: NavView; icon: typeof Home; label: string; path: string }[] = [
  { id: 'feed', icon: Home, label: 'Home', path: '/' },
  { id: 'planning', icon: Map, label: 'Planning', path: '/planning' },
  { id: 'profile', icon: User, label: 'Profile', path: '/profile' },
  { id: 'scraper', icon: Settings, label: 'Scraper', path: '/scraper-admin' },
];

export function FloatingNav({ activeView, onNavigate }: FloatingNavProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { feedMode, setFeedMode, isParentDetected } = useFeedMode();
  const [showModeToggle, setShowModeToggle] = useState(false);
  
  // Derive active view from route if not provided
  const currentPath = location.pathname;
  const derivedActiveView = activeView || 
    (currentPath.includes('scraper-admin') || currentPath.startsWith('/admin') ? 'scraper' :
     currentPath.includes('planning') ? 'planning' : 
     currentPath.includes('profile') ? 'profile' : 'feed');

  const handleNav = async (view: NavView, path: string) => {
    await hapticImpact('light');
    if (onNavigate) {
      onNavigate(view);
    } else {
      navigate(path);
    }
  };

  const handleToggleMode = async () => {
    await hapticImpact('medium');
    setShowModeToggle(!showModeToggle);
  };

  const handleModeChange = async (mode: 'family' | 'social' | 'default') => {
    await hapticImpact('light');
    setFeedMode(mode);
    setShowModeToggle(false);
  };

  // Only show mode toggle on feed page
  const showModeButton = derivedActiveView === 'feed';

  return (
    <>
      {/* Mode selection overlay */}
      <AnimatePresence>
        {showModeToggle && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowModeToggle(false)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="absolute bottom-[68px] left-4 right-4 bg-card rounded-2xl p-4 shadow-xl border border-border"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-sm font-semibold text-foreground mb-3">Feed Mode</h3>
              <div className="space-y-2">
                <button
                  onClick={() => handleModeChange('family')}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                    feedMode === 'family'
                      ? 'bg-teal-500/10 border-2 border-teal-500'
                      : 'bg-muted border-2 border-transparent'
                  }`}
                >
                  <Baby size={20} className="text-teal-600" />
                  <div className="flex-1 text-left">
                    <p className="text-sm font-semibold text-foreground">Family Mode</p>
                    <p className="text-xs text-muted-foreground">Kid-friendly & outdoor activities</p>
                  </div>
                  {feedMode === 'family' && (
                    <div className="w-2 h-2 rounded-full bg-teal-500" />
                  )}
                </button>

                <button
                  onClick={() => handleModeChange('social')}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                    feedMode === 'social'
                      ? 'bg-blue-500/10 border-2 border-blue-500'
                      : 'bg-muted border-2 border-transparent'
                  }`}
                >
                  <Users size={20} className="text-blue-600" />
                  <div className="flex-1 text-left">
                    <p className="text-sm font-semibold text-foreground">Social Mode</p>
                    <p className="text-xs text-muted-foreground">Nightlife, dining & adult hangouts</p>
                  </div>
                  {feedMode === 'social' && (
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                  )}
                </button>

                <button
                  onClick={() => handleModeChange('default')}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                    feedMode === 'default'
                      ? 'bg-primary/10 border-2 border-primary'
                      : 'bg-muted border-2 border-transparent'
                  }`}
                >
                  <Home size={20} className="text-primary" />
                  <div className="flex-1 text-left">
                    <p className="text-sm font-semibold text-foreground">All Events</p>
                    <p className="text-xs text-muted-foreground">Show everything</p>
                  </div>
                  {feedMode === 'default' && (
                    <div className="w-2 h-2 rounded-full bg-primary" />
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.nav 
        className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border pb-safe"
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        style={{
          boxShadow: '0 -1px 0 0 hsl(var(--border))'
        }}
      >
        {/* Mode indicator banner */}
        {showModeButton && feedMode !== 'default' && (
          <div 
            className={`px-4 py-1.5 text-center text-xs font-medium ${
              feedMode === 'family' 
                ? 'bg-teal-500/10 text-teal-600 border-b border-teal-500/20' 
                : 'bg-blue-500/10 text-blue-600 border-b border-blue-500/20'
            }`}
          >
            {feedMode === 'family' ? '👨‍👩‍👧 Family Mode Active' : '🎉 Social Mode Active'}
          </div>
        )}

        <div className="flex items-center justify-around h-[52px] max-w-lg mx-auto px-2">
          {NAV_ITEMS.map((item) => {
            const isActive = derivedActiveView === item.id;
            const Icon = item.icon;
            
            return (
              <button
                key={item.id}
                onClick={() => handleNav(item.id, item.path)}
                className="flex flex-col items-center justify-center flex-1 h-full min-h-[44px] min-w-[44px] gap-0.5 transition-colors"
              >
                <div className="relative">
                  <Icon 
                    size={24} 
                    strokeWidth={isActive ? 2.5 : 1.5}
                    className={`transition-colors ${
                      isActive 
                        ? 'text-primary' 
                        : 'text-muted-foreground'
                    }`}
                    fill={isActive ? 'currentColor' : 'none'}
                  />
                </div>
                <span 
                  className={`text-[10px] font-medium transition-colors ${
                    isActive 
                      ? 'text-primary' 
                      : 'text-muted-foreground'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}

          {/* Mode toggle button - only on feed page */}
          {showModeButton && (
            <button
              onClick={handleToggleMode}
              className="flex flex-col items-center justify-center flex-1 h-full min-h-[44px] min-w-[44px] gap-0.5 transition-colors"
            >
              <div className="relative">
                {feedMode === 'family' ? (
                  <Baby size={24} strokeWidth={1.5} className="text-teal-600" />
                ) : feedMode === 'social' ? (
                  <Users size={24} strokeWidth={1.5} className="text-blue-600" />
                ) : (
                  <div className="w-6 h-6 rounded-full border-2 border-muted-foreground" />
                )}
              </div>
              <span className="text-[10px] font-medium text-muted-foreground">
                Mode
              </span>
            </button>
          )}
        </div>
      </motion.nav>
    </>
  );
}
