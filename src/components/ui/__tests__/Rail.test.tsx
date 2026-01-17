import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Rail } from '../Rail';

// Mock the useMotionPreset hook
vi.mock('@/hooks/useMotionPreset', () => ({
  useMotionPreset: vi.fn(() => ({
    slideUp: {
      initial: { opacity: 0, y: 20 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0.3 },
    },
  })),
}));

describe('Rail', () => {
  it('should render with overflow-x-visible to allow horizontal scrolling', () => {
    const { container } = render(
      <Rail title="Test Rail">
        <div>Test content</div>
      </Rail>
    );
    
    const section = container.querySelector('section');
    expect(section).toBeTruthy();
    expect(section?.className).toContain('overflow-x-visible');
  });

  it('should render title', () => {
    const { getByText } = render(
      <Rail title="My Rail">
        <div>Test content</div>
      </Rail>
    );
    
    expect(getByText('My Rail')).toBeTruthy();
  });

  it('should render children', () => {
    const { getByText } = render(
      <Rail title="Test">
        <div>Child content</div>
      </Rail>
    );
    
    expect(getByText('Child content')).toBeTruthy();
  });

  it('should render without title', () => {
    const { getByText, queryByRole } = render(
      <Rail>
        <div>Content only</div>
      </Rail>
    );
    
    expect(getByText('Content only')).toBeTruthy();
    expect(queryByRole('heading')).toBeNull();
  });
});