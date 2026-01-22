import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/shared/config/queryKeys';


interface FriendActivity {
  user: {
    id: string;
    avatar_url: string | null;
    first_name: string;
  };
  status: 'live' | 'upcoming';
  event: {
    id: string;
    title: string;
    category: string;
  };
}

/**
 * Hook to fetch friends' activity status (who is at events now or soon)
 * Uses the get_friends_pulse RPC function
 */
export function useFriendsPulse(currentUserProfileId?: string) {
  const query = useQuery({
    queryKey: queryKeys.friendsPulse(currentUserProfileId || ''),
    queryFn: async () => {
      if (!currentUserProfileId) {
        return [];
      }

      const { data, error } = await supabase.rpc('get_friends_pulse', {
        current_user_id: currentUserProfileId,
      });

      if (error) {
        console.error('Error fetching friends pulse:', error);
        throw error;
      }

      // The RPC function returns JSON, parse it
      return (data as unknown as FriendActivity[]) || [];
    },
    enabled: !!currentUserProfileId,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: true,
    refetchInterval: 60000, // Refetch every minute for real-time feel
  });

  return {
    activities: query.data || [],
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
