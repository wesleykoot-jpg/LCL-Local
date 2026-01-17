import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useMotionPreset } from '../useMotionPreset';

// Mock framer-motion's useReducedMotion
vi.mock('framer-motion', () => ({
  useReducedMotion: vi.fn(() => false),
}));

import { useReducedMotion } from 'framer-motion';

describe('useMotionPreset', () => {
  it('should return prefersReducedMotion as false by default', () => {
    const { result } = renderHook(() => useMotionPreset());
    expect(result.current.prefersReducedMotion).toBe(false);
  });

  it('should return prefersReducedMotion as true when enabled', () => {
    vi.mocked(useReducedMotion).mockReturnValue(true);
    const { result } = renderHook(() => useMotionPreset());
    expect(result.current.prefersReducedMotion).toBe(true);
    vi.mocked(useReducedMotion).mockReturnValue(false);
  });

  it('should return initial function that respects reduced motion', () => {
    const { result } = renderHook(() => useMotionPreset());
    const initialValue = { opacity: 0, y: 20 };
    expect(result.current.initial(initialValue)).toEqual(initialValue);
  });

  it('should return false for initial when reduced motion is preferred', () => {
    vi.mocked(useReducedMotion).mockReturnValue(true);
    const { result } = renderHook(() => useMotionPreset());
    const initialValue = { opacity: 0, y: 20 };
    expect(result.current.initial(initialValue)).toBe(false);
    vi.mocked(useReducedMotion).mockReturnValue(false);
  });

  it('should provide fadeIn animation preset', () => {
    const { result } = renderHook(() => useMotionPreset());
    expect(result.current.fadeIn).toHaveProperty('initial');
    expect(result.current.fadeIn).toHaveProperty('animate');
    expect(result.current.fadeIn).toHaveProperty('transition');
    expect(result.current.fadeIn.initial).toEqual({ opacity: 0 });
    expect(result.current.fadeIn.animate).toEqual({ opacity: 1 });
  });

  it('should provide slideUp animation preset', () => {
    const { result } = renderHook(() => useMotionPreset());
    expect(result.current.slideUp).toHaveProperty('initial');
    expect(result.current.slideUp).toHaveProperty('animate');
    expect(result.current.slideUp.initial).toEqual({ opacity: 0, y: 20 });
    expect(result.current.slideUp.animate).toEqual({ opacity: 1, y: 0 });
  });

  it('should provide scale animation preset', () => {
    const { result } = renderHook(() => useMotionPreset());
    expect(result.current.scale).toHaveProperty('initial');
    expect(result.current.scale).toHaveProperty('animate');
    expect(result.current.scale.initial).toEqual({ scale: 0.9, opacity: 0 });
    expect(result.current.scale.animate).toEqual({ scale: 1, opacity: 1 });
  });

  it('should return empty presets when reduced motion is preferred', () => {
    vi.mocked(useReducedMotion).mockReturnValue(true);
    const { result } = renderHook(() => useMotionPreset());
    expect(result.current.fadeIn).toEqual({});
    expect(result.current.slideUp).toEqual({});
    expect(result.current.scale).toEqual({});
    vi.mocked(useReducedMotion).mockReturnValue(false);
  });

  it('should provide staggerChildren function', () => {
    const { result } = renderHook(() => useMotionPreset());
    const staggered = result.current.staggerChildren(2, 0.1);
    expect(staggered).toHaveProperty('initial');
    expect(staggered).toHaveProperty('animate');
    expect(staggered).toHaveProperty('transition');
    expect(staggered.transition).toHaveProperty('delay', 0.2); // 2 * 0.1
  });

  it('should return empty object for staggerChildren when reduced motion', () => {
    vi.mocked(useReducedMotion).mockReturnValue(true);
    const { result } = renderHook(() => useMotionPreset());
    const staggered = result.current.staggerChildren(2);
    expect(staggered).toEqual({});
    vi.mocked(useReducedMotion).mockReturnValue(false);
  });

  it('should use default delay in staggerChildren', () => {
    const { result } = renderHook(() => useMotionPreset());
    const staggered = result.current.staggerChildren(3);
    expect(staggered.transition).toHaveProperty('delay', 0.3); // 3 * 0.1 (default)
  });
});
