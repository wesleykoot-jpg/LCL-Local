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
    <nav 
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 pb-safe shadow-bottom-nav"
    >
      <div className="flex items-center justify-around h-[56px] max-w-lg mx-auto px-2">
        {/* Planning button */}
        <button
          onClick={() => handleNav('planning', '/planning')}
          className="flex flex-col items-center justify-center flex-1 h-full min-h-[44px] min-w-[44px] gap-0.5 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary focus-visible:outline-none"
          aria-label="Navigate to planning page"
        >
          <motion.div
            animate={{ 
              scale: derivedActiveView === 'planning' ? 1.1 : 1,
            }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
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
          className="flex flex-col items-center justify-center flex-1 h-full min-h-[44px] min-w-[44px] gap-0.5 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary focus-visible:outline-none"
          aria-label="Navigate to discover page"
        >
          <motion.div
            animate={{ 
              scale: derivedActiveView === 'feed' ? 1.1 : 1,
            }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
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
          className="flex flex-col items-center justify-center flex-1 h-full min-h-[44px] min-w-[44px] gap-0.5 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary focus-visible:outline-none"
          aria-label="Navigate to now page"
        >
          <motion.div
            animate={{ 
              scale: isNowActive ? 1.1 : 1,
            }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
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
          className="flex flex-col items-center justify-center flex-1 h-full min-h-[44px] min-w-[44px] gap-0.5 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary focus-visible:outline-none"
          aria-label="Navigate to profile page"
        >
          <motion.div
            animate={{ 
              scale: derivedActiveView === 'profile' ? 1.1 : 1,
            }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
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
    </nav>
  );
}
