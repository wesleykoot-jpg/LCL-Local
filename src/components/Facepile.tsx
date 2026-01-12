import React from 'react';

interface FacepileProps {
  users: Array<{
    id: string;
    image: string;
    alt: string;
  }>;
  extraCount?: number;
  className?: string;
}

export function Facepile({
  users,
  extraCount = 0,
  className = ''
}: FacepileProps) {
  return (
    <div className={`flex items-center -space-x-3 ${className}`}>
      {users.slice(0, 3).map((user, index) => (
        <div 
          key={user.id} 
          className="relative w-9 h-9 rounded-full ring-2 ring-white/90 overflow-hidden shadow-apple-sm" 
          style={{ zIndex: 3 - index }}
        >
          <img 
            src={user.image} 
            alt={user.alt} 
            className="w-full h-full object-cover" 
          />
        </div>
      ))}
      {extraCount > 0 && (
        <div 
          className="relative flex items-center justify-center w-9 h-9 rounded-full ring-2 ring-white/90 bg-zinc-100 text-xs font-bold text-zinc-600 shadow-apple-sm" 
          style={{ zIndex: 0 }}
        >
          +{extraCount}
        </div>
      )}
    </div>
  );
}
