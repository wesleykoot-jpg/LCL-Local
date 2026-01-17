import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Rail, RailItem } from '../rail';

// Mock the motion preset hook
vi.mock('@/shared/hooks/useMotionPreset', () => ({
  useMotionPreset: () => ({
    slideUp: () => ({}),
  }),
}));

describe('Rail', () => {
  it('should render children', () => {
    render(
      <Rail>
        <div>Item 1</div>
        <div>Item 2</div>
      </Rail>
    );
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
  });

  it('should render with title', () => {
    render(<Rail title="Featured Events">Content</Rail>);
    expect(screen.getByText('Featured Events')).toBeInTheDocument();
  });

  it('should render with title and subtitle', () => {
    render(
      <Rail title="Categories" subtitle="Browse by interest">
        Content
      </Rail>
    );
    expect(screen.getByText('Categories')).toBeInTheDocument();
    expect(screen.getByText('Browse by interest')).toBeInTheDocument();
  });

  it('should apply scrollable class when scrollable is true', () => {
    const { container } = render(<Rail scrollable>Content</Rail>);
    const scrollContainer = container.querySelector('.overflow-x-auto');
    expect(scrollContainer).toBeInTheDocument();
  });

  it('should not apply scrollable class by default', () => {
    const { container } = render(<Rail>Content</Rail>);
    const scrollContainer = container.querySelector('.overflow-x-auto');
    expect(scrollContainer).not.toBeInTheDocument();
  });

  it('should accept custom className', () => {
    const { container } = render(<Rail className="custom-rail">Content</Rail>);
    const rail = container.querySelector('.custom-rail');
    expect(rail).toBeInTheDocument();
  });

  it('should forward ref', () => {
    const ref = vi.fn();
    render(<Rail ref={ref}>Content</Rail>);
    expect(ref).toHaveBeenCalled();
  });
});

describe('RailItem', () => {
  it('should render children', () => {
    render(<RailItem>Item Content</RailItem>);
    expect(screen.getByText('Item Content')).toBeInTheDocument();
  });

  it('should apply custom width', () => {
    const { container } = render(<RailItem width="200px">Content</RailItem>);
    const item = container.querySelector('[style*="width"]');
    expect(item).toHaveStyle({ width: '200px' });
  });

  it('should apply snap-start class by default', () => {
    const { container } = render(<RailItem>Content</RailItem>);
    const item = container.querySelector('.snap-start');
    expect(item).toBeInTheDocument();
  });

  it('should not apply snap-start when snapScroll is false', () => {
    const { container } = render(<RailItem snapScroll={false}>Content</RailItem>);
    const item = container.querySelector('.snap-start');
    expect(item).not.toBeInTheDocument();
  });

  it('should accept custom className', () => {
    const { container } = render(<RailItem className="custom-item">Content</RailItem>);
    const item = container.querySelector('.custom-item');
    expect(item).toBeInTheDocument();
  });

  it('should forward ref', () => {
    const ref = vi.fn();
    render(<RailItem ref={ref}>Content</RailItem>);
    expect(ref).toHaveBeenCalled();
  });
});
