import React, { memo } from 'react';
import { SlideToCommit } from './SlideToCommit';
import { Film } from 'lucide-react';
interface AnchorCardProps {
  title: string;
  image: string;
  matchPercentage: number;
  distance: string;
  category: string;
  date: string;
  eventId: string;
  onCommit?: (eventId: string) => void;
  children?: React.ReactNode;
}
export const AnchorCard = memo(function AnchorCard({
  title,
  image,
  matchPercentage,
  distance,
  category,
  date,
  eventId,
  onCommit,
  children
}: AnchorCardProps) {
  return <div className="w-full">
      {/* Main Card */}
      <div className="relative w-full min-h-[520px] rounded-[2.5rem] overflow-hidden group shadow-2xl transition-transform hover:scale-[1.005] duration-500 bg-black">
        {/* Background Image (Poster Art) */}
        <div className="absolute inset-0 rounded-[2.5rem] overflow-hidden">
          <img src={image} alt={title} className="w-full h-full object-cover opacity-90" />
          {/* Cinematic Gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
        </div>

        {/* Content Container */}
        <div className="absolute inset-0 p-6 md:p-8 flex flex-col justify-between z-10">
          {/* Top: Smart Badge */}
          <div className="flex justify-start">
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-4 py-1.5 flex items-center gap-2 text-white text-xs font-medium shadow-lg">
              <Film size={14} className="text-blue-400" />
              <span>{category} • {matchPercentage}% Match</span>
            </div>
          </div>

          {/* Bottom: Title & Action */}
          <div className="space-y-6 pb-4 max-w-full">
            <div className="space-y-2">
              <p className="text-blue-300 font-medium tracking-wide uppercase text-xs md:text-sm drop-shadow-sm flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
                {date} • {distance}
              </p>
              <h2 className="text-4xl md:text-5xl font-bold text-white leading-[1.05] tracking-tight drop-shadow-xl line-clamp-3">
                {title}
              </h2>
            </div>

            <div className="max-w-sm pt-2">
              <SlideToCommit
                label="SLIDE TO BOOK"
                onCommit={() => onCommit?.(eventId)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Threaded Children (Forked Events) */}
      {children && <div className="flex mt-2 pl-4">
          {/* Thread Line Container */}
          <div className="w-10 flex-shrink-0 flex justify-center relative">
            {/* Vertical Line from parent */}
            <div className="absolute top-0 bottom-1/2 left-1/2 w-0.5 bg-gray-200 -translate-x-1/2"></div>
            {/* Curve to child */}
            <div className="absolute top-0 h-1/2 left-1/2 w-6 border-b-2 border-l-2 border-gray-200 rounded-bl-2xl -translate-x-1/2"></div>
          </div>

          {/* Child Content */}
          <div className="flex-1 pt-4 pb-2">{children}</div>
        </div>}
    </div>;
});