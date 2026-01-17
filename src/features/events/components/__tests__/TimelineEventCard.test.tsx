import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TimelineEventCard } from '../TimelineEventCard';
import type { EventWithAttendees } from '../../hooks/hooks';

// Mock the hooks
vi.mock('../../hooks/hooks', () => ({
  useJoinEvent: () => ({
    handleJoinEvent: vi.fn(),
    isJoining: () => false,
  }),
}));

vi.mock('../../hooks/useEventSyncStatus', () => ({
  useEventSyncStatus: () => ({
    data: null,
    isLoading: false,
  }),
}));

vi.mock('@/hooks/useGoogleCalendar', () => ({
  useGoogleCalendar: () => ({
    isConnected: false,
    isConfigured: false,
    syncEventToCalendar: vi.fn(),
  }),
}));

vi.mock('@/features/auth', () => ({
  useAuth: () => ({
    profile: { id: 'test-user-id' },
  }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
  useQuery: () => ({
    data: null,
    isLoading: false,
  }),
}));

vi.mock('@/shared/lib/haptics', () => ({
  hapticImpact: vi.fn(),
}));

describe('TimelineEventCard', () => {
  const mockEvent: EventWithAttendees & { ticket_number?: string } = {
    id: 'event-1',
    title: 'Test Event',
    description: 'Test Description',
    category: 'cinema',
    event_type: 'anchor',
    event_date: '2026-01-20T19:00:00Z',
    event_time: '19:00',
    venue_name: 'Test Venue',
    location: null,
    status: 'active',
    image_url: null,
    match_percentage: 85,
    attendee_count: 5,
    attendees: [],
    created_by: null,
    created_at: new Date().toISOString(),
    source_id: null,
    event_fingerprint: null,
    max_attendees: null,
    structured_date: null,
    structured_location: null,
    organizer: null,
    parent_event: null,
    parent_event_id: null,
  };

  it('renders event details correctly', () => {
    render(<TimelineEventCard event={mockEvent} />);
    
    expect(screen.getByText('Test Event')).toBeInTheDocument();
    expect(screen.getByText('Test Venue')).toBeInTheDocument();
    expect(screen.getByText('5 going')).toBeInTheDocument();
  });

  it('does not show join button by default', () => {
    render(<TimelineEventCard event={mockEvent} />);
    
    expect(screen.queryByText('Join Event')).not.toBeInTheDocument();
  });

  it('shows join button when showJoinButton is true', () => {
    render(<TimelineEventCard event={mockEvent} showJoinButton={true} />);
    
    expect(screen.getByText('Join Event')).toBeInTheDocument();
  });

  it('does not show ticket number in default variant', () => {
    const eventWithTicket = { ...mockEvent, ticket_number: 'TICKET-123' };
    render(<TimelineEventCard event={eventWithTicket} />);
    
    // Ticket number only displayed in trip-card variant
    expect(screen.queryByText('TICKET-123')).not.toBeInTheDocument();
  });

  it('applies past styling when isPast is true', () => {
    const { container } = render(<TimelineEventCard event={mockEvent} isPast={true} />);
    
    const card = container.querySelector('.border-border\\/50.opacity-60');
    expect(card).toBeInTheDocument();
  });

  it('hides time and location in minimal variant', () => {
    render(<TimelineEventCard event={mockEvent} variant="minimal" />);
    
    // Time should not be visible
    expect(screen.queryByText('7:00 PM')).not.toBeInTheDocument();
    // Location should not be visible in location row
    expect(screen.queryByText(/•/)).not.toBeInTheDocument();
    // But title and attendees should still be visible
    expect(screen.getByText('Test Event')).toBeInTheDocument();
    expect(screen.getByText('5 going')).toBeInTheDocument();
  });

  it('shows category badge in top-right for minimal variant', () => {
    const { container } = render(<TimelineEventCard event={mockEvent} variant="minimal" />);
    
    // Category badge should be visible (cinema maps to entertainment, which has label "Entertainment")
    expect(screen.getByText('Entertainment')).toBeInTheDocument();
    // Should have absolute positioning class
    const badge = container.querySelector('.absolute.top-3.right-3');
    expect(badge).toBeInTheDocument();
  });

  it('shows full details in default variant', () => {
    render(<TimelineEventCard event={mockEvent} variant="default" />);
    
    // Time should be visible (now part of SmartTimeLabel with date)
    // The time is embedded in a larger string like "Tue 20 Jan • 7:00 PM"
    expect(screen.getByText(/7:00 PM/)).toBeInTheDocument();
    // Location should be visible
    expect(screen.getByText('Test Venue')).toBeInTheDocument();
    // Category should be inline (cinema maps to entertainment, which has label "Entertainment")
    expect(screen.getByText('Entertainment')).toBeInTheDocument();
  });

  describe('trip-card variant', () => {
    it('hides time in trip-card variant', () => {
      render(<TimelineEventCard event={mockEvent} variant="trip-card" />);
      
      // Time should not be visible (trip-card doesn't show time)
      expect(screen.queryByText('7:00 PM')).not.toBeInTheDocument();
    });

    it('shows venue name in trip-card variant', () => {
      render(<TimelineEventCard event={mockEvent} variant="trip-card" />);
      
      // Venue should be visible in the body
      expect(screen.getByText('Test Venue')).toBeInTheDocument();
    });

    it('shows title in body section only (not as overlay)', () => {
      const eventWithImage = { 
        ...mockEvent, 
        image_url: 'https://example.com/image.jpg' 
      };
      render(<TimelineEventCard event={eventWithImage} variant="trip-card" />);
      
      // Title should be visible in body section
      const titles = screen.getAllByText('Test Event');
      // Should only appear once (in body, not as duplicate overlay)
      expect(titles).toHaveLength(1);
    });

    it('shows title when no image present', () => {
      render(<TimelineEventCard event={mockEvent} variant="trip-card" />);
      
      // Title should still be visible in body
      expect(screen.getByText('Test Event')).toBeInTheDocument();
    });

    it('renders with aspect-[3/1] class for reduced poster height', () => {
      const eventWithImage = { 
        ...mockEvent, 
        image_url: 'https://example.com/image.jpg' 
      };
      const { container } = render(<TimelineEventCard event={eventWithImage} variant="trip-card" />);
      
      // Check for aspect-[3/1] class on poster container
      const aspectContainer = container.querySelector('.aspect-\\[3\\/1\\]');
      expect(aspectContainer).toBeInTheDocument();
    });

    it('shows attendee count and category badge in trip-card variant', () => {
      render(<TimelineEventCard event={mockEvent} variant="trip-card" />);
      
      expect(screen.getByText('5 going')).toBeInTheDocument();
      // Category badge should say "Entertainment" (capital E)
      expect(screen.getByText('Entertainment')).toBeInTheDocument();
    });

    it('renders image with proper attributes in trip-card variant', () => {
      const eventWithImage = { 
        ...mockEvent, 
        image_url: 'https://example.com/image.jpg' 
      };
      const { container } = render(<TimelineEventCard event={eventWithImage} variant="trip-card" />);
      
      // Image should be present with correct attributes
      const image = container.querySelector('img');
      expect(image).toBeInTheDocument();
      expect(image?.getAttribute('src')).toBe('https://example.com/image.jpg');
      expect(image?.getAttribute('loading')).toBe('lazy');
      expect(image?.className).toContain('object-cover');
    });

    it('shows join button in trip-card variant when showJoinButton is true', () => {
      render(<TimelineEventCard event={mockEvent} variant="trip-card" showJoinButton={true} />);
      
      expect(screen.getByText('Join Event')).toBeInTheDocument();
    });

    it('shows ticket number in trip-card variant when present', () => {
      const eventWithTicket = { ...mockEvent, ticket_number: 'TICKET-456' };
      render(<TimelineEventCard event={eventWithTicket} variant="trip-card" />);
      
      expect(screen.getByText('TICKET-456')).toBeInTheDocument();
    });

    it('shows share button in trip-card variant', () => {
      const { container } = render(<TimelineEventCard event={mockEvent} variant="trip-card" />);
      
      // Share button should be present with aria-label
      const shareButton = screen.getByLabelText('Share event');
      expect(shareButton).toBeInTheDocument();
      
      // Should be positioned absolutely at top-right
      const shareContainer = container.querySelector('.absolute.right-3.top-3');
      expect(shareContainer).toBeInTheDocument();
    });
  });

  describe('share functionality', () => {
    it('shows share button in all variants', () => {
      // Default variant
      const { rerender } = render(<TimelineEventCard event={mockEvent} variant="default" />);
      expect(screen.getByLabelText('Share event')).toBeInTheDocument();
      
      // Minimal variant
      rerender(<TimelineEventCard event={mockEvent} variant="minimal" />);
      expect(screen.getByLabelText('Share event')).toBeInTheDocument();
      
      // Trip-card variant
      rerender(<TimelineEventCard event={mockEvent} variant="trip-card" />);
      expect(screen.getByLabelText('Share event')).toBeInTheDocument();
    });
  });

  describe('time_mode display', () => {
    it('shows SmartTimeLabel for fixed events with date and time', () => {
      const fixedEvent = { 
        ...mockEvent, 
        time_mode: 'fixed' as const,
        event_date: '2026-01-20T19:00:00Z',
        event_time: '19:00',
      };
      render(<TimelineEventCard event={fixedEvent} variant="default" />);
      
      // Should show date and time for fixed events
      expect(screen.getByText(/7:00 PM/)).toBeInTheDocument();
      expect(screen.getByText(/Jan/)).toBeInTheDocument();
    });

    it('handles window mode events (venues with opening hours)', () => {
      const windowEvent = { 
        ...mockEvent, 
        time_mode: 'window' as const,
        event_date: null,
        event_time: '',
        opening_hours: {
          monday: ['09:00-17:00'],
          tuesday: ['09:00-17:00'],
        },
      };
      render(<TimelineEventCard event={windowEvent} variant="default" />);
      
      // Should render without crashing for window mode
      expect(screen.getByText('Test Event')).toBeInTheDocument();
    });

    it('handles anytime mode events (always open venues)', () => {
      const anytimeEvent = { 
        ...mockEvent, 
        time_mode: 'anytime' as const,
        event_date: null,
        event_time: '',
        opening_hours: null,
      };
      render(<TimelineEventCard event={anytimeEvent} variant="default" />);
      
      // Should show "Always Open" indicator for anytime events
      expect(screen.getByText('Test Event')).toBeInTheDocument();
      // SmartTimeLabel should render anytime indicator
      expect(screen.getByText(/Always Open/)).toBeInTheDocument();
    });

    it('defaults to fixed mode when time_mode is not specified', () => {
      // Existing events without time_mode should default to 'fixed'
      const legacyEvent = { 
        ...mockEvent, 
        time_mode: undefined as unknown,
      };
      render(<TimelineEventCard event={legacyEvent as EventWithAttendees} variant="default" />);
      
      // Should still show the event time for legacy events
      expect(screen.getByText(/7:00 PM/)).toBeInTheDocument();
    });
  });
});
