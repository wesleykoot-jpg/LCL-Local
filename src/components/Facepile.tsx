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
  return <div className={`flex items-center -space-x-3 ${className}`}>
      {users.slice(0, 3).map((user, index) => <div key={user.id} className="relative w-10 h-10 rounded-full border-2 border-white overflow-hidden shadow-sm" style={{
      zIndex: 3 - index
    }}>
          <img src={user.image} alt={user.alt} className="w-full h-full object-cover" />
        </div>)}
      {extraCount > 0 && <div className="relative flex items-center justify-center w-10 h-10 rounded-full border-2 border-white bg-gray-100 text-xs font-bold text-gray-600 shadow-sm" style={{
      zIndex: 0
    }}>
          +{extraCount}
        </div>}
    </div>;
}