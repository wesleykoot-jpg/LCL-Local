import React, { createContext, useEffect, useState } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUpWithEmail: (email: string, password: string, fullName: string) => Promise<{ error: AuthError | null }>;
  signInWithGoogle: () => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      setProfile(data);
      return data;
    } catch (error) {
      console.error('Error fetching profile:', error);
      throw error; // Re-throw to allow caller to handle
    }
  };

  const createProfileForUser = async (userId: string, fullName: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .insert({
          user_id: userId,
          full_name: fullName,
          profile_complete: false,
        })
        .select()
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Profile creation returned no data');
      return { data, error: null };
    } catch (error) {
      console.error('Error creating profile:', error);
      return { data: null, error: error as Error };
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  useEffect(() => {
    // Set a timeout to ensure loading state is always resolved
    const loadingTimeout = setTimeout(() => {
      console.warn('[Auth] Session check timeout - continuing without authentication');
      setLoading(false);
    }, 10000); // 10 second timeout

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        clearTimeout(loadingTimeout);
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchProfile(session.user.id)
            .catch(() => {
              // Profile doesn't exist, ignore for now
              // Will be handled by onAuthStateChange for new users
            })
            .finally(() => setLoading(false));
        } else {
          setLoading(false);
        }
      })
      .catch((error) => {
        clearTimeout(loadingTimeout);
        console.error('[Auth] Failed to get session:', error);
        setLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        // Use async IIFE to avoid deadlocks with await in callback
        (async () => {
          try {
            // Handle SIGNED_IN event (including OAuth)
            if (event === 'SIGNED_IN') {
              const existingProfile = await fetchProfile(session.user.id);

              // If no profile exists, create one (OAuth scenario)
              if (!existingProfile) {
                const fullName = session.user.user_metadata?.full_name ||
                               session.user.user_metadata?.name ||
                               session.user.email?.split('@')[0] ||
                               'User';

                const { error } = await createProfileForUser(session.user.id, fullName);

                if (error) {
                  console.error('Failed to create profile for OAuth user:', error);
                } else {
                  // Fetch the newly created profile
                  await fetchProfile(session.user.id).catch(console.error);
                }
              }
            } else {
              // For other events, just fetch profile
              await fetchProfile(session.user.id).catch(console.error);
            }
          } catch (error) {
            console.error('Error during auth state change:', error);
          }
        })();
      } else {
        setProfile(null);
      }
    });

    return () => {
      clearTimeout(loadingTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error };
    } catch (error) {
      return { error: error as AuthError };
    }
  };

  const signUpWithEmail = async (email: string, password: string, fullName: string) => {
    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (signUpError) return { error: signUpError };

      if (authData.user) {
        // Wait a moment for auth session to be established
        await new Promise(resolve => setTimeout(resolve, 500));

        const { error: profileError } = await createProfileForUser(authData.user.id, fullName);

        if (profileError) {
          console.error('Profile creation failed:', profileError);
          return {
            error: {
              message: 'Account created but profile setup failed. Please try signing in.',
              name: 'ProfileCreationError',
              status: 500
            } as AuthError
          };
        }
      }

      return { error: null };
    } catch (error) {
      return { error: error as AuthError };
    }
  };

  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}`,
        },
      });
      return { error };
    } catch (error) {
      return { error: error as AuthError };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) {
      return { error: new Error('No user logged in') };
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', user.id);

      if (error) throw error;

      await refreshProfile();

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const value = {
    user,
    session,
    profile,
    loading,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    signOut,
    updateProfile,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
