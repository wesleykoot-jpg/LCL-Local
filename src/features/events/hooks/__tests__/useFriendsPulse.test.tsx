import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFriendsPulse } from '../useFriendsPulse';
import { supabase } from '@/integrations/supabase/client';

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: vi.fn(),
  },
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

describe('useFriendsPulse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty array when no user ID is provided', async () => {
    const { result } = renderHook(() => useFriendsPulse(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.activities).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('should call RPC function with correct parameters', async () => {
    const mockData = [
      {
        user: { id: 'user-1', avatar_url: 'url', first_name: 'John' },
        status: 'live',
        event: { id: 'event-1', title: 'Test Event', category: 'music' },
      },
    ];

    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: mockData,
      error: null,
    });

    const { result } = renderHook(() => useFriendsPulse('test-user-id'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(supabase.rpc).toHaveBeenCalledWith('get_friends_pulse', {
      current_user_id: 'test-user-id',
    });
    expect(result.current.activities).toEqual(mockData);
  });

  it('should handle errors gracefully', async () => {
    const mockError = new Error('RPC error');
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: null,
      error: mockError,
    });

    const { result } = renderHook(() => useFriendsPulse('test-user-id'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
  });

  it('should return empty array when RPC returns null', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const { result } = renderHook(() => useFriendsPulse('test-user-id'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.activities).toEqual([]);
  });
});
