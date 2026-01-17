import { cn } from "@/lib/utils";

/**
 * ReliabilityBadge - A pill-shaped badge showing user reliability status
 * 
 * Part of the v5.0 "Social Air" Design System.
 * Displays a status dot (green/indigo) with percentage in a clean pill container.
 */

interface ReliabilityBadgeProps {
  score: number;
  className?: string;
}

export function ReliabilityBadge({ score, className }: ReliabilityBadgeProps) {
  // Determine status based on score
  const isHighReliability = score >= 80;
  
  return (
    <div 
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-pill bg-gray-100",
        className
      )}
      role="status"
      aria-label={`Reliability score: ${score}%`}
    >
      {/* Status Dot */}
      <span 
        className={cn(
          "w-2 h-2 rounded-full",
          isHighReliability ? "bg-green-500" : "bg-brand-primary"
        )}
        aria-hidden="true"
      />
      
      {/* Percentage */}
      <span className="text-sm font-semibold text-text-primary">
        {score}%
      </span>
    </div>
  );
}
