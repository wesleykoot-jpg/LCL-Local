import { Compass, Map, User, Sparkles } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { hapticImpact } from '@/shared/lib/haptics';
import { motion, AnimatePresence } from 'framer-motion';
import { useScrollDirection } from '@/hooks/useScrollDirection';

type NavView = 'feed' | 'planning' | 'profile' | 'now';

interface FloatingNavProps {
  activeView?: NavView;
  onNavigate?: (view: NavView) => void;
}

// Animation constants for icon scale effect
const ICON_SCALE_ACTIVE = 1.1;
const ICON_SCALE_INACTIVE = 1;
const ICON_ANIMATION_CONFIG = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 17,
};

export function FloatingNav({ activeView, onNavigate }: FloatingNavProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const scrollDirection = useScrollDirection();
  
  // Derive active view from route if not provided
  const currentPath = location.pathname;
  const derivedActiveView = activeView || 
    (currentPath === '/now' ? 'now' :
     currentPath.includes('planning') ? 'planning' : 
     currentPath.includes('profile') ? 'profile' : 'feed');
  
  const isNowActive = derivedActiveView === 'now';
  const isHidden = scrollDirection === 'down';

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

  return (
    <motion.nav 
      initial={{ y: 0 }}
      animate={{ y: isHidden ? 100 : 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border pb-safe shadow-bottom-nav"
    >
      <div className="flex items-center justify-around h-[56px] max-w-lg mx-auto px-2">
        {/* Planning button */}
        <button
          onClick={() => handleNav('planning', '/planning')}
          className="flex flex-col items-center justify-center flex-1 h-full min-h-[44px] min-w-[44px] gap-0.5 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary focus-visible:outline-none"
          aria-label="Navigate to planning page"
        >
          <motion.div
            animate={{ 
              scale: derivedActiveView === 'planning' ? ICON_SCALE_ACTIVE : ICON_SCALE_INACTIVE,
            }}
            transition={ICON_ANIMATION_CONFIG}
            className="flex flex-col items-center gap-0.5"
          >
            <Map 
              size={24} 
              strokeWidth={derivedActiveView === 'planning' ? 2.5 : 1.5}
              className={`transition-colors ${
                derivedActiveView === 'planning' 
                  ? 'text-primary' 
                  : 'text-muted-foreground'
              }`}
            />
            <span 
              className={`text-[10px] font-medium transition-colors ${
                derivedActiveView === 'planning' 
                  ? 'text-primary' 
                  : 'text-muted-foreground'
              }`}
            >
              Planning
            </span>
          </motion.div>
        </button>

        {/* Discover button */}
        <button
          onClick={() => handleNav('feed', '/')}
          className="flex flex-col items-center justify-center flex-1 h-full min-h-[44px] min-w-[44px] gap-0.5 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary focus-visible:outline-none"
          aria-label="Navigate to discover page"
        >
          <motion.div
            animate={{ 
              scale: derivedActiveView === 'feed' ? ICON_SCALE_ACTIVE : ICON_SCALE_INACTIVE,
            }}
            transition={ICON_ANIMATION_CONFIG}
            className="flex flex-col items-center gap-0.5"
          >
            <Compass 
              size={24} 
              strokeWidth={derivedActiveView === 'feed' ? 2.5 : 1.5}
              className={`transition-colors ${
                derivedActiveView === 'feed' 
                  ? 'text-primary' 
                  : 'text-muted-foreground'
              }`}
            />
            <span 
              className={`text-[10px] font-medium transition-colors ${
                derivedActiveView === 'feed' 
                  ? 'text-primary' 
                  : 'text-muted-foreground'
              }`}
            >
              Discover
            </span>
          </motion.div>
        </button>

        {/* Now button */}
        <button
          onClick={handleNowClick}
          className="flex flex-col items-center justify-center flex-1 h-full min-h-[44px] min-w-[44px] gap-0.5 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary focus-visible:outline-none"
          aria-label="Navigate to now page"
        >
          <motion.div
            animate={{ 
              scale: isNowActive ? ICON_SCALE_ACTIVE : ICON_SCALE_INACTIVE,
            }}
            transition={ICON_ANIMATION_CONFIG}
            className="flex flex-col items-center gap-0.5"
          >
            <Sparkles 
              size={24} 
              strokeWidth={isNowActive ? 2.5 : 1.5}
              className={`transition-colors ${
                isNowActive 
                  ? 'text-primary' 
                  : 'text-muted-foreground'
              }`}
            />
            <span 
              className={`text-[10px] font-medium transition-colors ${
                isNowActive 
                  ? 'text-primary' 
                  : 'text-muted-foreground'
              }`}
            >
              Now
            </span>
          </motion.div>
        </button>

        {/* Profile button */}
        <button
          onClick={() => handleNav('profile', '/profile')}
          className="flex flex-col items-center justify-center flex-1 h-full min-h-[44px] min-w-[44px] gap-0.5 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary focus-visible:outline-none"
          aria-label="Navigate to profile page"
        >
          <motion.div
            animate={{ 
              scale: derivedActiveView === 'profile' ? ICON_SCALE_ACTIVE : ICON_SCALE_INACTIVE,
            }}
            transition={ICON_ANIMATION_CONFIG}
            className="flex flex-col items-center gap-0.5"
          >
            <User 
              size={24} 
              strokeWidth={derivedActiveView === 'profile' ? 2.5 : 1.5}
              className={`transition-colors ${
                derivedActiveView === 'profile' 
                  ? 'text-primary' 
                  : 'text-muted-foreground'
              }`}
            />
            <span 
              className={`text-[10px] font-medium transition-colors ${
                derivedActiveView === 'profile' 
                  ? 'text-primary' 
                  : 'text-muted-foreground'
              }`}
            >
              Profile
            </span>
          </motion.div>
        </button>
      </div>
    </motion.nav>
  );
}
