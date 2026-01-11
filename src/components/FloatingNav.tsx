import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, Map, User } from 'lucide-react';

interface FloatingNavProps {
  activeView?: 'feed' | 'map' | 'profile';
  onNavigate?: (view: 'feed' | 'map' | 'profile') => void;
}

export function FloatingNav({
  activeView: activeViewProp,
  onNavigate
}: FloatingNavProps) {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Determine active view from URL if not provided
  const activeView = activeViewProp || (() => {
    if (location.pathname === '/map') return 'map';
    if (location.pathname === '/profile') return 'profile';
    return 'feed';
  })();

  const handleNav = (view: 'feed' | 'map' | 'profile') => {
    if (onNavigate) {
      onNavigate(view);
    } else {
      navigate(`/${view}`);
    }
  };
  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
      {/* 2026: Premium glass nav with refined blur and subtle shadow */}
      <motion.div 
        className="flex items-center gap-1 p-1.5 bg-zinc-900/90 backdrop-blur-2xl rounded-full shadow-nav border border-white/10"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
      >
        {/* Touch targets 48px minimum for better mobile UX */}
        <motion.button 
          onClick={() => handleNav('feed')} 
          className={`min-w-[48px] min-h-[48px] flex items-center justify-center rounded-full transition-all ${
            activeView === 'feed' 
              ? 'bg-white/20 text-white' 
              : 'text-zinc-400 hover:text-white'
          }`}
          whileTap={{ scale: 0.9 }}
        >
          <Home size={22} strokeWidth={2} />
        </motion.button>
        <motion.button 
          onClick={() => handleNav('map')} 
          className={`min-w-[48px] min-h-[48px] flex items-center justify-center rounded-full transition-all ${
            activeView === 'map' 
              ? 'bg-white/20 text-white' 
              : 'text-zinc-400 hover:text-white'
          }`}
          whileTap={{ scale: 0.9 }}
        >
          <Map size={22} strokeWidth={2} />
        </motion.button>
        <motion.button 
          onClick={() => handleNav('profile')} 
          className={`min-w-[48px] min-h-[48px] flex items-center justify-center rounded-full transition-all ${
            activeView === 'profile' 
              ? 'bg-white/20 text-white' 
              : 'text-zinc-400 hover:text-white'
          }`}
          whileTap={{ scale: 0.9 }}
        >
          <User size={22} strokeWidth={2} />
        </motion.button>
      </motion.div>
    </div>
  );
}
