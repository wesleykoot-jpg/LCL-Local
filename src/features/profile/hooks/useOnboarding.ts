import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/features/auth';

const ONBOARDING_KEY = 'lcl_onboarding_complete';
const PREFERENCES_KEY = 'lcl_user_preferences';

interface UserPreferences {
  selectedCategories: string[];
  zone: string;
}

/**
 * useOnboarding - Hook for managing onboarding state
 * 
 * Integrates with backend profile_complete field while maintaining
 * localStorage fallback for users without profiles.
 * 
 * Priority: Backend profile_complete > localStorage
 */
export function useOnboarding() {
  const { profile, updateProfile, loading: authLoading } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Wait for auth to load
    if (authLoading) return;

    // Priority 1: Check backend profile_complete if profile exists
    if (profile) {
      const isComplete = profile.profile_complete ?? false;
      
      // Load preferences from localStorage
      const savedPrefs = localStorage.getItem(PREFERENCES_KEY);
      if (savedPrefs) {
        try {
          setPreferences(JSON.parse(savedPrefs));
        } catch {
          // Invalid prefs, clear
          localStorage.removeItem(PREFERENCES_KEY);
        }
      }
      
      setShowOnboarding(!isComplete);
      setIsLoaded(true);
    } else {
      // Priority 2: Fallback to localStorage if no profile
      const isComplete = localStorage.getItem(ONBOARDING_KEY);
      const savedPrefs = localStorage.getItem(PREFERENCES_KEY);
      
      if (savedPrefs) {
        try {
          setPreferences(JSON.parse(savedPrefs));
        } catch {
          // Invalid prefs, clear and show onboarding
          localStorage.removeItem(PREFERENCES_KEY);
          localStorage.removeItem(ONBOARDING_KEY);
        }
      }
      
      if (!isComplete) {
        setShowOnboarding(true);
      }
      
      setIsLoaded(true);
    }
  }, [profile, authLoading]);

  const completeOnboarding = useCallback(async (selectedCategories: string[], zone: string) => {
    const newPrefs: UserPreferences = { selectedCategories, zone };
    
    // Always save to localStorage for immediate access
    localStorage.setItem(ONBOARDING_KEY, 'true');
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(newPrefs));
    setPreferences(newPrefs);
    setShowOnboarding(false);

    // If user has a profile, update profile_complete in backend
    if (profile) {
      try {
        await updateProfile({ profile_complete: true });
        console.log('[Onboarding] Profile updated with profile_complete: true');
      } catch (error) {
        console.error('[Onboarding] Failed to update profile_complete:', error);
        // Don't block UX - localStorage is already updated
      }
    }
  }, [profile, updateProfile]);

  const resetOnboarding = useCallback(async () => {
    // Clear localStorage
    localStorage.removeItem(ONBOARDING_KEY);
    localStorage.removeItem(PREFERENCES_KEY);
    setPreferences(null);
    setShowOnboarding(true);

    // If user has a profile, reset profile_complete in backend
    if (profile) {
      try {
        await updateProfile({ profile_complete: false });
        console.log('[Onboarding] Profile updated with profile_complete: false');
      } catch (error) {
        console.error('[Onboarding] Failed to reset profile_complete:', error);
      }
    }
  }, [profile, updateProfile]);

  const updatePreferences = useCallback((updates: Partial<UserPreferences>) => {
    setPreferences(prev => {
      if (!prev) return null;
      const newPrefs = { ...prev, ...updates };
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(newPrefs));
      return newPrefs;
    });
  }, []);

  return {
    showOnboarding,
    setShowOnboarding,
    preferences,
    completeOnboarding,
    resetOnboarding,
    updatePreferences,
    isLoaded,
  };
}
