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
  return (
    <div className={`inline-flex items-center gap-3 glass-dark border border-white/20 px-4 py-2.5 rounded-2xl shadow-apple-md ${className}`}>
      {/* 2026: Warm gold accent instead of neon */}
      <div className="flex items-center gap-1.5 text-amber-400 font-bold">
        <Sparkles size={14} className="fill-amber-400" />
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
    </div>
  );
}
