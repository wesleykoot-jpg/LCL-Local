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

vi.mock('@/features/auth', () => ({
  useAuth: () => ({
    profile: { id: 'test-user-id' },
  }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
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
    
    // Time should be visible
    expect(screen.getByText('7:00 PM')).toBeInTheDocument();
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

    it('shows title in overlay on poster when image is present', () => {
      const eventWithImage = { 
        ...mockEvent, 
        image_url: 'https://example.com/image.jpg' 
      };
      render(<TimelineEventCard event={eventWithImage} variant="trip-card" />);
      
      // Title should be visible (in overlay)
      expect(screen.getByText('Test Event')).toBeInTheDocument();
    });

    it('shows title in fallback gradient when no image', () => {
      render(<TimelineEventCard event={mockEvent} variant="trip-card" />);
      
      // Title should still be visible (in fallback gradient overlay)
      expect(screen.getByText('Test Event')).toBeInTheDocument();
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
  });
});
