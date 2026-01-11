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
  return <div className={`inline-flex items-center gap-3 bg-white/90 backdrop-blur-md px-4 py-2 rounded-full shadow-sm border border-white/20 ${className}`}>
      <div className="flex items-center gap-1.5 text-emerald-700 font-bold">
        <Sparkles size={14} className="fill-emerald-700" />
        <span className="text-xs tracking-wide">{matchPercentage}% MATCH</span>
      </div>
      <div className="w-px h-3 bg-gray-300" />
      <div className="flex items-center gap-1.5 text-gray-600">
        <MapPin size={14} />
        <span className="text-xs font-medium">{distance}</span>
      </div>
      <div className="w-px h-3 bg-gray-300" />
      <div className="flex items-center gap-1.5 text-gray-600">
        <Tag size={14} />
        <span className="text-xs font-medium">{category}</span>
      </div>
    </div>;
}