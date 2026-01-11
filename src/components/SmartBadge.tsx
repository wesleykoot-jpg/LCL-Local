import React from 'react';
import { Sparkles, MapPin, Tag } from 'lucide-react';
interface SmartBadgeProps {
  matchPercentage: number;
  distance: string;
  category: string;
  className?: string;
}
export function SmartBadge({
  matchPercentage,
  distance,
  category,
  className = ''
}: SmartBadgeProps) {
  {/* LCL 2.0: Dark glass effect for reliable contrast on any background */}
  return <div className={`inline-flex items-center gap-3 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full shadow-lg border border-white/30 ${className}`}>
      {/* LCL 2.0: Light text colors for dark glass background */}
      <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
        <Sparkles size={14} className="fill-emerald-400" />
        <span className="text-xs tracking-wide">{matchPercentage}% MATCH</span>
      </div>
      <div className="w-px h-3 bg-white/30" />
      <div className="flex items-center gap-1.5 text-white/80">
        <MapPin size={14} />
        <span className="text-xs font-medium">{distance}</span>
      </div>
      <div className="w-px h-3 bg-white/30" />
      <div className="flex items-center gap-1.5 text-white/80">
        <Tag size={14} />
        <span className="text-xs font-medium">{category}</span>
      </div>
    </div>;
}