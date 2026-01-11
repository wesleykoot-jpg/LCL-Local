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
      <div className="flex items-center gap-1 p-1.5 bg-black/90 backdrop-blur-xl rounded-full shadow-2xl border border-white/10">
        <button onClick={() => onNavigate('feed')} className={`p-3.5 rounded-full transition-all ${activeView === 'feed' ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white'}`}>
          <Home size={24} strokeWidth={2.5} />
        </button>
        <button onClick={() => onNavigate('map')} className={`p-3.5 rounded-full transition-all ${activeView === 'map' ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white'}`}>
          <Map size={24} strokeWidth={2.5} />
        </button>
        <button onClick={() => onNavigate('profile')} className={`p-3.5 rounded-full transition-all ${activeView === 'profile' ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white'}`}>
          <User size={24} strokeWidth={2.5} />
        </button>
      </div>
    </div>;
}