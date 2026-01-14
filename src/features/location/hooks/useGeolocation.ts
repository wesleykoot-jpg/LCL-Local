/**
 * useGeolocation Hook
 * 
 * A React hook that provides access to the user's current location
 * using Capacitor's Geolocation plugin (for iOS) with web fallback.
 * 
 * Features:
 * - iOS location services integration via Capacitor
 * - Web Geolocation API fallback for browser testing
 * - Automatic position watching for real-time updates
 * - Permission state management
 * - Graceful error handling (no default location)
 */

import { useState, useEffect, useCallback } from 'react';
import { Geolocation, Position, PermissionStatus } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

export interface UserLocation {
  lat: number;
  lng: number;
  accuracy?: number;
  timestamp?: number;
}

export type LocationPermissionState = 'prompt' | 'granted' | 'denied' | 'unknown';

export interface GeolocationState {
  /** Current user location, null if not yet obtained or unavailable */
  location: UserLocation | null;
  isLoading: boolean;
  error: string | null;
  permissionState: LocationPermissionState;
  isNative: boolean;
}

export interface UseGeolocationOptions {
  /** Enable continuous position watching */
  enableWatch?: boolean;
  /** High accuracy mode (uses GPS on mobile) */
  enableHighAccuracy?: boolean;
  /** Maximum age of cached position in ms */
  maximumAge?: number;
  /** Timeout for position request in ms */
  timeout?: number;
}

const DEFAULT_OPTIONS: UseGeolocationOptions = {
  enableWatch: false,
  enableHighAccuracy: true,
  maximumAge: 30000, // 30 seconds
  timeout: 15000, // 15 seconds
};

/**
 * Hook to access user's geolocation with iOS support via Capacitor
 */
export function useGeolocation(options: UseGeolocationOptions = {}) {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  
  const [state, setState] = useState<GeolocationState>({
    location: null, // No default location - user must enable GPS or set manually
    isLoading: true,
    error: null,
    permissionState: 'unknown',
    isNative: Capacitor.isNativePlatform(),
  });

  /**
   * Check current permission state
   */
  const checkPermissions = useCallback(async (): Promise<LocationPermissionState> => {
    try {
      const status: PermissionStatus = await Geolocation.checkPermissions();
      
      // Capacitor returns 'prompt' | 'granted' | 'denied' for location
      if (status.location === 'granted' || status.coarseLocation === 'granted') {
        return 'granted';
      } else if (status.location === 'denied') {
        return 'denied';
      } else {
        return 'prompt';
      }
    } catch (error) {
      console.warn('[Geolocation] Permission check failed:', error);
      return 'unknown';
    }
  }, []);

  /**
   * Request location permissions
   */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const status = await Geolocation.requestPermissions();
      const granted = status.location === 'granted' || status.coarseLocation === 'granted';
      
      setState(prev => ({
        ...prev,
        permissionState: granted ? 'granted' : 'denied',
      }));
      
      return granted;
    } catch (error) {
      console.error('[Geolocation] Permission request failed:', error);
      setState(prev => ({
        ...prev,
        permissionState: 'denied',
        error: 'Failed to request location permission',
      }));
      return false;
    }
  }, []);

  /**
   * Get current position (one-time)
   */
  const getCurrentPosition = useCallback(async (): Promise<UserLocation | null> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const position: Position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: mergedOptions.enableHighAccuracy,
        maximumAge: mergedOptions.maximumAge,
        timeout: mergedOptions.timeout,
      });
      
      const newLocation: UserLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp,
      };
      
      setState(prev => ({
        ...prev,
        location: newLocation,
        isLoading: false,
        error: null,
        permissionState: 'granted',
      }));
      
      return newLocation;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get location';
      console.warn('[Geolocation] Get position failed:', errorMessage);
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      
      return null;
    }
  }, [mergedOptions.enableHighAccuracy, mergedOptions.maximumAge, mergedOptions.timeout]);

  /**
   * Start watching position for continuous updates
   */
  const startWatching = useCallback(async (): Promise<string | null> => {
    try {
      const watchId = await Geolocation.watchPosition(
        {
          enableHighAccuracy: mergedOptions.enableHighAccuracy,
          maximumAge: mergedOptions.maximumAge,
          timeout: mergedOptions.timeout,
        },
        (position, err) => {
          if (err) {
            console.warn('[Geolocation] Watch error:', err);
            setState(prev => ({
              ...prev,
              error: err.message,
            }));
            return;
          }
          
          if (position) {
            const newLocation: UserLocation = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              accuracy: position.coords.accuracy,
              timestamp: position.timestamp,
            };
            
            setState(prev => ({
              ...prev,
              location: newLocation,
              isLoading: false,
              error: null,
              permissionState: 'granted',
            }));
          }
        }
      );
      
      return watchId;
    } catch (error) {
      console.error('[Geolocation] Watch failed:', error);
      return null;
    }
  }, [mergedOptions.enableHighAccuracy, mergedOptions.maximumAge, mergedOptions.timeout]);

  /**
   * Stop watching position
   */
  const stopWatching = useCallback(async (watchId: string) => {
    try {
      await Geolocation.clearWatch({ id: watchId });
    } catch (error) {
      console.warn('[Geolocation] Clear watch failed:', error);
    }
  }, []);

  /**
   * Refresh current position
   */
  const refresh = useCallback(async () => {
    const permissionState = await checkPermissions();
    
    if (permissionState === 'granted') {
      await getCurrentPosition();
    } else if (permissionState === 'prompt') {
      const granted = await requestPermission();
      if (granted) {
        await getCurrentPosition();
      }
    } else {
      setState(prev => ({
        ...prev,
        isLoading: false,
        permissionState: 'denied',
        error: 'Location permission denied',
      }));
    }
  }, [checkPermissions, getCurrentPosition, requestPermission]);

  // Initialize on mount
  useEffect(() => {
    let watchId: string | null = null;
    let mounted = true;

    const init = async () => {
      const permissionState = await checkPermissions();
      
      if (!mounted) return;
      
      setState(prev => ({ ...prev, permissionState }));
      
      if (permissionState === 'granted') {
        await getCurrentPosition();
        
        if (mergedOptions.enableWatch && mounted) {
          watchId = await startWatching();
        }
      } else {
        setState(prev => ({
          ...prev,
          isLoading: false,
        }));
      }
    };

    init();

    return () => {
      mounted = false;
      if (watchId) {
        stopWatching(watchId);
      }
    };
  }, [checkPermissions, getCurrentPosition, startWatching, stopWatching, mergedOptions.enableWatch]);

  return {
    ...state,
    requestPermission,
    getCurrentPosition,
    startWatching,
    stopWatching,
    refresh,
  };
}
