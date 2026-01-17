import { useMemo } from 'react';
import { ItineraryItem } from '../hooks/useUnifiedItinerary';
import { Calendar, MapPin, ExternalLink, Car, ChevronDown, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { TimelineEventCard } from './TimelineEventCard';
import type { EventWithAttendees } from '../hooks/hooks';
import type { TimeMode } from '@/lib/openingHours';

// Format time like "7:00 PM" - force 12-hour format
function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

// Calculate duration between two times
function calculateDuration(start: Date, end?: Date): string | null {
  if (!end) return null;
  const diffMs = end.getTime() - start.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (diffHours > 0 && diffMinutes > 0) {
    return `${diffHours}h ${diffMinutes}m`;
  } else if (diffHours > 0) {
    return `${diffHours}h`;
  } else if (diffMinutes > 0) {
    return `${diffMinutes}m`;
  }
  return null;
}

// Estimate travel time between events (placeholder - could integrate with Maps API)
function estimateTravelTime(fromItem: ItineraryItem, toItem: ItineraryItem): number | null {
  if (!fromItem.location || !toItem.location) return null;
  // Simple heuristic: 20 minutes between different locations
  if (fromItem.location !== toItem.location) {
    return 20;
  }
  return null;
}

// Type guard to check if originalData is EventWithAttendees
function isEventWithAttendees(data: unknown): data is EventWithAttendees {
  return (
    data !== null &&
    typeof data === 'object' &&
    'id' in data &&
    'title' in data &&
    'category' in data
  );
}

interface SmartStackGroup {
  type: 'single' | 'parent_child';
  parent?: ItineraryItem;
  children: ItineraryItem[];
  items: ItineraryItem[];
  showParent: boolean;
  travelTime?: number | null;
}

/**
 * Groups events by parent-child relationships for Smart Stack rendering
 * - Scenario A: Show both parent + child when user attends parent event
 * - Scenario B: Hide parent venue when it's just a window venue (show child only)
 */
function groupByParentChild(items: ItineraryItem[]): SmartStackGroup[] {
  const groups: SmartStackGroup[] = [];
  const processedIds = new Set<string>();

  // Build a map of parent_event_id -> children
  const childrenByParent = new Map<string, ItineraryItem[]>();
  const itemById = new Map<string, ItineraryItem>();
  
  items.forEach(item => {
    itemById.set(item.id, item);
    if (isEventWithAttendees(item.originalData) && item.originalData.parent_event_id) {
      const parentId = item.originalData.parent_event_id;
      if (!childrenByParent.has(parentId)) {
        childrenByParent.set(parentId, []);
      }
      childrenByParent.get(parentId)!.push(item);
    }
  });

  items.forEach(item => {
    if (processedIds.has(item.id)) return;

    const children = childrenByParent.get(item.id) || [];
    const hasChildren = children.length > 0;
    
    // Check if this item has a parent
    const parentId = isEventWithAttendees(item.originalData) 
      ? item.originalData.parent_event_id 
      : null;
    const hasParent = !!parentId;

    if (hasChildren) {
      // This is a parent with children
      processedIds.add(item.id);
      children.forEach(child => processedIds.add(child.id));

      // Determine if we should show the parent
      // Scenario A: Parent is a 'fixed' event the user attends -> show both
      // Scenario B: Parent is a 'window' venue -> hide parent, show child only
      const parentTimeMode = isEventWithAttendees(item.originalData) 
        ? (item.originalData.time_mode as TimeMode || 'fixed')
        : 'fixed';
      
      const showParent = parentTimeMode === 'fixed';
      
      // Calculate travel time between parent and first child
      const travelTime = showParent && children.length > 0 
        ? estimateTravelTime(item, children[0]) 
        : null;

      groups.push({
        type: 'parent_child',
        parent: item,
        children,
        items: showParent ? [item, ...children] : children,
        showParent,
        travelTime,
      });
    } else if (!hasParent) {
      // Standalone event (not a child of another event in the list)
      processedIds.add(item.id);
      groups.push({
        type: 'single',
        children: [],
        items: [item],
        showParent: false,
      });
    }
    // Note: Items that are children will be processed as part of their parent group
  });

  return groups;
}

interface TravelPillProps {
  minutes: number;
  fromLocation?: string;
  toLocation?: string;
}

const TravelPill = ({ minutes }: TravelPillProps) => (
  <div className="flex items-center justify-center py-2">
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-[12px] font-medium">
      <Car size={14} />
      <span>{minutes}m Travel</span>
    </div>
  </div>
);

interface ParentVenueBadgeProps {
  venueName: string;
  onExpand?: () => void;
}

const ParentVenueBadge = ({ venueName, onExpand }: ParentVenueBadgeProps) => (
  <button 
    onClick={onExpand}
    className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors mb-2"
  >
    <Building2 size={12} />
    <span>At {venueName}</span>
    <ChevronDown size={12} />
  </button>
);

export const ItineraryTimeline = ({ groupedItems }: { groupedItems: Record<string, ItineraryItem[]> }) => {
  const today = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', month: 'short', day: 'numeric' 
  });

  return (
    <div className="w-full pb-32 px-4">
      {Object.entries(groupedItems).map(([dateHeader, items]) => {
        const isToday = dateHeader === today;
        
        // Apply Smart Stack grouping to items
        const smartGroups = useMemo(() => groupByParentChild(items), [items]);
        
        return (
          <div key={dateHeader} className="mb-10 relative">
            {/* Sticky Date Header - Discovery Style */}
            <div className="sticky top-[60px] z-20 py-3 mb-6 backdrop-blur-xl bg-background/90 border-b border-border -mx-4 px-6">
              <h3 className="text-base font-bold text-foreground tracking-tight flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                {dateHeader}
                {isToday && (
                  <span className="ml-2 text-[11px] px-2.5 py-1 bg-primary text-primary-foreground rounded-full font-semibold">
                    Today
                  </span>
                )}
              </h3>
            </div>

            {/* Timeline Items with Smart Stack */}
            <div className="space-y-6">
              {smartGroups.map((group, groupIndex) => {
                const isLastGroup = groupIndex === smartGroups.length - 1;
                
                return (
                  <div key={group.items[0]?.id || `group-${groupIndex}`} className="relative">
                    {/* Parent-Child Group with Activity Thread */}
                    {group.type === 'parent_child' && group.showParent && group.parent && (
                      <div className="relative">
                        {/* Activity Thread Line - Connects parent to children */}
                        <div className="absolute left-[76px] top-0 bottom-0 w-[3px] bg-gradient-to-b from-primary/60 via-primary/30 to-primary/60 rounded-full" />
                      </div>
                    )}
                    
                    {group.items.map((item, itemIndex) => {
                      const startTime = formatTime(item.startTime);
                      const duration = calculateDuration(item.startTime, item.endTime);
                      const isLastItem = isLastGroup && itemIndex === group.items.length - 1;
                      const isChildEvent = isEventWithAttendees(item.originalData) && item.originalData.parent_event_id;
                      const parentVenueName = isChildEvent && group.parent 
                        ? (isEventWithAttendees(group.parent.originalData) ? group.parent.originalData.venue_name : null)
                        : null;
                      
                      // Show travel pill between parent and first child
                      const showTravelPill = group.type === 'parent_child' 
                        && group.showParent 
                        && itemIndex === 1 
                        && group.travelTime;
                      
                      return (
                        <div key={item.id}>
                          {/* Travel Pill between parent and child */}
                          {showTravelPill && (
                            <TravelPill 
                              minutes={group.travelTime!} 
                              fromLocation={group.parent?.location}
                              toLocation={item.location}
                            />
                          )}
                          
                          <div className="relative">
                            {/* 3-Column Grid: Time | Line | Card */}
                            <div className="flex gap-4">
                              {/* Column 1: Time - Compact */}
                              <div className="w-[56px] flex-shrink-0 text-right pt-3">
                                <div className="text-sm font-semibold text-foreground leading-tight">
                                  {startTime}
                                </div>
                                {duration && (
                                  <div className="text-[11px] text-muted-foreground mt-0.5">
                                    {duration}
                                  </div>
                                )}
                              </div>

                              {/* Column 2: Journey Line */}
                              <div className="w-[20px] flex-shrink-0 flex flex-col items-center relative">
                                {/* Waypoint Dot - Enhanced for parent-child */}
                                <div className={cn(
                                  "w-3 h-3 rounded-full border-2 border-background z-10 mt-4 flex-shrink-0",
                                  item.type === 'LCL_EVENT' 
                                    ? isChildEvent
                                      ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" // Child event (fork)
                                      : "bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.5)]" // Parent or standalone
                                    : "bg-muted-foreground/40" // Google Calendar
                                )} />
                                
                                {/* Connecting Line */}
                                {!isLastItem && (
                                  <div className={cn(
                                    "w-[2px] flex-1 mt-2 min-h-[40px]",
                                    group.type === 'parent_child' && group.showParent
                                      ? "bg-primary/30" // Emphasized line for parent-child
                                      : "bg-border"
                                  )} />
                                )}
                              </div>

                              {/* Column 3: Event Card - Full Width */}
                              <div className="flex-1 min-w-0 pb-2">
                                {/* Parent Venue Badge for child events (Scenario B) */}
                                {isChildEvent && !group.showParent && parentVenueName && (
                                  <ParentVenueBadge venueName={parentVenueName} />
                                )}
                                
                                {item.type === 'LCL_EVENT' && isEventWithAttendees(item.originalData) ? (
                                  <motion.div 
                                    className="transform transition-all"
                                    whileTap={{ scale: 0.98 }}
                                  >
                                    <TimelineEventCard
                                      event={item.originalData}
                                      variant="trip-card"
                                      showJoinButton={false}
                                    />
                                  </motion.div>
                                ) : item.type === 'LCL_EVENT' ? (
                                  <div className="text-muted-foreground text-sm p-4 rounded-xl bg-muted/50">
                                    Event data unavailable
                                  </div>
                                ) : (
                                  /* Google Calendar Ghost Card */
                                  <motion.div 
                                    className="relative rounded-2xl border-2 border-dashed border-sky-300/60 p-4 transition-all hover:border-sky-400/80 hover:shadow-md overflow-hidden"
                                    whileTap={{ scale: 0.98 }}
                                    style={{
                                      backgroundColor: 'hsl(204, 100%, 97%)',
                                      backgroundImage: `repeating-linear-gradient(
                                        135deg,
                                        transparent,
                                        transparent 8px,
                                        hsl(204, 100%, 92%) 8px,
                                        hsl(204, 100%, 92%) 9px
                                      )`
                                    }}
                                  >
                                    {/* Google Calendar Badge */}
                                    <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-white/80 flex items-center gap-1.5 shadow-sm">
                                      <Calendar size={12} className="text-[#4285F4]" />
                                      <span className="text-[10px] font-semibold text-[#4285F4] uppercase tracking-wide">
                                        Calendar
                                      </span>
                                    </div>

                                    {/* Title */}
                                    <h4 className="text-base font-semibold text-sky-900 leading-snug line-clamp-2 mb-2 pr-20">
                                      {item.title}
                                    </h4>

                                    {/* Location + Time */}
                                    <div className="flex items-center gap-3 text-[13px] text-sky-700/80">
                                      {item.location && (
                                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                          <MapPin size={13} className="flex-shrink-0 text-sky-500" />
                                          <span className="truncate">{item.location}</span>
                                        </div>
                                      )}
                                      {item.endTime && (
                                        <span className="flex-shrink-0 text-sky-600/60">
                                          ends {formatTime(item.endTime)}
                                        </span>
                                      )}
                                    </div>

                                    {/* External Link */}
                                    {(item.originalData as { htmlLink?: string })?.htmlLink && (
                                      <a
                                        href={(item.originalData as { htmlLink?: string })?.htmlLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 mt-3 text-[12px] font-medium text-[#4285F4] hover:underline"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <ExternalLink size={12} />
                                        Open in Google Calendar
                                      </a>
                                    )}
                                  </motion.div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
