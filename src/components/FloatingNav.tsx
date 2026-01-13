import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, CalendarCheck, User } from 'lucide-react';
import { hapticImpact } from '@/lib/haptics';

type NavView = 'feed' | 'my-events' | 'profile';

interface FloatingNavProps {
  activeView?: NavView;
  onNavigate?: (view: NavView) => void;
}

const NAV_ITEMS: { id: NavView; icon: typeof Home; label: string }[] = [
  { id: 'feed', icon: Home, label: 'Ontdek' },
  { id: 'my-events', icon: CalendarCheck, label: 'Mijn' },
  { id: 'profile', icon: User, label: 'Profiel' },
];

export function FloatingNav({
  activeView: activeViewProp,
  onNavigate
}: FloatingNavProps) {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Determine active view from URL if not provided
  const activeView: NavView = activeViewProp || (() => {
    if (location.pathname === '/my-events') return 'my-events';
    if (location.pathname === '/profile') return 'profile';
    return 'feed';
  })();

  const handleNav = async (view: NavView) => {
    await hapticImpact('light');
    if (onNavigate) {
      onNavigate(view);
    } else {
      navigate(`/${view}`);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 pb-safe">
      {/* Airbnb-style clean tab bar */}
      <div className="mx-4 mb-2">
        <motion.nav 
          className="flex items-center justify-around px-6 py-2 bg-background/95 backdrop-blur-2xl rounded-[2rem] border-[0.5px] border-border/30"
          style={{
            boxShadow: '0 8px 32px -8px rgba(0, 0, 0, 0.12), 0 0 0 0.5px rgba(0, 0, 0, 0.04)'
          }}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeView === item.id;
            const Icon = item.icon;
            
            return (
              <motion.button
                key={item.id}
                onClick={() => handleNav(item.id)}
                className={`relative flex flex-col items-center justify-center min-w-[64px] min-h-[52px] py-2 px-4 rounded-[1.25rem] transition-all active:scale-[0.92] ${
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                whileTap={{ scale: 0.92 }}
              >
                {/* Active indicator - increased opacity */}
                {isActive && (
                  <motion.div
                    layoutId="activeNavIndicator"
                    className="absolute inset-0 bg-primary/10 rounded-[1.25rem]"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                  />
                )}
                
                <Icon 
                  size={24} 
                  strokeWidth={isActive ? 2.5 : 2} 
                  className="relative z-10 transition-transform duration-200"
                />
                <span className={`relative z-10 text-[11px] mt-0.5 font-medium tracking-tight ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}>
                  {item.label}
                </span>
              </motion.button>
            );
          })}
        </motion.nav>
      </div>
    </div>
  );
}