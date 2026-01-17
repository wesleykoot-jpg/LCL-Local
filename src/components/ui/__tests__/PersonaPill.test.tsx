import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PersonaPill } from '../PersonaPill';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

// Mock useMotionPreset
vi.mock('@/hooks/useMotionPreset', () => ({
  useMotionPreset: () => ({
    prefersReducedMotion: false,
    initial: (value: any) => value,
    staggerChildren: () => ({}),
  }),
}));

describe('PersonaPill', () => {
  it('should render with label', () => {
    render(<PersonaPill label="Foodie" />);
    expect(screen.getByText('Foodie')).toBeDefined();
  });

  it('should apply default glass variant styles', () => {
    const { container } = render(<PersonaPill label="Nightlife" />);
    const pill = container.firstChild as HTMLElement;
    expect(pill.className).toContain('bg-white/20');
    expect(pill.className).toContain('backdrop-blur-sm');
    expect(pill.className).toContain('border-white/30');
  });

  it('should apply solid variant styles', () => {
    const { container } = render(<PersonaPill label="Art" variant="solid" />);
    const pill = container.firstChild as HTMLElement;
    expect(pill.className).toContain('bg-primary');
    expect(pill.className).toContain('text-primary-foreground');
  });

  it('should apply default variant styles', () => {
    const { container } = render(<PersonaPill label="Music" variant="default" />);
    const pill = container.firstChild as HTMLElement;
    expect(pill.className).toContain('bg-white/10');
    expect(pill.className).toContain('border-white/20');
  });

  it('should apply small size styles', () => {
    const { container } = render(<PersonaPill label="Gaming" size="sm" />);
    const pill = container.firstChild as HTMLElement;
    expect(pill.className).toContain('px-2');
    expect(pill.className).toContain('py-1');
    expect(pill.className).toContain('text-xs');
  });

  it('should apply large size styles', () => {
    const { container } = render(<PersonaPill label="Sports" size="lg" />);
    const pill = container.firstChild as HTMLElement;
    expect(pill.className).toContain('px-4');
    expect(pill.className).toContain('py-2');
    expect(pill.className).toContain('text-sm');
  });

  it('should apply custom className', () => {
    const { container } = render(
      <PersonaPill label="Travel" className="custom-class" />
    );
    const pill = container.firstChild as HTMLElement;
    expect(pill.className).toContain('custom-class');
  });

  it('should accept index prop for animations', () => {
    // Should not throw error when index is provided
    expect(() => {
      render(<PersonaPill label="Wellness" index={2} />);
    }).not.toThrow();
  });
});
