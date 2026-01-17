import { useMemo } from 'react';
import { ItineraryItem } from '../hooks/useUnifiedItinerary';
import { Calendar, MapPin, ExternalLink, Car, ChevronDown, Building2, AlertTriangle } from 'lucide-react';
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

/**
 * Estimate travel time between events
 * 
 * NOTE: This is a placeholder heuristic. In production, this should:
 * - Use Google Maps/Mapbox Distance Matrix API for accurate estimates
 * - Consider transport mode (walking, driving, transit)
 * - Cache results to reduce API calls
 * 
 * Current implementation: Returns 20 minutes for any different locations
 */
function estimateTravelTime(fromItem: ItineraryItem, toItem: ItineraryItem): number | null {
  if (!fromItem.location || !toItem.location) return null;
  
  // Placeholder: 20 minutes between different locations
  // TODO: Integrate with Maps API for accurate travel time estimation
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

interface ConflictBadgeProps {
  message: string;
}

const ConflictBadge = ({ message }: ConflictBadgeProps) => (
  <div className="flex items-center gap-2 p-2 mb-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
    <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
    <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300">
      {message}
    </span>
  </div>
);



export const ItineraryTimeline = ({ groupedItems }: { groupedItems: Record<string, ItineraryItem[]> }) => {
  const today = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', month: 'short', day: 'numeric' 
  });

  // Defensive UI filter: exclude 'Jazz & Wine Tasting' events
  // Filter out items where the title matches the pattern
  const filteredGroupedItems = useMemo(() => {
    const filtered: Record<string, ItineraryItem[]> = {};
    
    Object.entries(groupedItems).forEach(([dateHeader, items]) => {
      const filteredItems = items.filter(item => {
        // Skip items that match 'Jazz & Wine Tasting' pattern
        return !/jazz\s*&\s*wine\s*tasting/i.test(item.title || '');
      });
      
      // Only include date groups that have remaining items
      if (filteredItems.length > 0) {
        filtered[dateHeader] = filteredItems;
      }
    });
    
    return filtered;
  }, [groupedItems]);

  return (
    <div className="w-full pb-32 px-4">
      {Object.entries(filteredGroupedItems).map(([dateHeader, items]) => {
        const isToday = dateHeader === today;
        
        // Apply Smart Stack grouping to items - moved outside map callback
        const smartGroups = groupByParentChild(items);
        
        return (
          <div key={dateHeader} className="mb-10 relative">
            {/* Sticky Date Header - Solid Surface (LCL Core 2026) */}
            <div className="sticky top-[60px] z-20 py-4 mb-6 bg-surface-primary shadow-apple-sm border-b border-border -mx-4 px-6">
              <h3 className="text-base font-bold text-text-primary tracking-tight flex items-center gap-2">
                <Calendar className="w-4 h-4 text-brand-primary" />
                {dateHeader}
                {isToday && (
                  <span className="ml-2 text-[11px] px-2.5 py-1 bg-brand-primary text-white rounded-full font-semibold shadow-apple-sm">
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
                        {/* Activity Thread Line - Connects parent to children - LCL Core 2026 */}
                        <div className="absolute left-[76px] top-0 bottom-0 w-[3px] bg-gradient-to-b from-brand-primary/70 via-brand-primary/50 to-brand-primary/70 rounded-full" />
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
                                <div className="text-sm font-semibold text-text-primary leading-tight">
                                  {startTime}
                                </div>
                                {duration && (
                                  <div className="text-[11px] text-text-secondary mt-0.5">
                                    {duration}
                                  </div>
                                )}
                              </div>

                              {/* Column 2: Journey Line */}
                              <div className="w-[20px] flex-shrink-0 flex flex-col items-center relative">
                                {/* Waypoint Dot - Enhanced for parent-child */}
                                <div className={cn(
                                  "w-3 h-3 rounded-full border-2 border-background ring-1 ring-border z-10 mt-4 flex-shrink-0",
                                  item.type === 'LCL_EVENT' 
                                    ? isChildEvent
                                      ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" // Child event (fork)
                                      : "bg-brand-primary shadow-[0_0_8px_rgba(99,102,241,0.5)]" // Parent or standalone - Social Indigo
                                    : "bg-muted-foreground/40" // Google Calendar
                                )} />
                                
                                {/* Connecting Line */}
                                {!isLastItem && (
                                  <div className={cn(
                                    "w-[3px] flex-1 mt-2 min-h-[40px] rounded-full",
                                    group.type === 'parent_child' && group.showParent
                                      ? "bg-brand-primary/50" // Emphasized line for parent-child - Social Air v5.0
                                      : "bg-muted-foreground/20"
                                  )} />
                                )}
                              </div>

                              {/* Column 3: Event Card - Full Width */}
                              <div className="flex-1 min-w-0 pb-2">
                                {/* Double Booked Badge */}
                                {item.conflictType === 'overlap' && (
                                  <div className="flex items-center gap-1.5 mb-2 text-xs text-destructive">
                                    <span>⚠️</span>
                                    <span className="font-medium">Double Booked</span>
                                  </div>
                                )}
                                
                                {/* Parent Venue Badge for child events (Scenario B) */}
                                {isChildEvent && !group.showParent && parentVenueName && (
                                  <ParentVenueBadge venueName={parentVenueName} />
                                )}
                                
                                {item.type === 'LCL_EVENT' && isEventWithAttendees(item.originalData) ? (
                                  <motion.div 
                                    className={cn(
                                      "transform transition-all",
                                      item.conflictType === 'overlap' && "border-l-4 border-l-destructive"
                                    )}
                                    whileTap={{ scale: 0.98 }}
                                  >
                                    <TimelineEventCard
                                      event={item.originalData}
                                      variant="trip-card"
                                      showJoinButton={false}
                                    />
                                  </motion.div>
                                ) : item.type === 'LCL_EVENT' ? (
                                  <div className={cn(
                                    "text-muted-foreground text-sm p-4 rounded-xl bg-muted/50",
                                    item.conflictType === 'overlap' && "border-l-4 border-l-destructive"
                                  )}>
                                    Event data unavailable
                                  </div>
                                ) : (
                                  /* Google Calendar Ghost Card */
                                  <motion.div 
                                    className={cn(
                                      "relative rounded-2xl border-2 border-dashed border-sky-500/40 p-4 transition-all hover:border-sky-500/60 hover:shadow-md overflow-hidden",
                                      item.conflictType === 'overlap' && "border-l-4 border-l-destructive"
                                    )}
                                    whileTap={{ scale: 0.98 }}
                                    style={{
                                      backgroundColor: 'hsl(204, 100%, 94%)',
                                      backgroundImage: `repeating-linear-gradient(
                                        135deg,
                                        transparent,
                                        transparent 10px,
                                        hsl(204, 100%, 90%) 10px,
                                        hsl(204, 100%, 90%) 11px
                                      )`
                                    }}
                                  >
                                    {/* Google Calendar Badge */}
                                    <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-white flex items-center gap-1.5 shadow-sm border border-sky-200">
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
                                    <div className="flex items-center gap-3 text-[13px] text-sky-900">
                                      {item.location && (
                                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                          <MapPin size={13} className="flex-shrink-0 text-sky-600" />
                                          <span className="truncate">{item.location}</span>
                                        </div>
                                      )}
                                      {item.endTime && (
                                        <span className="flex-shrink-0 text-sky-800">
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
