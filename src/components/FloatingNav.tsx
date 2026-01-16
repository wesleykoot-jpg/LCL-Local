import { Home, Map, User } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { hapticImpact } from '@/lib/haptics';
import { motion } from 'framer-motion';

type NavView = 'feed' | 'planning' | 'profile';

interface FloatingNavProps {
  activeView?: NavView;
  onNavigate?: (view: NavView) => void;
}

const NAV_ITEMS: { id: NavView; icon: typeof Home; label: string; path: string }[] = [
  { id: 'feed', icon: Home, label: 'Home', path: '/feed' },
  { id: 'planning', icon: Map, label: 'Planning', path: '/planning' },
  { id: 'profile', icon: User, label: 'Profile', path: '/profile' },
];

export function FloatingNav({ activeView, onNavigate }: FloatingNavProps) {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Derive active view from route if not provided
  const currentPath = location.pathname;
  const derivedActiveView = activeView || 
    (currentPath.includes('planning') ? 'planning' : 
     currentPath.includes('profile') ? 'profile' : 'feed');

  const handleNav = async (view: NavView, path: string) => {
    await hapticImpact('light');
    if (onNavigate) {
      onNavigate(view);
    } else {
      navigate(path);
    }
  };

  return (
    <motion.nav 
      className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border pb-safe"
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      style={{
        boxShadow: '0 -1px 0 0 hsl(var(--border))'
      }}
    >
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
      </div>
    </motion.nav>
  );
}
