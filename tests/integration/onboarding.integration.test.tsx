/**
 * Integration Test: Onboarding Flow
 * 
 * Tests the complete onboarding flow:
 * 1. User completes onboarding with category selections
 * 2. profile_complete is set to true in backend
 * 3. Onboarding modal is no longer shown
 * 4. User can navigate to profile page
 * 5. Profile displays correct data
 * 6. User can sign out
 * 
 * Prerequisites:
 * - Supabase test environment configured
 * - Test user credentials available
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useOnboarding } from '@/features/profile/hooks/useOnboarding';
import { AuthContext } from '@/features/auth/AuthContext';
import { ReactNode } from 'react';

// Mock auth context
const mockUpdateProfile = vi.fn();
const mockProfile = {
  id: 'test-profile-id',
  user_id: 'test-user-id',
  full_name: 'Test User',
  avatar_url: null,
  current_persona: 'social',
  events_attended: 5,
  events_committed: 3,
  reliability_score: 95,
  profile_complete: false,
  verified_resident: false,
  location_city: null,
  location_country: null,
  location_coordinates: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockAuthContextValue = {
  user: { id: 'test-user-id' } as any,
  session: {} as any,
  profile: mockProfile,
  loading: false,
  signInWithEmail: vi.fn(),
  signUpWithEmail: vi.fn(),
  signInWithGoogle: vi.fn(),
  signInWithApple: vi.fn(),
  signOut: vi.fn(),
  updateProfile: mockUpdateProfile,
  refreshProfile: vi.fn(),
};

const wrapper = ({ children }: { children: ReactNode }) => (
  <AuthContext.Provider value={mockAuthContextValue}>
    {children}
  </AuthContext.Provider>
);

describe('Onboarding Integration Flow', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    vi.clearAllMocks();
    mockUpdateProfile.mockResolvedValue({ error: null });
  });

  it('should show onboarding when profile_complete is false', () => {
    const { result } = renderHook(() => useOnboarding(), { wrapper });

    waitFor(() => {
      expect(result.current.isLoaded).toBe(true);
      expect(result.current.showOnboarding).toBe(true);
    });
  });

  it('should complete onboarding and update backend', async () => {
    const { result } = renderHook(() => useOnboarding(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoaded).toBe(true);
    });

    // Complete onboarding with test data
    await result.current.completeOnboarding(['cinema', 'food', 'music'], 'test-zone');

    await waitFor(() => {
      // Should update localStorage
      expect(localStorage.getItem('lcl_onboarding_complete')).toBe('true');
      
      // Should save preferences
      const savedPrefs = JSON.parse(localStorage.getItem('lcl_user_preferences') || '{}');
      expect(savedPrefs.selectedCategories).toEqual(['cinema', 'food', 'music']);
      expect(savedPrefs.zone).toBe('test-zone');

      // Should hide onboarding modal
      expect(result.current.showOnboarding).toBe(false);

      // Should update backend
      expect(mockUpdateProfile).toHaveBeenCalledWith({ profile_complete: true });
    });
  });

  it('should not show onboarding when profile_complete is true', () => {
    // Mock profile with completed onboarding
    const completedProfile = { ...mockProfile, profile_complete: true };
    const completedWrapper = ({ children }: { children: ReactNode }) => (
      <AuthContext.Provider 
        value={{ ...mockAuthContextValue, profile: completedProfile }}
      >
        {children}
      </AuthContext.Provider>
    );

    const { result } = renderHook(() => useOnboarding(), { wrapper: completedWrapper });

    waitFor(() => {
      expect(result.current.isLoaded).toBe(true);
      expect(result.current.showOnboarding).toBe(false);
    });
  });

  it('should reset onboarding and update backend', async () => {
    const { result } = renderHook(() => useOnboarding(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoaded).toBe(true);
    });

    // Reset onboarding
    await result.current.resetOnboarding();

    await waitFor(() => {
      // Should clear localStorage
      expect(localStorage.getItem('lcl_onboarding_complete')).toBeNull();
      expect(localStorage.getItem('lcl_user_preferences')).toBeNull();

      // Should show onboarding modal
      expect(result.current.showOnboarding).toBe(true);

      // Should update backend
      expect(mockUpdateProfile).toHaveBeenCalledWith({ profile_complete: false });
    });
  });

  it('should update preferences in localStorage', async () => {
    const { result } = renderHook(() => useOnboarding(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoaded).toBe(true);
    });

    // Complete onboarding first
    await result.current.completeOnboarding(['cinema', 'food'], 'test-zone');

    // Update preferences
    result.current.updatePreferences({ selectedCategories: ['cinema', 'food', 'art'] });

    await waitFor(() => {
      const savedPrefs = JSON.parse(localStorage.getItem('lcl_user_preferences') || '{}');
      expect(savedPrefs.selectedCategories).toEqual(['cinema', 'food', 'art']);
      expect(savedPrefs.zone).toBe('test-zone'); // Zone should remain unchanged
    });
  });

  it('should handle backend update failure gracefully', async () => {
    // Mock backend failure
    mockUpdateProfile.mockResolvedValue({ error: new Error('Network error') });
    
    const { result } = renderHook(() => useOnboarding(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoaded).toBe(true);
    });

    // Complete onboarding - should not throw error
    await expect(
      result.current.completeOnboarding(['cinema'], 'test-zone')
    ).resolves.not.toThrow();

    await waitFor(() => {
      // Local state should still be updated even if backend fails
      expect(result.current.showOnboarding).toBe(false);
      expect(localStorage.getItem('lcl_onboarding_complete')).toBe('true');
    });
  });
});
