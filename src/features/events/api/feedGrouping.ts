import type { EventWithAttendees } from './hooks';

export interface EventStack {
  type: 'stack' | 'single';
  anchor: EventWithAttendees;
  forks: EventWithAttendees[];
}

/**
 * Groups a flat array of events into stacks based on parent-child relationships.
 * 
 * Logic:
 * - Events without parent_event_id are "Anchors" (stack starters)
 * - Events with parent_event_id are "Forks" attached to their parent
 * - Orphaned forks (parent not in list) become standalone single events
 */
export function groupEventsIntoStacks(events: EventWithAttendees[]): EventStack[] {
  // Create a map of event IDs to events for quick lookup
  const eventMap = new Map<string, EventWithAttendees>();
  events.forEach(event => eventMap.set(event.id, event));

  // Separate anchors and forks
  const anchors: EventWithAttendees[] = [];
  const forksByParent = new Map<string, EventWithAttendees[]>();
  const orphanedForks: EventWithAttendees[] = [];

  events.forEach(event => {
    if (!event.parent_event_id) {
      // This is an anchor event (no parent)
      anchors.push(event);
    } else {
      // This is a fork event
      const parentExists = eventMap.has(event.parent_event_id);
      
      if (parentExists) {
        // Attach to parent
        const existingForks = forksByParent.get(event.parent_event_id) || [];
        existingForks.push(event);
        forksByParent.set(event.parent_event_id, existingForks);
      } else {
        // Parent not in list - treat as orphan (standalone single)
        orphanedForks.push(event);
      }
    }
  });

  // Build the stacks array
  const stacks: EventStack[] = [];

  // Add anchor stacks with their forks
  anchors.forEach(anchor => {
    const forks = forksByParent.get(anchor.id) || [];
    stacks.push({
      type: forks.length > 0 ? 'stack' : 'single',
      anchor,
      forks: forks.sort((a, b) => {
        // Sort forks by date/time
        const dateA = new Date(`${a.event_date}T${a.event_time}`);
        const dateB = new Date(`${b.event_date}T${b.event_time}`);
        return dateA.getTime() - dateB.getTime();
      }),
    });
  });

  // Add orphaned forks as single events
  orphanedForks.forEach(orphan => {
    stacks.push({
      type: 'single',
      anchor: orphan,
      forks: [],
    });
  });

  // Sort stacks by anchor event date
  stacks.sort((a, b) => {
    const dateA = new Date(`${a.anchor.event_date}T${a.anchor.event_time}`);
    const dateB = new Date(`${b.anchor.event_date}T${b.anchor.event_time}`);
    return dateA.getTime() - dateB.getTime();
  });

  return stacks;
}
