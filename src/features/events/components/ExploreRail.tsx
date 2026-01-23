import { memo, useRef, ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { hapticImpact } from "@/shared/lib/haptics";

interface ExploreRailProps {
  title: string;
  description?: string;
  onSeeAll?: () => void;
  children: ReactNode;
  icon?: ReactNode;
}

/**
 * ExploreRail - Premium vertical section for the /explore page.
 * Strictly follows Social Air 6.0 "Liquid Solid" Design System.
 */
export const ExploreRail = memo(function ExploreRail({
  title,
  description,
  onSeeAll,
  children,
  icon,
}: ExploreRailProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleSeeAll = async () => {
    await hapticImpact("light");
    onSeeAll?.();
  };

  return (
    <section className="mb-8">
      {/* Rail Header */}
      <div className="flex items-end justify-between px-6 mb-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            {icon && <div className="text-brand-primary">{icon}</div>}
            <h2 className="text-xl font-bold tracking-tight text-[#1A1A1A]">
              {title}
            </h2>
          </div>
          {description && (
            <p className="text-[13px] text-[#4B5563] font-medium leading-tight">
              {description}
            </p>
          )}
        </div>

        {onSeeAll && (
          <button
            onClick={handleSeeAll}
            className="flex items-center gap-0.5 text-[14px] font-semibold text-brand-primary hover:text-brand-secondary transition-colors min-h-[44px] px-2 -mr-2"
          >
            <span>See all</span>
            <ChevronRight size={16} />
          </button>
        )}
      </div>

      {/* Horizontal Scroll Content */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-4 px-6 scrollbar-hide snap-x snap-mandatory"
      >
        {children}
      </div>
    </section>
  );
});
