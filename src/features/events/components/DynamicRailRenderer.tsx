import { memo } from "react";
import { Sparkles, Activity, Clock, Users } from "lucide-react";
import type { DiscoverySection } from "../types/discoveryTypes";
import { HorizontalEventCarousel } from "./HorizontalEventCarousel";
import { DiscoveryRail } from "./DiscoveryRail";

interface DynamicRailRendererProps {
  section: DiscoverySection;
  onEventClick: (eventId: string) => void;
  index: number;
}

const RAIL_ICONS: Record<string, any> = {
  generative: Sparkles,
  traditional: Activity,
  utility: Clock,
  social: Users,
};

export const DynamicRailRenderer = memo(function DynamicRailRenderer({
  section,
  onEventClick,
}: DynamicRailRendererProps) {
  const isGenerative = section.type === "generative";
  const Icon = RAIL_ICONS[section.type] || Activity;

  return (
    <DiscoveryRail
      title={
        <div className="flex items-center gap-2">
          {isGenerative && <Icon className="w-5 h-5 text-purple-600" />}
          <span
            className={
              isGenerative
                ? "text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600"
                : ""
            }
          >
            {section.title}
          </span>
        </div>
      }
    >
      {isGenerative && (
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-blue-500/5 -mx-6 skew-y-1 rounded-3xl -z-10 pointer-events-none" />
      )}

      {section.description && (
        <p className="text-sm text-muted-foreground mb-4 px-0">
          {section.description}
        </p>
      )}

      <HorizontalEventCarousel
        title="" // Header handled by DiscoveryRail
        events={section.items.slice(0, 8)}
        onEventClick={onEventClick}
      />
    </DiscoveryRail>
  );
});
