import { memo } from "react";
import { Sparkles, Activity, Clock, Users, MapPin, Heart, Zap, Flame } from "lucide-react";
import type { DiscoverySection } from "../types/discoveryTypes";
import { HorizontalEventCarousel } from "./HorizontalEventCarousel";
import { DiscoveryRail } from "./DiscoveryRail";
import { 
  RailAnimation, 
  RailIconAnimation, 
  RailBackground,
  type RailAnimationStyle,
} from "../discovery/index";

interface DynamicRailRendererProps {
  section: DiscoverySection;
  onEventClick: (eventId: string) => void;
  onSeeAll?: () => void;
  index: number;
}

// Map section titles to rail animation styles
const getTitleAnimationStyle = (title: string): RailAnimationStyle => {
  const titleLower = title.toLowerCase();
  
  // For You / Made for You
  if (titleLower.includes("for you") || titleLower.includes("made for")) {
    return "glow";
  }
  // Rituals
  if (titleLower.includes("ritual") || titleLower.includes("weekly") || titleLower.includes("regulars")) {
    return "rhythm";
  }
  // Weekend
  if (titleLower.includes("weekend") || titleLower.includes("saturday") || titleLower.includes("sunday")) {
    return "sparkle";
  }
  // Location / Happening / Morning / Evening
  if (titleLower.includes("happening") || titleLower.includes("morning") || 
      titleLower.includes("evening") || titleLower.includes("night") ||
      titleLower.includes("in ")) {
    return "pulse";
  }
  // Pulse / Collective
  if (titleLower.includes("pulse")) {
    return "wave";
  }
  
  // Default based on section type
  return "glow";
};

const RAIL_ICONS: Record<string, React.ComponentType<{ className?: string; size?: number }>> = {
  generative: Sparkles,
  traditional: Activity,
  utility: MapPin,
  social: Users,
};

// Special icons for specific rail types
const getIconForTitle = (title: string, type: string): React.ComponentType<{ className?: string; size?: number }> => {
  const titleLower = title.toLowerCase();
  
  if (titleLower.includes("for you") || titleLower.includes("made for")) {
    return Heart;
  }
  if (titleLower.includes("ritual") || titleLower.includes("weekly")) {
    return Clock;
  }
  if (titleLower.includes("weekend")) {
    return Zap;
  }
  if (titleLower.includes("pulse")) {
    return Flame;
  }
  if (titleLower.includes("happening") || titleLower.includes("morning") || 
      titleLower.includes("evening") || titleLower.includes("location")) {
    return MapPin;
  }
  
  return RAIL_ICONS[type] || Activity;
};

// Get color scheme for rail type
const getRailColorScheme = (title: string, type: string): { icon: string; text: string; bg: string } => {
  const titleLower = title.toLowerCase();
  
  if (titleLower.includes("for you") || titleLower.includes("made for")) {
    return { 
      icon: "text-indigo-600", 
      text: "from-indigo-600 to-violet-600",
      bg: "from-indigo-500/5 to-violet-500/5",
    };
  }
  if (titleLower.includes("ritual") || titleLower.includes("weekly")) {
    return { 
      icon: "text-amber-600", 
      text: "from-amber-600 to-orange-600",
      bg: "from-amber-500/5 to-orange-500/5",
    };
  }
  if (titleLower.includes("weekend")) {
    return { 
      icon: "text-pink-600", 
      text: "from-pink-600 to-purple-600",
      bg: "from-pink-500/5 to-purple-500/5",
    };
  }
  if (titleLower.includes("pulse")) {
    return { 
      icon: "text-emerald-600", 
      text: "from-emerald-600 to-teal-600",
      bg: "from-emerald-500/5 to-teal-500/5",
    };
  }
  if (titleLower.includes("happening") || titleLower.includes("location")) {
    return { 
      icon: "text-blue-600", 
      text: "from-blue-600 to-cyan-600",
      bg: "from-blue-500/5 to-cyan-500/5",
    };
  }
  if (type === "generative") {
    return { 
      icon: "text-purple-600", 
      text: "from-purple-600 to-blue-600",
      bg: "from-purple-500/5 to-blue-500/5",
    };
  }
  
  return { 
    icon: "text-gray-600", 
    text: "",
    bg: "",
  };
};

export const DynamicRailRenderer = memo(function DynamicRailRenderer({
  section,
  onEventClick,
  onSeeAll,
}: DynamicRailRendererProps) {
  const animationStyle = getTitleAnimationStyle(section.title);
  const Icon = getIconForTitle(section.title, section.type);
  const colorScheme = getRailColorScheme(section.title, section.type);
  const hasSpecialStyling = colorScheme.text !== "";
  const isEmpty = section.items.length === 0;

  return (
    <RailAnimation style={animationStyle}>
      <DiscoveryRail
        title={
          <div className="flex items-center gap-2">
            {hasSpecialStyling && (
              <RailIconAnimation style={animationStyle}>
                <Icon className={`w-5 h-5 ${colorScheme.icon}`} />
              </RailIconAnimation>
            )}
            <span
              className={
                hasSpecialStyling
                  ? `text-transparent bg-clip-text bg-gradient-to-r ${colorScheme.text}`
                  : ""
              }
            >
              {section.title}
            </span>
          </div>
        }
        onSeeAll={isEmpty ? undefined : onSeeAll}
      >
        {hasSpecialStyling && (
          <RailBackground style={animationStyle} />
        )}

        {section.description && (
          <p className="text-sm text-muted-foreground mb-4 px-0">
            {section.description}
          </p>
        )}

        {isEmpty ? (
          <div className="px-6 py-8 text-center bg-surface-card/30 rounded-2xl border border-dashed border-border/50">
            <Icon className={`w-10 h-10 ${colorScheme.icon} opacity-40 mx-auto mb-3`} />
            <p className="text-sm text-muted-foreground">
              No events available for this category right now
            </p>
          </div>
        ) : (
          <HorizontalEventCarousel
            title="" // Header handled by DiscoveryRail
            events={section.items.slice(0, 8)}
            onEventClick={onEventClick}
            onSeeAll={onSeeAll}
          />
        )}
      </DiscoveryRail>
    </RailAnimation>
  );
});
