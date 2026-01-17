import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/features/auth';

const ONBOARDING_KEY = 'lcl_onboarding_complete';
const PREFERENCES_KEY = 'lcl_user_preferences';

interface UserPreferences {
  selectedCategories: string[];
  zone: string;
}

export function useOnboarding() {
  const { profile, updateProfile } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Check backend profile_complete first, then fall back to localStorage
    const backendComplete = profile?.profile_complete;
    const localComplete = localStorage.getItem(ONBOARDING_KEY);
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
    
    // If backend says incomplete or no profile exists, show onboarding
    // Also show if localStorage says incomplete (for backwards compatibility)
    if (backendComplete === false || (!backendComplete && !localComplete)) {
      setShowOnboarding(true);
    }
    
    setIsLoaded(true);
  }, [profile]);

  const completeOnboarding = useCallback(async (selectedCategories: string[], zone: string) => {
    const newPrefs: UserPreferences = { selectedCategories, zone };
    
    // Save to localStorage for immediate feedback
    localStorage.setItem(ONBOARDING_KEY, 'true');
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(newPrefs));
    setPreferences(newPrefs);
    setShowOnboarding(false);

    // Update profile_complete in backend if profile exists
    if (profile) {
      try {
        await updateProfile({ profile_complete: true });
      } catch (error) {
        console.error('Failed to update profile_complete in backend:', error);
        // Don't revert UI state - localStorage update succeeded
      }
    }
  }, [profile, updateProfile]);

  const resetOnboarding = useCallback(async () => {
    localStorage.removeItem(ONBOARDING_KEY);
    localStorage.removeItem(PREFERENCES_KEY);
    setPreferences(null);
    setShowOnboarding(true);

    // Reset profile_complete in backend if profile exists
    if (profile) {
      try {
        await updateProfile({ profile_complete: false });
      } catch (error) {
        console.error('Failed to reset profile_complete in backend:', error);
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
