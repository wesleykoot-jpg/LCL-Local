import { useState, useEffect, useCallback } from 'react';

const ONBOARDING_KEY = 'lcl_onboarding_complete';
const PREFERENCES_KEY = 'lcl_user_preferences';

interface UserPreferences {
  selectedCategories: string[];
  zone: string;
}

export function useOnboarding() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
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
  }, []);

  const completeOnboarding = useCallback((selectedCategories: string[], zone: string) => {
    const newPrefs: UserPreferences = { selectedCategories, zone };
    localStorage.setItem(ONBOARDING_KEY, 'true');
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(newPrefs));
    setPreferences(newPrefs);
    setShowOnboarding(false);
  }, []);

  const resetOnboarding = useCallback(() => {
    localStorage.removeItem(ONBOARDING_KEY);
    localStorage.removeItem(PREFERENCES_KEY);
    setPreferences(null);
    setShowOnboarding(true);
  }, []);

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
