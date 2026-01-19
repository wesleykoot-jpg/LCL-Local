import { motion } from "framer-motion";
import { MapPin, Users, Clock } from "lucide-react";

interface EventCardProps {
  title: string;
  image: string;
  distance: string;
  time: string;
  attendeeCount: number;
  friendAvatars: string[];
}

/**
 * EventCard - LCL Core v5.0 Social Air Design System
 * 
 * A solid-surface event card featuring:
 * - Clean, high-legibility design with solid white background
 * - 20px border radius for soft, friendly corners
 * - High-impact 4:3 aspect ratio imagery
 * - Social proof via facepile overlay
 * - Social Indigo (#6366F1) action button
 * - Air shadow system for depth hierarchy
 * 
 * @see DOCS/DESIGN_SYSTEM_CORE.md for full specification
 */
export const EventCard = ({ 
  title, 
  image, 
  distance, 
  time, 
  attendeeCount, 
  friendAvatars 
}: EventCardProps) => {
  return (
    <motion.div 
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="bg-white rounded-[20px] overflow-hidden shadow-card border border-gray-100 mb-6"
    >
      {/* High-Impact Image Header */}
      <div className="relative aspect-[4/3] w-full bg-gray-200">
        <img 
          src={image} 
          alt={title} 
          className="w-full h-full object-cover" 
        />
        
        {/* Social Proof Overlay (Facepile) */}
        <div className="absolute bottom-3 right-3 flex -space-x-2 bg-white p-1.5 rounded-full shadow-sm">
          {friendAvatars.slice(0, 3).map((src, i) => (
            <img 
              key={i} 
              src={src} 
              alt={`Friend ${i + 1}`}
              className="w-6 h-6 rounded-full border-2 border-white" 
            />
          ))}
          {attendeeCount > 3 && (
            <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold">
              +{attendeeCount - 3}
            </div>
          )}
        </div>
      </div>

      {/* Solid Metadata Area */}
      <div className="p-4 space-y-3">
        <div className="flex justify-between items-start">
          <h3 className="text-xl font-bold text-[#222222] leading-tight tracking-tight">
            {title}
          </h3>
        </div>

        <div className="flex items-center gap-4 text-sm font-medium text-[#717171]">
          <div className="flex items-center gap-1">
            <Clock size={14} className="text-brand-primary" />
            <span>{time}</span>
          </div>
          <div className="flex items-center gap-1">
            <MapPin size={14} />
            <span>{distance}</span>
          </div>
        </div>

        {/* Primary Action Target */}
        <button className="w-full h-[48px] bg-brand-primary text-white font-bold rounded-[12px] shadow-card active:opacity-90 transition-all">
          Join Event
        </button>
      </div>
    </motion.div>
  );
};
