import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HeroCard } from '../hero-card';

// Mock the motion preset hook
vi.mock('@/shared/hooks/useMotionPreset', () => ({
  useMotionPreset: () => ({
    scaleIn: () => ({}),
    prefersReducedMotion: false,
  }),
}));

describe('HeroCard', () => {
  it('should render children', () => {
    render(
      <HeroCard>
        <div>Test Content</div>
      </HeroCard>
    );
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('should apply default aspect ratio', () => {
    const { container } = render(<HeroCard>Content</HeroCard>);
    const card = container.querySelector('.rounded-2xl');
    expect(card).toHaveStyle({ aspectRatio: '1.58 / 1' });
  });

  it('should apply custom aspect ratio', () => {
    const { container } = render(
      <HeroCard aspectRatio="16 / 9">Content</HeroCard>
    );
    const card = container.querySelector('.rounded-2xl');
    expect(card).toHaveStyle({ aspectRatio: '16 / 9' });
  });

  it('should render holographic sheen when enabled', () => {
    const { container } = render(
      <HeroCard enableHolographicSheen>Content</HeroCard>
    );
    const sheen = container.querySelector('.pointer-events-none');
    expect(sheen).toBeInTheDocument();
  });

  it('should render with tilt when enabled', () => {
    const tilt = { tiltX: 5, tiltY: 3, glintOpacity: 0.5 };
    render(
      <HeroCard enableTilt tilt={tilt}>
        Content
      </HeroCard>
    );
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <HeroCard className="custom-hero">Content</HeroCard>
    );
    const card = container.querySelector('.custom-hero');
    expect(card).toBeInTheDocument();
  });

  it('should forward ref', () => {
    const ref = vi.fn();
    render(<HeroCard ref={ref}>Content</HeroCard>);
    expect(ref).toHaveBeenCalled();
  });
});
