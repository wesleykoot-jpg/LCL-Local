import { Compass, Map, User, Sparkles } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { hapticImpact } from '@/shared/lib/haptics';
import { motion } from 'framer-motion';

type NavView = 'feed' | 'planning' | 'profile' | 'now';

interface FloatingNavProps {
  activeView?: NavView;
  onNavigate?: (view: NavView) => void;
}

export function FloatingNav({ activeView, onNavigate }: FloatingNavProps) {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Derive active view from route if not provided
  const currentPath = location.pathname;
  const derivedActiveView = activeView || 
    (currentPath === '/now' ? 'now' :
     currentPath.includes('planning') ? 'planning' : 
     currentPath.includes('profile') ? 'profile' : 'feed');
  
  const isNowActive = derivedActiveView === 'now';

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
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 pb-safe shadow-bottom-nav"
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
    >
      <div className="flex items-center justify-around h-[56px] max-w-lg mx-auto px-2">
        {/* Planning button */}
        <button
          onClick={() => handleNav('planning', '/planning')}
          className="flex flex-col items-center justify-center flex-1 h-full min-h-[44px] min-w-[44px] gap-0.5 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-primary focus-visible:outline-none"
          aria-label="Navigate to planning page"
        >
          <Map 
            size={24} 
            strokeWidth={derivedActiveView === 'planning' ? 2.5 : 1.5}
            className={`transition-colors ${
              derivedActiveView === 'planning' 
                ? 'text-brand-primary' 
                : 'text-text-secondary'
            }`}
          />
          <span 
            className={`text-[10px] font-medium transition-colors ${
              derivedActiveView === 'planning' 
                ? 'text-brand-primary' 
                : 'text-text-secondary'
            }`}
          >
            Planning
          </span>
        </button>

        {/* Discover button */}
        <button
          onClick={() => handleNav('feed', '/')}
          className="flex flex-col items-center justify-center flex-1 h-full min-h-[44px] min-w-[44px] gap-0.5 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-primary focus-visible:outline-none"
          aria-label="Navigate to discover page"
        >
          <Compass 
            size={24} 
            strokeWidth={derivedActiveView === 'feed' ? 2.5 : 1.5}
            className={`transition-colors ${
              derivedActiveView === 'feed' 
                ? 'text-brand-primary' 
                : 'text-text-secondary'
            }`}
          />
          <span 
            className={`text-[10px] font-medium transition-colors ${
              derivedActiveView === 'feed' 
                ? 'text-brand-primary' 
                : 'text-text-secondary'
            }`}
          >
            Discover
          </span>
        </button>

        {/* Now button */}
        <button
          onClick={handleNowClick}
          className="flex flex-col items-center justify-center flex-1 h-full min-h-[44px] min-w-[44px] gap-0.5 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-primary focus-visible:outline-none"
          aria-label="Navigate to now page"
        >
          <Sparkles 
            size={24} 
            strokeWidth={isNowActive ? 2.5 : 1.5}
            className={`transition-colors ${
              isNowActive 
                ? 'text-brand-primary' 
                : 'text-text-secondary'
            }`}
          />
          <span 
            className={`text-[10px] font-medium transition-colors ${
              isNowActive 
                ? 'text-brand-primary' 
                : 'text-text-secondary'
            }`}
          >
            Now
          </span>
        </button>

        {/* Profile button */}
        <button
          onClick={() => handleNav('profile', '/profile')}
          className="flex flex-col items-center justify-center flex-1 h-full min-h-[44px] min-w-[44px] gap-0.5 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-primary focus-visible:outline-none"
          aria-label="Navigate to profile page"
        >
          <User 
            size={24} 
            strokeWidth={derivedActiveView === 'profile' ? 2.5 : 1.5}
            className={`transition-colors ${
              derivedActiveView === 'profile' 
                ? 'text-brand-primary' 
                : 'text-text-secondary'
            }`}
          />
          <span 
            className={`text-[10px] font-medium transition-colors ${
              derivedActiveView === 'profile' 
                ? 'text-brand-primary' 
                : 'text-text-secondary'
            }`}
          >
            Profile
          </span>
        </button>
      </div>
    </motion.nav>
  );
}
