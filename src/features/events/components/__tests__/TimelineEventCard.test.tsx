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

  it('shows ticket number when present', () => {
    const eventWithTicket = { ...mockEvent, ticket_number: 'TICKET-123' };
    render(<TimelineEventCard event={eventWithTicket} />);
    
    expect(screen.getByText('TICKET-123')).toBeInTheDocument();
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
    
    // Category badge should be visible (cinema maps to entertainment)
    expect(screen.getByText('entertainment')).toBeInTheDocument();
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
    // Category should be inline (cinema maps to entertainment)
    expect(screen.getByText('entertainment')).toBeInTheDocument();
  });
});
