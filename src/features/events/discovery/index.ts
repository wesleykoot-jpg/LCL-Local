/**
 * Discovery Module Exports
 * 
 * Strategy-based Discovery Rails system for the LCL-Local app.
 */

// Types
export type {
  RailType,
  RailAnimationStyle,
  RailContext,
  RailMetadata,
  RailResult,
  RailProvider,
  ContextualWeights,
  ContextualMode,
  RitualDetectionConfig,
  RitualEventMeta,
} from "./types";

export {
  CONTEXTUAL_WEIGHTS,
  DEFAULT_RITUAL_CONFIG,
} from "./types";

// Rail Provider Registry
export {
  railRegistry,
  RailProviderRegistry,
  ForYouRailProvider,
  RitualsRailProvider,
  ThisWeekendRailProvider,
  LocationRailProvider,
  PulseRailProvider,
} from "./RailProviderRegistry";

// Ritual Detection
export {
  hasRitualKeywords,
  getEventDayOfWeek,
  filterRitualEvents,
  detectRitualMeta,
  calculateUserStreak,
  getRitualEventsWithMeta,
} from "./ritualDetection";

// Title Formatter
export {
  formatRailTitle,
  formatStreakText,
  formatRitualDayLabel,
} from "./TitleFormatter";

// Animation Components
export {
  RailAnimation,
  RailIconAnimation,
  RailBackground,
} from "./RailAnimation";

// Ritual Card Components
export {
  RitualBadge,
  StreakBadge,
  RitualStamp,
  RitualCardFooter,
  RitualCardWrapper,
} from "./RitualCard";
