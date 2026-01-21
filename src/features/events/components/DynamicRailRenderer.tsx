import { memo } from 'react';
import { Sparkles, Activity, Clock, Users } from 'lucide-react';
import type { DiscoverySection } from '../types/discoveryTypes';
import { HorizontalEventCarousel } from './HorizontalEventCarousel';

interface DynamicRailRendererProps {
  section: DiscoverySection;
  onEventClick: (eventId: string) => void;
  index: number;
}

const RAIL_ICONS: Record<string, any> = {
  'generative': Sparkles,
  'traditional': Activity,
  'utility': Clock,
  'social': Users,
};

export const DynamicRailRenderer = memo(function DynamicRailRenderer({
  section,
  onEventClick,
  index
}: DynamicRailRendererProps) {
  // Determine icon if not explicitly provided
  // const Icon = RAIL_ICONS[section.type] || Activity; // Icon used in header below if needed (currently using hardcoded Sparkles for generative)
  
  // Custom styling based on rail type
  const isGenerative = section.type === 'generative';

  return (
    <div className={`mb-8 ${isGenerative ? 'relative' : ''}`}>
      {/* Decorative background for generative rails */}
      {isGenerative && (
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-blue-500/5 -mx-4 skew-y-1 rounded-3xl -z-10" />
      )}

      <div className="flex items-center gap-2 px-4 mb-3">
        {isGenerative && (
          <Sparkles className="w-4 h-4 text-purple-600" />
        )}
        <div>
          <h2 className={`text-lg font-bold leading-none ${isGenerative ? 'text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600' : ''}`}>
            {section.title}
          </h2>
          {section.description && (
            <p className="text-sm text-muted-foreground mt-1">
              {section.description}
            </p>
          )}
        </div>
      </div>

      <HorizontalEventCarousel
        title="" // Header handled above by DynamicRailRenderer
        events={section.items}
        onEventClick={onEventClick}
        onSeeAll={() => {}} // No-op for now as we don't have a see-all view for dynamic rails yet
      />
    </div>
  );
});
