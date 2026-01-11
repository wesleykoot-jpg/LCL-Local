import React, { memo, useState } from 'react';
import { CornerDownRight, Users, Loader2 } from 'lucide-react';
import { Facepile } from './Facepile';
interface ForkedCardProps {
  title: string;
  parentEvent: string;
  attendees: Array<{
    id: string;
    image: string;
    alt: string;
  }>;
  extraCount: number;
  className?: string;
  eventId?: string;
  onJoin?: (eventId: string) => Promise<void>;
  isJoining?: boolean;
}
export const ForkedCard = memo(function ForkedCard({
  title,
  parentEvent,
  attendees,
  extraCount,
  className = '',
  eventId,
  onJoin,
  isJoining = false,
}: ForkedCardProps) {
  const [localJoining, setLocalJoining] = useState(false);
  const joining = isJoining || localJoining;

  const handleJoin = async () => {
    if (!eventId || !onJoin || joining) return;
    setLocalJoining(true);
    try {
      await onJoin(eventId);
    } finally {
      setLocalJoining(false);
    }
  };
  {/* LCL 2.0: Enhanced card shadow for better depth hierarchy */}
  return <div className={`relative w-full rounded-2xl bg-white border border-gray-100 shadow-card p-4 flex flex-col gap-3 group transition-all hover:shadow-card-hover ${className}`}>
      {/* Header / Connection */}
      <div className="flex items-center gap-2 text-gray-500 text-xs font-medium">
        <CornerDownRight size={14} className="text-gray-400" />
        <span className="tracking-wide truncate">
          Reply to{' '}
          <span className="font-semibold text-gray-700">{parentEvent}</span>
        </span>
      </div>

      {/* Main Content */}
      <div className="flex justify-between items-center gap-4">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-gray-900 leading-snug line-clamp-2">
            {title}
          </h3>
        </div>
      </div>

      <div className="flex items-center justify-between mt-1">
        <Facepile users={attendees} extraCount={extraCount} className="scale-90 origin-left" borderColor="border-white" />
        {/* LCL 2.0: Touch target now meets 44px minimum requirement */}
        <button 
          onClick={handleJoin}
          disabled={joining || !eventId || !onJoin}
          className="px-5 py-2.5 min-h-[44px] rounded-full bg-gray-50 text-gray-900 text-xs font-bold hover:bg-gray-100 transition-colors flex items-center gap-2 border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {joining ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Users size={14} />
          )}
          <span>{joining ? 'Joining...' : 'Join'}</span>
        </button>
      </div>
    </div>;
});