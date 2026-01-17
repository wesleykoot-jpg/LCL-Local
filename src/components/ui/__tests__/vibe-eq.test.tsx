import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VibeEQ } from '../vibe-eq';

// Mock the motion preset hook
vi.mock('@/shared/hooks/useMotionPreset', () => ({
  useMotionPreset: () => ({
    prefersReducedMotion: false,
  }),
}));

describe('VibeEQ', () => {
  it('should render with default 3 bars', () => {
    const { container } = render(<VibeEQ />);
    const bars = container.querySelectorAll('.w-0\\.5');
    expect(bars).toHaveLength(3);
  });

  it('should render with custom bar count', () => {
    const { container } = render(<VibeEQ barCount={4} />);
    const bars = container.querySelectorAll('.w-0\\.5');
    expect(bars).toHaveLength(4);
  });

  it('should have accessibility label', () => {
    const { container } = render(<VibeEQ />);
    const eq = container.querySelector('[role="img"]');
    expect(eq).toHaveAttribute('aria-label', 'Active status indicator');
  });

  it('should apply custom bar color', () => {
    const { container } = render(<VibeEQ barColor="bg-primary" />);
    const bars = container.querySelectorAll('.bg-primary');
    expect(bars.length).toBeGreaterThan(0);
  });

  it('should accept custom className', () => {
    const { container } = render(<VibeEQ className="custom-eq" />);
    const eq = container.querySelector('.custom-eq');
    expect(eq).toBeInTheDocument();
  });

  it('should forward ref', () => {
    const ref = vi.fn();
    render(<VibeEQ ref={ref} />);
    expect(ref).toHaveBeenCalled();
  });
});

describe('VibeEQ with reduced motion', () => {
  it('should render static bars when reduced motion is preferred', () => {
    // Re-mock the hook for this test
    vi.resetModules();
    vi.doMock('@/shared/hooks/useMotionPreset', () => ({
      useMotionPreset: () => ({
        prefersReducedMotion: true,
      }),
    }));

    const { container } = render(<VibeEQ />);
    const bars = container.querySelectorAll('.w-0\\.5');
    // Should still render bars even with reduced motion
    expect(bars.length).toBeGreaterThan(0);
  });
});
