import React from 'react';

interface User {
  id: string;
  image: string;
  alt: string;
}

interface FacepileProps {
  users: User[];
  extraCount?: number;
}

/**
 * Displays a row of overlapping user avatars
 */
export function Facepile({ users, extraCount = 0 }: FacepileProps) {
  if (users.length === 0) return null;

  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {users.slice(0, 6).map((user, index) => (
          <div
            key={user.id || index}
            className="w-8 h-8 rounded-full border-2 border-background overflow-hidden bg-muted"
            style={{ zIndex: users.length - index }}
          >
            <img
              src={user.image}
              alt={user.alt}
              className="w-full h-full object-cover"
              onError={(e) => {
                // Fallback to initials on error
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        ))}
      </div>
      {extraCount > 0 && (
        <span className="ml-2 text-sm text-muted-foreground">
          +{extraCount} more
        </span>
      )}
    </div>
  );
}
