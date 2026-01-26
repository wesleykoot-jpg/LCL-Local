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
        icon: "text-indigo-600",
        text: "from-indigo-600 to-violet-600",
        bg: "from-indigo-500/5 to-violet-500/5",
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
        icon: "text-amber-600",
        text: "from-amber-600 to-orange-600",
        bg: "from-amber-500/5 to-orange-500/5",
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
        icon: "text-pink-600",
        text: "from-pink-600 to-purple-600",
        bg: "from-pink-500/5 to-purple-500/5",
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
        icon: "text-blue-600",
        text: "from-blue-600 to-cyan-600",
        bg: "from-blue-500/5 to-cyan-500/5",
      },
    };
  }

  // Pulse / Collective
  if (titleLower.includes("pulse")) {
    return {
      animation: "wave",
      icon: Flame,
      colors: {
        icon: "text-emerald-600",
        text: "from-emerald-600 to-teal-600",
        bg: "from-emerald-500/5 to-teal-500/5",
      },
    };
  }

  // Generic Generative
  if (type === "generative") {
    return {
      animation: "glow",
      icon: Sparkles,
      colors: {
        icon: "text-purple-600",
        text: "from-purple-600 to-blue-600",
        bg: "from-purple-500/5 to-blue-500/5",
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
