import type { Meta, StoryObj } from '@storybook/react';
import { EventTimeline } from './EventTimeline';
import {
  mixedEvents,
  calendarOnlyEvents,
  discoveryOnlyEvents,
  timelineGroupedEvents,
  calendarEvent,
  discoveryEventWithImage,
  discoveryEventNoImage,
  gamingEvent,
  pastEvent,
  eventLongDescription,
  eventsWithImages,
  eventsWithoutImages,
} from '@/storybook/mocks/events';

/**
 * EventTimeline displays events in a vertical timeline format with date grouping.
 * 
 * ## Key Features
 * - **Vertical Timeline**: Centered line with time nodes
 * - **Date Grouping**: Events grouped by day with sticky date headers
 * - **iOS Styling**: Glassmorphism date pills, squircle cards
 * - **Mixed Event Types**: Calendar (flat) and Discovery (glass) events
 * 
 * ## Mobile-First Design
 * Optimized for iOS (375px, 430px):
 * - Vertical line stays centered
 * - Date headers use glass pill overlay
 * - Time nodes glow for upcoming events
 * - Continuous line through date headers
 * 
 * ## Accessibility
 * - Focus rings on interactive elements
 * - Aria-labels for screen readers
 * - Sufficient contrast (even on glass/media)
 * - Respects prefers-reduced-motion
 */
const meta = {
  title: 'Events/EventTimeline',
  component: EventTimeline,
  parameters: {
    layout: 'fullscreen',
    viewport: {
      defaultViewport: 'iphone12',
    },
  },
  tags: ['autodocs'],
  argTypes: {
    showJoinButton: {
      control: 'boolean',
      description: 'Show join buttons on event cards',
    },
  },
} satisfies Meta<typeof EventTimeline>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Mixed Events - Calendar + Discovery
 * Shows both event types with appropriate styling
 */
export const MixedEvents: Story = {
  args: {
    events: mixedEvents,
    showJoinButton: false,
  },
};

/**
 * Calendar-Only Timeline
 * All events are calendar imports (flat/solid styling)
 */
export const CalendarOnly: Story = {
  args: {
    events: calendarOnlyEvents,
    showJoinButton: false,
  },
};

/**
 * Discovery-Only Timeline
 * All events are native/scraped (glassmorphism styling)
 */
export const DiscoveryOnly: Story = {
  args: {
    events: discoveryOnlyEvents,
    showJoinButton: false,
  },
};

/**
 * Discovery with Images - Glass effects showcase
 * Emphasizes glassmorphism with media blocks
 */
export const DiscoveryWithImages: Story = {
  args: {
    events: eventsWithImages,
    showJoinButton: false,
  },
};

/**
 * Discovery without Images - Gradient fallbacks
 * Shows glass styling with gradient backgrounds
 */
export const DiscoveryNoImages: Story = {
  args: {
    events: eventsWithoutImages,
    showJoinButton: false,
  },
};

/**
 * Grouped Dates Timeline
 * Multiple events per day, date headers group them
 */
export const GroupedDates: Story = {
  args: {
    events: timelineGroupedEvents,
    showJoinButton: false,
  },
};

/**
 * Single Event - Today
 * Timeline with one event happening today
 */
export const SingleEventToday: Story = {
  args: {
    events: [
      {
        ...calendarEvent,
        event_date: new Date().toISOString(),
      },
    ],
    showJoinButton: false,
  },
};

/**
 * Multiple Events Same Day
 * Several events on the same date
 */
export const MultipleSameDay: Story = {
  args: {
    events: [
      {
        ...calendarEvent,
        id: 'same-day-1',
        event_time: '09:00',
        title: 'Morning Coffee Chat',
      },
      {
        ...discoveryEventWithImage,
        id: 'same-day-2',
        event_date: calendarEvent.event_date,
        event_time: '14:00',
        title: 'Afternoon Workshop',
      },
      {
        ...gamingEvent,
        id: 'same-day-3',
        event_date: calendarEvent.event_date,
        event_time: '19:00',
        title: 'Evening Game Night',
      },
    ],
    showJoinButton: false,
  },
};

/**
 * With Past Events - Mixed timeline
 * Includes both past and upcoming events
 */
export const WithPastEvents: Story = {
  args: {
    events: [
      pastEvent,
      {
        ...pastEvent,
        id: 'past-2',
        title: 'Yesterday\'s Meetup',
        event_date: new Date(Date.now() - 86400000).toISOString(),
      },
      calendarEvent,
      discoveryEventWithImage,
      gamingEvent,
    ],
    showJoinButton: false,
  },
};

/**
 * Long Content - Overflow handling
 * Tests line-clamp and content truncation
 */
export const LongContent: Story = {
  args: {
    events: [
      eventLongDescription,
      {
        ...eventLongDescription,
        id: 'long-2',
        title: 'Another Event with Very Long Title That Should Be Truncated Properly On Mobile Devices',
        event_date: new Date(Date.now() + 86400000).toISOString(),
      },
    ],
    showJoinButton: false,
  },
};

/**
 * With Join Buttons - Interactive timeline
 * Shows join buttons on all cards
 */
export const WithJoinButtons: Story = {
  args: {
    events: mixedEvents.slice(0, 4),
    showJoinButton: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'Note: Join buttons require AuthContext. In Storybook, they may not be fully functional.',
      },
    },
  },
};

/**
 * Empty Timeline
 * No events to display
 */
export const EmptyTimeline: Story = {
  args: {
    events: [],
    showJoinButton: false,
  },
};

/**
 * Mobile 375px - iPhone 12 mini
 * Smallest iOS breakpoint
 */
export const Mobile375px: Story = {
  args: {
    events: timelineGroupedEvents,
    showJoinButton: false,
  },
  parameters: {
    viewport: {
      defaultViewport: 'iphone12mini',
    },
  },
};

/**
 * Mobile 430px - iPhone 14 Pro Max
 * Largest standard iOS breakpoint
 */
export const Mobile430px: Story = {
  args: {
    events: timelineGroupedEvents,
    showJoinButton: false,
  },
  parameters: {
    viewport: {
      defaultViewport: 'iphone14promax',
    },
  },
};

/**
 * Vertical Line Alignment - Visual check
 * Ensures line and nodes are properly centered
 */
export const VerticalLineAlignment: Story = {
  args: {
    events: [
      calendarEvent,
      discoveryEventWithImage,
      discoveryEventNoImage,
      gamingEvent,
    ],
    showJoinButton: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'Visual test: Vertical line should be centered, time nodes should align with line. Line should continue through date headers.',
      },
    },
  },
};

/**
 * Date Header Glass Pill - Overlay style
 * Tests sticky date headers with glass styling
 */
export const DateHeaderGlassPill: Story = {
  args: {
    events: timelineGroupedEvents,
    showJoinButton: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'Date headers use iOS-style glass pill with backdrop blur. Line should remain continuous behind headers.',
      },
    },
  },
};

/**
 * Motion & Interaction - Hover/tap states
 * Tests scale/glow effects on interaction
 */
export const MotionInteraction: Story = {
  args: {
    events: [
      calendarEvent,
      discoveryEventWithImage,
      gamingEvent,
    ],
    showJoinButton: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'Hover/tap on cards to see scale and glow effects. Time nodes for upcoming events should have glow effect.',
      },
    },
  },
};

/**
 * Reduced Motion - Accessibility
 * No animations for users who prefer reduced motion
 */
export const ReducedMotion: Story = {
  args: {
    events: mixedEvents,
    showJoinButton: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'Enable "Reduce Motion" in your OS settings. All animations should be disabled or minimized.',
      },
    },
    a11y: {
      config: {
        rules: [
          {
            id: 'motion',
            enabled: true,
          },
        ],
      },
    },
  },
};

/**
 * Accessibility Focus - Keyboard navigation
 * Tests focus rings and aria-labels
 */
export const AccessibilityFocus: Story = {
  args: {
    events: timelineGroupedEvents.slice(0, 5),
    showJoinButton: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'Use Tab key to navigate through events. Focus rings should be visible with sufficient contrast.',
      },
    },
    a11y: {
      config: {
        rules: [
          {
            id: 'color-contrast',
            enabled: true,
          },
          {
            id: 'focus-order-semantics',
            enabled: true,
          },
          {
            id: 'label',
            enabled: true,
          },
        ],
      },
    },
  },
};

/**
 * Dark Mode - Glass effects on dark
 * Tests glassmorphism on dark background
 */
export const DarkMode: Story = {
  args: {
    events: discoveryOnlyEvents,
    showJoinButton: false,
  },
  parameters: {
    backgrounds: {
      default: 'dark',
    },
  },
  decorators: [
    (Story) => (
      <div className="dark" style={{ backgroundColor: '#0a0a0a', minHeight: '100vh' }}>
        <Story />
      </div>
    ),
  ],
};

/**
 * Contrast Check - Glass over media
 * Tests text contrast on glassmorphism with background images
 */
export const ContrastOverMedia: Story = {
  args: {
    events: eventsWithImages,
    showJoinButton: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'Text on glassmorphism cards with background images must maintain sufficient contrast (WCAG AA minimum).',
      },
    },
    a11y: {
      config: {
        rules: [
          {
            id: 'color-contrast',
            enabled: true,
          },
        ],
      },
    },
  },
};
