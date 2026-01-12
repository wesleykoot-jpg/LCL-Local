/**
 * LocationContext
 * 
 * Provides app-wide access to user's current location state.
 * Handles permission management, location updates, and distance preferences.
 * 
 * Features:
 * - Global location state accessible from any component
 * - Automatic location updates when user moves
 * - Distance radius preference for event filtering
 * - Permission state management with UI hints
 */

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { useGeolocation, type UserLocation, type LocationPermissionState } from '@/hooks/useGeolocation';
import { MEPPEL_CENTER } from '@/lib/distance';

// Storage key for persisted preferences
const LOCATION_PREFS_KEY = 'lcl_location_preferences';

export interface LocationPreferences {
  /** Distance radius in kilometers for filtering events */
  radiusKm: number;
  /** Whether to use GPS location or manual zone */
  useGPS: boolean;
  /** User's manually set zone name (e.g., "Meppel") */
  manualZone: string;
  /** User's manually set coordinates (when GPS is disabled) */
  manualCoordinates: UserLocation | null;
}

export interface LocationContextType {
  /** Current user location (GPS or manual) */
  location: UserLocation;
  /** Whether location is being fetched */
  isLoading: boolean;
  /** Any error that occurred */
  error: string | null;
  /** Current permission state */
  permissionState: LocationPermissionState;
  /** Whether running on native platform */
  isNative: boolean;
  /** User preferences for location */
  preferences: LocationPreferences;
  /** Request location permission from user */
  requestPermission: () => Promise<boolean>;
  /** Refresh current location */
  refreshLocation: () => Promise<void>;
  /** Update location preferences */
  updatePreferences: (updates: Partial<LocationPreferences>) => void;
  /** Set a manual zone (disables GPS) */
  setManualZone: (zone: string, coordinates?: UserLocation) => void;
  /** Enable GPS-based location */
  enableGPS: () => Promise<boolean>;
}

const defaultPreferences: LocationPreferences = {
  radiusKm: 25, // Default 25km radius
  useGPS: true,
  manualZone: 'Meppel, NL',
  manualCoordinates: MEPPEL_CENTER,
};

const LocationContext = createContext<LocationContextType | undefined>(undefined);

/**
 * Load persisted preferences from localStorage
 */
function loadPersistedPreferences(): LocationPreferences {
  try {
    const stored = localStorage.getItem(LOCATION_PREFS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...defaultPreferences, ...parsed };
    }
  } catch (error) {
    console.warn('[LocationContext] Failed to load preferences:', error);
  }
  return defaultPreferences;
}

/**
 * Save preferences to localStorage
 */
function persistPreferences(preferences: LocationPreferences): void {
  try {
    localStorage.setItem(LOCATION_PREFS_KEY, JSON.stringify(preferences));
  } catch (error) {
    console.warn('[LocationContext] Failed to save preferences:', error);
  }
}

export function LocationProvider({ children }: { children: React.ReactNode }) {
  // Load initial preferences from storage
  const [preferences, setPreferences] = useState<LocationPreferences>(loadPersistedPreferences);
  
  // Use the geolocation hook with watching enabled when GPS is preferred
  const {
    location: gpsLocation,
    isLoading,
    error,
    permissionState,
    isNative,
    requestPermission: requestGeoPermission,
    getCurrentPosition,
    refresh,
  } = useGeolocation({
    enableWatch: preferences.useGPS && permissionState === 'granted',
    enableHighAccuracy: true,
    maximumAge: 30000, // 30 seconds
    timeout: 15000, // 15 seconds
  });

  // Determine which location to use (GPS or manual)
  const effectiveLocation = useMemo((): UserLocation => {
    if (preferences.useGPS && permissionState === 'granted') {
      return gpsLocation;
    }
    return preferences.manualCoordinates || MEPPEL_CENTER;
  }, [preferences.useGPS, preferences.manualCoordinates, gpsLocation, permissionState]);

  /**
   * Request location permission
   */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    const granted = await requestGeoPermission();
    
    if (granted) {
      // Enable GPS mode on successful permission
      setPreferences(prev => {
        const updated = { ...prev, useGPS: true };
        persistPreferences(updated);
        return updated;
      });
    }
    
    return granted;
  }, [requestGeoPermission]);

  /**
   * Refresh the current location
   */
  const refreshLocation = useCallback(async () => {
    if (preferences.useGPS) {
      await refresh();
    }
  }, [preferences.useGPS, refresh]);

  /**
   * Update location preferences
   */
  const updatePreferences = useCallback((updates: Partial<LocationPreferences>) => {
    setPreferences(prev => {
      const updated = { ...prev, ...updates };
      persistPreferences(updated);
      return updated;
    });
  }, []);

  /**
   * Set a manual zone (disables GPS-based location)
   */
  const setManualZone = useCallback((zone: string, coordinates?: UserLocation) => {
    setPreferences(prev => {
      const updated = {
        ...prev,
        useGPS: false,
        manualZone: zone,
        manualCoordinates: coordinates || prev.manualCoordinates,
      };
      persistPreferences(updated);
      return updated;
    });
  }, []);

  /**
   * Enable GPS-based location
   */
  const enableGPS = useCallback(async (): Promise<boolean> => {
    if (permissionState === 'granted') {
      setPreferences(prev => {
        const updated = { ...prev, useGPS: true };
        persistPreferences(updated);
        return updated;
      });
      await refresh();
      return true;
    } else if (permissionState === 'prompt' || permissionState === 'unknown') {
      const granted = await requestPermission();
      if (granted) {
        await getCurrentPosition();
      }
      return granted;
    }
    return false;
  }, [permissionState, requestPermission, refresh, getCurrentPosition]);

  const value: LocationContextType = useMemo(() => ({
    location: effectiveLocation,
    isLoading,
    error,
    permissionState,
    isNative,
    preferences,
    requestPermission,
    refreshLocation,
    updatePreferences,
    setManualZone,
    enableGPS,
  }), [
    effectiveLocation,
    isLoading,
    error,
    permissionState,
    isNative,
    preferences,
    requestPermission,
    refreshLocation,
    updatePreferences,
    setManualZone,
    enableGPS,
  ]);

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
}

/**
 * Hook to access location context
 */
export function useLocation(): LocationContextType {
  const context = useContext(LocationContext);
  
  if (context === undefined) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  
  return context;
}
