import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { DiscoveryRail } from '../DiscoveryRail';

describe('DiscoveryRail', () => {
  it('should render with overflow-x-visible to allow horizontal scrolling', () => {
    const { container } = render(
      <DiscoveryRail title="Test Rail">
        <div>Test content</div>
      </DiscoveryRail>
    );
    
    const section = container.querySelector('section');
    expect(section).toBeTruthy();
    expect(section?.className).toContain('overflow-x-visible');
  });

  it('should render title', () => {
    const { getByText } = render(
      <DiscoveryRail title="My Events">
        <div>Test content</div>
      </DiscoveryRail>
    );
    
    expect(getByText('My Events')).toBeTruthy();
  });

  it('should render children', () => {
    const { getByText } = render(
      <DiscoveryRail title="Test">
        <div>Child content</div>
      </DiscoveryRail>
    );
    
    expect(getByText('Child content')).toBeTruthy();
  });
});
