/**
 * useDeviceTilt Hook
 * 
 * Implements a deviceorientation listener that maps gamma and beta angles
 * to global CSS variables for IO26 Spatial Motion Integration.
 * 
 * Updates:
 * - --device-tilt-x: Horizontal tilt (gamma, -45 to 45 degrees)
 * - --device-tilt-y: Vertical tilt (beta, -45 to 45 degrees)
 * - --glint-opacity: Specular glint intensity based on movement
 */

import { useEffect, useRef, useCallback, useState } from 'react';

export interface DeviceTiltState {
  /** Horizontal tilt angle (-45 to 45) */
  tiltX: number;
  /** Vertical tilt angle (-45 to 45) */
  tiltY: number;
  /** Specular glint opacity (0 to 1) */
  glintOpacity: number;
  /** Whether device orientation is supported */
  isSupported: boolean;
  /** Whether permission was granted (iOS 13+) */
  hasPermission: boolean;
}

export interface UseDeviceTiltOptions {
  /** Sensitivity multiplier (default: 1) */
  sensitivity?: number;
  /** Maximum tilt angle to consider (default: 45) */
  maxTilt?: number;
  /** Smoothing factor for values (0-1, default: 0.15) */
  smoothing?: number;
  /** Whether to enable the listener (default: true) */
  enabled?: boolean;
}

/**
 * Clamp a value between min and max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Linear interpolation for smooth transitions
 */
function lerp(current: number, target: number, factor: number): number {
  return current + (target - current) * factor;
}

export function useDeviceTilt(options: UseDeviceTiltOptions = {}): DeviceTiltState {
  const {
    sensitivity = 1,
    maxTilt = 45,
    smoothing = 0.15,
    enabled = true,
  } = options;

  const [state, setState] = useState<DeviceTiltState>({
    tiltX: 0,
    tiltY: 0,
    glintOpacity: 0,
    isSupported: false,
    hasPermission: false,
  });

  // Store current smoothed values
  const currentValues = useRef({ tiltX: 0, tiltY: 0, glintOpacity: 0 });
  const animationFrameRef = useRef<number | null>(null);
  const targetValues = useRef({ gamma: 0, beta: 0 });

  /**
   * Update CSS custom properties on document root
   */
  const updateCSSVariables = useCallback((tiltX: number, tiltY: number, glintOpacity: number) => {
    const root = document.documentElement;
    root.style.setProperty('--device-tilt-x', String(tiltX));
    root.style.setProperty('--device-tilt-y', String(tiltY));
    root.style.setProperty('--glint-opacity', String(glintOpacity));
  }, []);

  /**
   * Animation loop for smooth value transitions
   */
  const animate = useCallback(() => {
    const { gamma, beta } = targetValues.current;
    const current = currentValues.current;

    // Clamp and scale the tilt values
    const targetTiltX = clamp(gamma * sensitivity, -maxTilt, maxTilt);
    const targetTiltY = clamp(beta * sensitivity, -maxTilt, maxTilt);

    // Calculate glint opacity based on movement intensity
    const movementIntensity = Math.sqrt(targetTiltX ** 2 + targetTiltY ** 2) / maxTilt;
    const targetGlintOpacity = clamp(movementIntensity * 0.3, 0, 0.3);

    // Smooth interpolation
    current.tiltX = lerp(current.tiltX, targetTiltX, smoothing);
    current.tiltY = lerp(current.tiltY, targetTiltY, smoothing);
    current.glintOpacity = lerp(current.glintOpacity, targetGlintOpacity, smoothing);

    // Update CSS variables
    updateCSSVariables(current.tiltX, current.tiltY, current.glintOpacity);

    // Update state (throttled to reduce re-renders)
    setState(prev => {
      if (
        Math.abs(prev.tiltX - current.tiltX) > 0.5 ||
        Math.abs(prev.tiltY - current.tiltY) > 0.5 ||
        Math.abs(prev.glintOpacity - current.glintOpacity) > 0.01
      ) {
        return {
          ...prev,
          tiltX: current.tiltX,
          tiltY: current.tiltY,
          glintOpacity: current.glintOpacity,
        };
      }
      return prev;
    });

    animationFrameRef.current = requestAnimationFrame(animate);
  }, [sensitivity, maxTilt, smoothing, updateCSSVariables]);

  /**
   * Handle device orientation events
   */
  const handleOrientation = useCallback((event: DeviceOrientationEvent) => {
    // gamma: left-to-right tilt (-90 to 90)
    // beta: front-to-back tilt (-180 to 180)
    targetValues.current = {
      gamma: event.gamma ?? 0,
      beta: event.beta ?? 0,
    };
  }, []);

  /**
   * Request permission for device orientation (iOS 13+)
   */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    // Check if DeviceOrientationEvent.requestPermission exists (iOS 13+)
    // This is a Safari-specific API that doesn't exist in the standard TypeScript DOM types
    if (
      typeof DeviceOrientationEvent !== 'undefined' &&
      'requestPermission' in DeviceOrientationEvent &&
      typeof (DeviceOrientationEvent as { requestPermission?: () => Promise<string> }).requestPermission === 'function'
    ) {
      try {
        const permission = await (DeviceOrientationEvent as { requestPermission: () => Promise<string> }).requestPermission();
        return permission === 'granted';
      } catch (error) {
        console.warn('[useDeviceTilt] Permission request failed:', error);
        return false;
      }
    }

    // No permission required (Android or older iOS)
    return true;
  }, []);

  useEffect(() => {
    if (!enabled) {
      // Reset CSS variables when disabled
      updateCSSVariables(0, 0, 0);
      return;
    }

    // Check if device orientation is supported
    const isSupported = 'DeviceOrientationEvent' in window;
    
    if (!isSupported) {
      setState(prev => ({ ...prev, isSupported: false }));
      return;
    }

    setState(prev => ({ ...prev, isSupported: true }));

    // Setup device orientation listener
    const setupListener = async () => {
      const hasPermission = await requestPermission();
      setState(prev => ({ ...prev, hasPermission }));

      if (hasPermission) {
        window.addEventListener('deviceorientation', handleOrientation, true);
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    setupListener();

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation, true);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      // Reset CSS variables on cleanup
      updateCSSVariables(0, 0, 0);
    };
  }, [enabled, handleOrientation, animate, requestPermission, updateCSSVariables]);

  return state;
}

export default useDeviceTilt;
