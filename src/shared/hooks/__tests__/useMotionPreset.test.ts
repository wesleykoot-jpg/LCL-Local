import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMotionPreset } from '../useMotionPreset';
import * as FramerMotion from 'framer-motion';

// Mock framer-motion
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion');
  return {
    ...actual,
    useReducedMotion: vi.fn(),
  };
});

describe('useMotionPreset', () => {
  it('should return animation presets when reduced motion is disabled', () => {
    vi.mocked(FramerMotion.useReducedMotion).mockReturnValue(false);
    
    const { result } = renderHook(() => useMotionPreset());
    
    expect(result.current.prefersReducedMotion).toBe(false);
    expect(result.current.fadeIn).toBeDefined();
    expect(result.current.slideUp).toBeDefined();
    expect(result.current.scaleIn).toBeDefined();
  });

  it('should return minimal animations when reduced motion is preferred', () => {
    vi.mocked(FramerMotion.useReducedMotion).mockReturnValue(true);
    
    const { result } = renderHook(() => useMotionPreset());
    
    expect(result.current.prefersReducedMotion).toBe(true);
    
    // Test fadeIn preset with reduced motion
    const fadeIn = result.current.fadeIn();
    expect(fadeIn.initial).toBe(false);
    expect(fadeIn.animate).toEqual({ opacity: 1 });
  });

  it('should apply custom delay to fadeIn preset', () => {
    vi.mocked(FramerMotion.useReducedMotion).mockReturnValue(false);
    
    const { result } = renderHook(() => useMotionPreset());
    const fadeIn = result.current.fadeIn({ delay: 0.5 });
    
    expect(fadeIn.transition?.delay).toBe(0.5);
  });

  it('should apply custom duration to slideUp preset', () => {
    vi.mocked(FramerMotion.useReducedMotion).mockReturnValue(false);
    
    const { result } = renderHook(() => useMotionPreset());
    const slideUp = result.current.slideUp({ duration: 1.0 });
    
    expect(slideUp.transition?.duration).toBe(1.0);
  });

  it('should provide all expected motion presets', () => {
    vi.mocked(FramerMotion.useReducedMotion).mockReturnValue(false);
    
    const { result } = renderHook(() => useMotionPreset());
    
    expect(result.current.fadeIn).toBeTypeOf('function');
    expect(result.current.slideUp).toBeTypeOf('function');
    expect(result.current.slideDown).toBeTypeOf('function');
    expect(result.current.slideLeft).toBeTypeOf('function');
    expect(result.current.slideRight).toBeTypeOf('function');
    expect(result.current.scaleIn).toBeTypeOf('function');
    expect(result.current.staggerChildren).toBeTypeOf('function');
  });

  it('should return consistent results when called multiple times', () => {
    vi.mocked(FramerMotion.useReducedMotion).mockReturnValue(false);
    
    const { result, rerender } = renderHook(() => useMotionPreset());
    const firstResult = result.current;
    
    rerender();
    
    expect(result.current).toBe(firstResult); // Same object reference due to useMemo
  });
});
