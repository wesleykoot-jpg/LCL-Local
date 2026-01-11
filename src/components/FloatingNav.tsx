import React from 'react';
import { Home, Map, User } from 'lucide-react';
interface FloatingNavProps {
  activeView: 'feed' | 'map' | 'profile';
  onNavigate: (view: 'feed' | 'map' | 'profile') => void;
}
export function FloatingNav({
  activeView,
  onNavigate
}: FloatingNavProps) {
  return <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
      {/* LCL 2.0: Enhanced glass effect with deeper blur and prominent shadow */}
      <div className="flex items-center gap-1 p-1.5 bg-black/90 backdrop-blur-2xl rounded-full shadow-nav border border-white/15">
        {/* LCL 2.0: Touch targets now 48px minimum for better mobile UX */}
        <button onClick={() => onNavigate('feed')} className={`min-w-[48px] min-h-[48px] flex items-center justify-center rounded-full transition-all ${activeView === 'feed' ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white'}`}>
          <Home size={24} strokeWidth={2.5} />
        </button>
        <button onClick={() => onNavigate('map')} className={`min-w-[48px] min-h-[48px] flex items-center justify-center rounded-full transition-all ${activeView === 'map' ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white'}`}>
          <Map size={24} strokeWidth={2.5} />
        </button>
        <button onClick={() => onNavigate('profile')} className={`min-w-[48px] min-h-[48px] flex items-center justify-center rounded-full transition-all ${activeView === 'profile' ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white'}`}>
          <User size={24} strokeWidth={2.5} />
        </button>
      </div>
    </div>;
}