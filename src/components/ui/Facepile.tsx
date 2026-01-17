import { cn } from "@/lib/utils";

/**
 * Facepile - A stack of avatar circles showing multiple users
 * 
 * Part of the v5.0 "Social Air" Design System.
 * Shows overlapping avatars with a "+N" overflow indicator.
 */

export interface FacepileUser {
  id: string;
  name: string;
  avatarUrl?: string;
}

interface FacepileProps {
  users: FacepileUser[];
  maxVisible?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'w-6 h-6 text-xs',
  md: 'w-8 h-8 text-sm',
  lg: 'w-10 h-10 text-base',
};

const overlapClasses = {
  sm: '-ml-2',
  md: '-ml-2.5',
  lg: '-ml-3',
};

export function Facepile({ 
  users, 
  maxVisible = 3, 
  size = 'sm',
  className 
}: FacepileProps) {
  const visibleUsers = users.slice(0, maxVisible);
  const overflowCount = users.length - maxVisible;

  if (users.length === 0) {
    return null;
  }

  return (
    <div 
      className={cn("flex items-center", className)}
      role="group"
      aria-label={`${users.length} attendee${users.length !== 1 ? 's' : ''}`}
    >
      {visibleUsers.map((user, index) => (
        <div
          key={user.id}
          className={cn(
            "rounded-full border-2 border-white flex items-center justify-center bg-gray-200 overflow-hidden",
            sizeClasses[size],
            index > 0 && overlapClasses[size]
          )}
          title={user.name}
        >
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="font-medium text-text-secondary">
              {user.name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
      ))}
      
      {overflowCount > 0 && (
        <div
          className={cn(
            "rounded-full border-2 border-white bg-gray-100 flex items-center justify-center font-medium text-text-secondary",
            sizeClasses[size],
            overlapClasses[size]
          )}
        >
          +{overflowCount}
        </div>
      )}
    </div>
  );
}
