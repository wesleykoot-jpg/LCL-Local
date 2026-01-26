import { memo } from "react";
import {
  Sparkles,
  Activity,
  Clock,
  MapPin,
  Heart,
  Zap,
  Flame,
} from "lucide-react";
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

const RAIL_ICONS: Record<
  string,
  React.ComponentType<{ className?: string; size?: number }>
> = {
  generative: Sparkles,
  traditional: Activity,
  utility: MapPin,
  social: MapPin, // Changed from Users to MapPin for consistency if needed, but Users was fine too
};

// Map section titles to theme metadata (animation, colors, icon)
const getRailTheme = (
  title: string,
  type: string,
): {
  animation: RailAnimationStyle;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  colors: { icon: string; text: string; bg: string };
} => {
  const titleLower = title.toLowerCase();

  // For You / Made for You
  if (titleLower.includes("for you") || titleLower.includes("made for")) {
    return {
      animation: "glow",
      icon: Heart,
      colors: {
        icon: "text-indigo-500",
        text: "from-indigo-500 to-violet-500",
        bg: "from-indigo-500/15 to-violet-500/15",
      },
    };
  }

  // Rituals / Weekly
  if (
    titleLower.includes("ritual") ||
    titleLower.includes("weekly") ||
    titleLower.includes("regulars")
  ) {
    return {
      animation: "rhythm",
      icon: Clock,
      colors: {
        icon: "text-amber-500",
        text: "from-amber-500 to-orange-500",
        bg: "from-amber-500/15 to-orange-500/15",
      },
    };
  }

  // Weekend
  if (
    titleLower.includes("weekend") ||
    titleLower.includes("saturday") ||
    titleLower.includes("sunday")
  ) {
    return {
      animation: "sparkle",
      icon: Zap,
      colors: {
        icon: "text-pink-500",
        text: "from-pink-500 to-purple-500",
        bg: "from-pink-500/15 to-purple-500/15",
      },
    };
  }

  // Location / Happening
  if (
    titleLower.includes("happening") ||
    titleLower.includes("morning") ||
    titleLower.includes("evening") ||
    titleLower.includes("night") ||
    titleLower.includes("in ") ||
    titleLower.includes("location")
  ) {
    return {
      animation: "pulse",
      icon: MapPin,
      colors: {
        icon: "text-blue-500",
        text: "from-blue-500 to-cyan-500",
        bg: "from-blue-500/15 to-cyan-500/15",
      },
    };
  }

  // Pulse / Collective
  if (titleLower.includes("pulse")) {
    return {
      animation: "wave",
      icon: Flame,
      colors: {
        icon: "text-emerald-500",
        text: "from-emerald-500 to-teal-500",
        bg: "from-emerald-500/15 to-teal-500/15",
      },
    };
  }

  // Generic Generative
  if (type === "generative") {
    return {
      animation: "glow",
      icon: Sparkles,
      colors: {
        icon: "text-purple-500",
        text: "from-purple-500 to-blue-500",
        bg: "from-purple-500/15 to-blue-500/15",
      },
    };
  }

  // Default
  return {
    animation: "glow",
    icon: RAIL_ICONS[type] || Activity,
    colors: {
      icon: "text-gray-600",
      text: "",
      bg: "",
    },
  };
};

export const DynamicRailRenderer = memo(function DynamicRailRenderer({
  section,
  onEventClick,
  onSeeAll,
}: DynamicRailRendererProps) {
  const theme = getRailTheme(section.title, section.type);
  const { animation: animationStyle, icon: Icon, colors: colorScheme } = theme;
  const hasSpecialStyling = colorScheme.text !== "";
  const isEmpty = section.items.length === 0;

  return (
    <RailAnimation style={animationStyle}>
      <DiscoveryRail
        title={
          <div className="flex items-center gap-2">
            {hasSpecialStyling && (
              <RailIconAnimation style={animationStyle}>
                <Icon className={`w-7 h-7 ${colorScheme.icon}`} />
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
        {hasSpecialStyling && <RailBackground style={animationStyle} />}

        {section.description && (
          <p className="text-sm text-muted-foreground mb-4 px-0">
            {section.description}
          </p>
        )}

        {isEmpty ? (
          <div className="px-6 py-8 text-center bg-surface-card/30 rounded-2xl border border-dashed border-border/50">
            <Icon
              className={`w-10 h-10 ${colorScheme.icon} opacity-40 mx-auto mb-3`}
            />
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
