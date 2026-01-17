import type { Meta, StoryObj } from '@storybook/react';
import { TimelineEventCard } from './TimelineEventCard';
import {
  calendarEvent,
  discoveryEventWithImage,
  discoveryEventNoImage,
  eventLongDescription,
  pastEvent,
  gamingEvent,
  familyEvent,
  outdoorEvent,
  foodieEvent,
  workshopEvent,
} from '@/storybook/mocks/events';

/**
 * TimelineEventCard displays individual event information in the EventTimeline.
 * 
 * ## Variants
 * - **default**: Full event details with time, location, category
 * - **minimal**: Simplified view with category badge in top-right
 * - **trip-card**: Visual poster design with 2:1 aspect ratio image
 * 
 * ## Event Types
 * - **Calendar Events**: Simple, flat cards without images (Google Calendar imports)
 * - **Discovery Events**: Glassmorphism styling with io26-glass effects, media emphasis
 * 
 * ## Mobile-First Design
 * Optimized for iOS (375px, 430px). Uses:
 * - iOS card spacing (rounded-2xl = 16px radius, or rounded-[28px] = 28px squircle)
 * - Glassmorphism effects from io26-glass.css
 * - Framer Motion for interactions
 * - Accessibility: aria-labels, focus rings, contrast checks
 */
const meta = {
  title: 'Events/TimelineEventCard',
  component: TimelineEventCard,
  parameters: {
    layout: 'padded',
    viewport: {
      defaultViewport: 'iphone12',
    },
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['default', 'minimal', 'trip-card'],
      description: 'Card display variant',
    },
    isPast: {
      control: 'boolean',
      description: 'Whether the event is in the past (dimmed styling)',
    },
    showJoinButton: {
      control: 'boolean',
      description: 'Show join button (requires auth context)',
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: '430px', margin: '0 auto', padding: '1rem' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TimelineEventCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default variant - Full event details
 * Shows time, location, attendees, and category inline
 */
export const Default: Story = {
  args: {
    event: discoveryEventWithImage,
    variant: 'default',
    isPast: false,
    showJoinButton: false,
  },
};

/**
 * Calendar Event - Simple, flat styling
 * No image, solid card background
 */
export const CalendarEvent: Story = {
  args: {
    event: calendarEvent,
    variant: 'default',
    isPast: false,
    showJoinButton: false,
  },
};

/**
 * Discovery Event with Image - Glassmorphism
 * Full io26-glass effects with media block
 */
export const DiscoveryWithImage: Story = {
  args: {
    event: discoveryEventWithImage,
    variant: 'default',
    isPast: false,
    showJoinButton: false,
  },
};

/**
 * Discovery Event without Image - Glass with gradient fallback
 * Glassmorphism styling but no image, shows gradient background
 */
export const DiscoveryNoImage: Story = {
  args: {
    event: discoveryEventNoImage,
    variant: 'default',
    isPast: false,
    showJoinButton: false,
  },
};

/**
 * Minimal Variant - Simplified view
 * Category badge in top-right, no time/location details
 */
export const Minimal: Story = {
  args: {
    event: gamingEvent,
    variant: 'minimal',
    isPast: false,
    showJoinButton: false,
  },
};

/**
 * Trip Card Variant - Visual poster design
 * 2:1 aspect ratio image with title overlay
 */
export const TripCard: Story = {
  args: {
    event: discoveryEventWithImage,
    variant: 'trip-card',
    isPast: false,
    showJoinButton: false,
  },
};

/**
 * Trip Card without Image - Gradient fallback
 */
export const TripCardNoImage: Story = {
  args: {
    event: workshopEvent,
    variant: 'trip-card',
    isPast: false,
    showJoinButton: false,
  },
};

/**
 * Past Event - Dimmed styling
 * Opacity reduced, muted colors
 */
export const PastEvent: Story = {
  args: {
    event: pastEvent,
    variant: 'default',
    isPast: true,
    showJoinButton: false,
  },
};

/**
 * Long Content - Line clamp test
 * Description should be truncated with line-clamp
 */
export const LongDescription: Story = {
  args: {
    event: eventLongDescription,
    variant: 'default',
    isPast: false,
    showJoinButton: false,
  },
};

/**
 * With Join Button - Interactive state
 * Shows join button for user actions
 */
export const WithJoinButton: Story = {
  args: {
    event: familyEvent,
    variant: 'default',
    isPast: false,
    showJoinButton: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'Note: Join button requires AuthContext. In Storybook, it may not be fully functional.',
      },
    },
  },
};

/**
 * Category Variants - Different event categories
 */
export const CategoryGaming: Story = {
  args: {
    event: gamingEvent,
    variant: 'default',
    isPast: false,
    showJoinButton: false,
  },
};

export const CategoryFamily: Story = {
  args: {
    event: familyEvent,
    variant: 'default',
    isPast: false,
    showJoinButton: false,
  },
};

export const CategoryOutdoors: Story = {
  args: {
    event: outdoorEvent,
    variant: 'default',
    isPast: false,
    showJoinButton: false,
  },
};

export const CategoryFoodie: Story = {
  args: {
    event: foodieEvent,
    variant: 'default',
    isPast: false,
    showJoinButton: false,
  },
};

export const CategoryWorkshop: Story = {
  args: {
    event: workshopEvent,
    variant: 'default',
    isPast: false,
    showJoinButton: false,
  },
};

/**
 * Accessibility Focus State
 * Test keyboard navigation and focus rings
 */
export const AccessibilityFocus: Story = {
  args: {
    event: discoveryEventWithImage,
    variant: 'default',
    isPast: false,
    showJoinButton: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'Use Tab key to test focus states. Focus rings should be visible and have sufficient contrast.',
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
        ],
      },
    },
  },
};

/**
 * Mobile Breakpoints - 375px (iPhone 12 mini)
 */
export const Mobile375px: Story = {
  args: {
    event: discoveryEventWithImage,
    variant: 'default',
    isPast: false,
    showJoinButton: false,
  },
  parameters: {
    viewport: {
      defaultViewport: 'iphone12mini',
    },
  },
};

/**
 * Mobile Breakpoints - 430px (iPhone 14 Pro Max)
 */
export const Mobile430px: Story = {
  args: {
    event: discoveryEventWithImage,
    variant: 'default',
    isPast: false,
    showJoinButton: false,
  },
  parameters: {
    viewport: {
      defaultViewport: 'iphone14promax',
    },
  },
};

/**
 * Reduced Motion - Accessibility
 * No animations/transitions for users who prefer reduced motion
 */
export const ReducedMotion: Story = {
  args: {
    event: gamingEvent,
    variant: 'default',
    isPast: false,
    showJoinButton: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'Enable "Reduce Motion" in your OS settings to test. Framer Motion should respect prefers-reduced-motion.',
      },
    },
  },
};

/**
 * Dark Mode - Glass effects on dark background
 */
export const DarkMode: Story = {
  args: {
    event: discoveryEventWithImage,
    variant: 'default',
    isPast: false,
    showJoinButton: false,
  },
  parameters: {
    backgrounds: {
      default: 'dark',
    },
  },
  decorators: [
    (Story) => (
      <div className="dark" style={{ maxWidth: '430px', margin: '0 auto', padding: '1rem', backgroundColor: '#0a0a0a', minHeight: '100vh' }}>
        <Story />
      </div>
    ),
  ],
};

/**
 * Share Button - All variants show share button
 * Floating top-right share button with accessibility support
 */
export const ShareButton: Story = {
  args: {
    event: discoveryEventWithImage,
    variant: 'trip-card',
    isPast: false,
    showJoinButton: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'Share button appears on all card variants (default, minimal, trip-card). Uses navigator.share API with clipboard fallback.',
      },
    },
  },
};

/**
 * Google Calendar Sync Badge - Event synced to Google Calendar
 * Shows "Synced with Google" badge when event is synced
 */
export const GoogleCalendarSynced: Story = {
  args: {
    event: discoveryEventWithImage,
    variant: 'default',
    isPast: false,
    showJoinButton: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'When an event is synced to Google Calendar, a blue badge appears showing "Synced with Google". Requires Google Calendar connection and sync status hook.',
      },
    },
  },
};
