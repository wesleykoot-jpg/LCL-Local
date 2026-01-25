import { memo, useState } from "react";
import { motion } from "framer-motion";
import { Heart, MapPin, Users } from "lucide-react";
import { hapticImpact } from "@/shared/lib/haptics";
import { formatEventDate } from "@/shared/lib/formatters.ts";
import { useImageFallback } from "../hooks/useImageFallback.ts";
import type { EventWithAttendees } from "../hooks/hooks.ts";

interface ExploreEventCardProps {
  event: EventWithAttendees;
  onClick?: () => void;
}

/**
 * ExploreEventCard - Social Air 6.0 "Liquid Solid" Design.
 * - Solid surfaces (White)
 * - Airbnb Clarity (Simplified labels)
 * - iOS 26 Motion (0.96 scale on tap)
 * - Air Shadows (0 6px 16px rgba(0,0,0,0.08))
 */
export const ExploreEventCard = memo(function ExploreEventCard({
  event,
  onClick,
}: ExploreEventCardProps) {
  const [isSaved, setIsSaved] = useState(false);
  const { src: imageUrl, onError: handleImageError } = useImageFallback(
    event.image_url || "",
    event.category,
  );

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await hapticImpact("light");
    setIsSaved(!isSaved);
  };

  return (
    <motion.div
      className="shrink-0 w-[240px] snap-start cursor-pointer group bg-white rounded-3xl overflow-hidden shadow-[0_6px_16px_rgba(0,0,0,0.08)] border border-[#E5E7EB]"
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
    >
      {/* Image Container */}
      <div className="relative aspect-4/3 w-full overflow-hidden bg-zinc-100">
        <img
          src={imageUrl}
          onError={handleImageError}
          alt={event.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />

        {/* Heart button */}
        <button
          type="button"
          onClick={handleSave}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/95 flex items-center justify-center shadow-md active:scale-90 transition-transform"
        >
          <Heart
            size={16}
            className={
              isSaved ? "text-[#6366F1] fill-[#6366F1]" : "text-[#1A1A1A]"
            }
          />
        </button>

        {/* Date Overlays: Airbnb style bottom left */}
        <div className="absolute bottom-3 left-3 px-2 py-1 rounded-lg bg-white/95 text-[11px] font-bold text-[#1A1A1A] shadow-sm">
          {formatEventDate(event.event_date || "")}
        </div>
      </div>

      {/* Content Area */}
      <div className="p-4 space-y-1.5">
        <h3 className="text-[15px] font-bold text-[#1A1A1A] leading-tight line-clamp-1">
          {event.title}
        </h3>

        <div className="flex items-center gap-1.5 text-[13px] text-[#4B5563] font-medium">
          <MapPin size={12} className="text-[#6366F1]" strokeWidth={2.5} />
          <span className="line-clamp-1">{event.venue_name}</span>
        </div>

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1 text-[12px] text-[#4B5563] font-semibold">
            <Users size={12} />
            <span>{event.attendee_count || 0} attending</span>
          </div>
          {event.match_percentage && event.match_percentage > 70 && (
            <span className="text-[10px] font-bold text-[#6366F1] bg-[#6366F1]/10 px-1.5 py-0.5 rounded-md uppercase">
              {event.match_percentage}% Match
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
});
