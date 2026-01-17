import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PersonaPill } from '../persona-pill';

// Mock the motion preset hook
vi.mock('@/shared/hooks/useMotionPreset', () => ({
  useMotionPreset: () => ({
    slideUp: () => ({}),
    prefersReducedMotion: false,
  }),
}));

describe('PersonaPill', () => {
  it('should render with label', () => {
    render(<PersonaPill label="Foodie" />);
    expect(screen.getByText('Foodie')).toBeInTheDocument();
  });

  it('should apply default variant styles', () => {
    render(<PersonaPill label="Art Lover" />);
    const pill = screen.getByText('Art Lover');
    expect(pill).toHaveClass('bg-white/20', 'border-white/30', 'text-white');
  });

  it('should apply primary variant styles', () => {
    render(<PersonaPill label="Nightlife" variant="primary" />);
    const pill = screen.getByText('Nightlife');
    expect(pill).toHaveClass('bg-primary/20', 'border-primary/30', 'text-primary');
  });

  it('should apply secondary variant styles', () => {
    render(<PersonaPill label="Sports" variant="secondary" />);
    const pill = screen.getByText('Sports');
    expect(pill).toHaveClass('bg-secondary/20', 'border-secondary/30', 'text-secondary');
  });

  it('should accept custom className', () => {
    render(<PersonaPill label="Gaming" className="custom-class" />);
    const pill = screen.getByText('Gaming');
    expect(pill).toHaveClass('custom-class');
  });

  it('should render with animation index', () => {
    render(<PersonaPill label="Music" animationIndex={2} />);
    expect(screen.getByText('Music')).toBeInTheDocument();
  });

  it('should forward ref', () => {
    const ref = vi.fn();
    render(<PersonaPill ref={ref} label="Test" />);
    expect(ref).toHaveBeenCalled();
  });
});
