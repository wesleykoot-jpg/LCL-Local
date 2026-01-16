import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FriendsPulseRail } from '../FriendsPulseRail';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock the useFriendsPulse hook
vi.mock('../../hooks/useFriendsPulse', () => ({
  useFriendsPulse: vi.fn(() => ({
    activities: [],
    loading: false,
    error: null,
    refetch: vi.fn(),
  })),
}));

// Mock haptics
vi.mock('@/shared/lib/haptics', () => ({
  hapticImpact: vi.fn(),
}));

// Mock toast
vi.mock('react-hot-toast', () => ({
  default: vi.fn(),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('FriendsPulseRail', () => {
  it('should not render when there are no activities', () => {
    const { container } = render(
      <FriendsPulseRail 
        currentUserProfileId="test-user-id" 
        onEventClick={vi.fn()} 
      />,
      { wrapper: createWrapper() }
    );
    
    expect(container.firstChild).toBeNull();
  });

  it('should not render when currentUserProfileId is not provided', () => {
    const { container } = render(
      <FriendsPulseRail 
        currentUserProfileId={undefined} 
        onEventClick={vi.fn()} 
      />,
      { wrapper: createWrapper() }
    );
    
    expect(container.firstChild).toBeNull();
  });
});
