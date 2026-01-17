import { Compass, Map, User, Sparkles, Plus, Settings } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { hapticImpact } from '@/shared/lib/haptics';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { CreateEventModal } from '@/features/events/components/CreateEventModal';

type NavView = 'feed' | 'planning' | 'profile' | 'now' | 'admin';

interface FloatingNavProps {
  activeView?: NavView;
  onNavigate?: (view: NavView) => void;
}

export function FloatingNav({ activeView, onNavigate }: FloatingNavProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Derive active view from route if not provided
  const currentPath = location.pathname;
  const derivedActiveView = activeView || 
    (currentPath === '/now' ? 'now' :
     currentPath.includes('admin') || currentPath.includes('scraper') ? 'admin' :
     currentPath.includes('planning') ? 'planning' : 
     currentPath.includes('profile') ? 'profile' : 'feed');
  
  const isNowActive = derivedActiveView === 'now';
  const isAdminActive = derivedActiveView === 'admin';

  const handleNav = async (view: NavView, path: string) => {
    await hapticImpact('light');
    if (onNavigate) {
      onNavigate(view);
    } else {
      navigate(path);
    }
  };
  
  const handleNowClick = async () => {
    await hapticImpact('medium');
    navigate('/now');
  };

  const handleCreateClick = async () => {
    await hapticImpact('medium');
    setShowCreateModal(true);
  };

  return (
    <>
      <motion.nav 
        className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border pb-safe"
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        style={{
          boxShadow: '0 -1px 0 0 hsl(var(--border))'
        }}
      >
        <div className="flex items-center justify-around h-[56px] max-w-lg mx-auto px-2">
          {/* Planning button */}
          <button
            onClick={() => handleNav('planning', '/planning')}
            className="flex flex-col items-center justify-center flex-1 h-full min-h-[44px] min-w-[44px] gap-0.5 transition-colors"
          >
            <div className="relative">
              <Map 
                size={24} 
                strokeWidth={derivedActiveView === 'planning' ? 2.5 : 1.5}
                className={`transition-colors ${
                  derivedActiveView === 'planning' 
                    ? 'text-primary' 
                    : 'text-muted-foreground'
                }`}
                fill={derivedActiveView === 'planning' ? 'currentColor' : 'none'}
              />
            </div>
            <span 
              className={`text-[10px] font-medium transition-colors ${
                derivedActiveView === 'planning' 
                  ? 'text-primary' 
                  : 'text-muted-foreground'
              }`}
            >
              Planning
            </span>
          </button>

          {/* Discover button */}
          <button
            onClick={() => handleNav('feed', '/')}
            className="flex flex-col items-center justify-center flex-1 h-full min-h-[44px] min-w-[44px] gap-0.5 transition-colors"
          >
            <div className="relative">
              <Compass 
                size={24} 
                strokeWidth={derivedActiveView === 'feed' ? 2.5 : 1.5}
                className={`transition-colors ${
                  derivedActiveView === 'feed' 
                    ? 'text-primary' 
                    : 'text-muted-foreground'
                }`}
                fill={derivedActiveView === 'feed' ? 'currentColor' : 'none'}
              />
            </div>
            <span 
              className={`text-[10px] font-medium transition-colors ${
                derivedActiveView === 'feed' 
                  ? 'text-primary' 
                  : 'text-muted-foreground'
              }`}
            >
              Discover
            </span>
          </button>

          {/* Create button - Center with elevated styling */}
          <button
            onClick={handleCreateClick}
            className="flex items-center justify-center w-12 h-12 -mt-4 rounded-full bg-primary shadow-lg transition-transform active:scale-95"
          >
            <Plus size={28} strokeWidth={2.5} className="text-primary-foreground" />
          </button>

          {/* Now button */}
          <button
            onClick={handleNowClick}
            className="flex flex-col items-center justify-center flex-1 h-full min-h-[44px] min-w-[44px] gap-0.5 transition-colors"
          >
            <div className="relative">
              <Sparkles 
                size={24} 
                strokeWidth={isNowActive ? 2.5 : 1.5}
                className={`transition-colors ${
                  isNowActive 
                    ? 'text-primary' 
                    : 'text-muted-foreground'
                }`}
                fill={isNowActive ? 'currentColor' : 'none'}
              />
            </div>
            <span 
              className={`text-[10px] font-medium transition-colors ${
                isNowActive 
                  ? 'text-primary' 
                  : 'text-muted-foreground'
              }`}
            >
              Now
            </span>
          </button>

          {/* Profile button */}
          <button
            onClick={() => handleNav('profile', '/profile')}
            className="flex flex-col items-center justify-center flex-1 h-full min-h-[44px] min-w-[44px] gap-0.5 transition-colors"
          >
            <div className="relative">
              <User 
                size={24} 
                strokeWidth={derivedActiveView === 'profile' ? 2.5 : 1.5}
                className={`transition-colors ${
                  derivedActiveView === 'profile' 
                    ? 'text-primary' 
                    : 'text-muted-foreground'
                }`}
                fill={derivedActiveView === 'profile' ? 'currentColor' : 'none'}
              />
            </div>
            <span 
              className={`text-[10px] font-medium transition-colors ${
                derivedActiveView === 'profile' 
                  ? 'text-primary' 
                  : 'text-muted-foreground'
              }`}
            >
              Profile
            </span>
          </button>

          {/* Admin button */}
          <button
            onClick={() => handleNav('admin', '/admin')}
            className="flex flex-col items-center justify-center flex-1 h-full min-h-[44px] min-w-[44px] gap-0.5 transition-colors"
          >
            <div className="relative">
              <Settings 
                size={24} 
                strokeWidth={isAdminActive ? 2.5 : 1.5}
                className={`transition-colors ${
                  isAdminActive 
                    ? 'text-primary' 
                    : 'text-muted-foreground'
                }`}
              />
            </div>
            <span 
              className={`text-[10px] font-medium transition-colors ${
                isAdminActive 
                  ? 'text-primary' 
                  : 'text-muted-foreground'
              }`}
            >
              Admin
            </span>
          </button>
        </div>
      </motion.nav>

      {/* Create Event Modal */}
      <CreateEventModal 
        isOpen={showCreateModal} 
        onClose={() => setShowCreateModal(false)} 
      />
    </>
  );
}
