import type { Preview } from '@storybook/react-vite';
import '../src/index.css';
import '../src/styles/io26-glass.css';

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'light',
      values: [
        {
          name: 'light',
          value: '#ffffff',
        },
        {
          name: 'dark',
          value: '#0a0a0a',
        },
      ],
    },
    viewport: {
      viewports: {
        iphone12: {
          name: 'iPhone 12/13 (390px)',
          styles: {
            width: '390px',
            height: '844px',
          },
          type: 'mobile',
        },
        iphone12mini: {
          name: 'iPhone 12 mini (375px)',
          styles: {
            width: '375px',
            height: '812px',
          },
          type: 'mobile',
        },
        iphone14pro: {
          name: 'iPhone 14 Pro (393px)',
          styles: {
            width: '393px',
            height: '852px',
          },
          type: 'mobile',
        },
        iphone14promax: {
          name: 'iPhone 14 Pro Max (430px)',
          styles: {
            width: '430px',
            height: '932px',
          },
          type: 'mobile',
        },
      },
      defaultViewport: 'iphone12',
    },
    a11y: {
      config: {
        rules: [
          {
            id: 'color-contrast',
            enabled: true,
          },
          {
            id: 'label',
            enabled: true,
          },
        ],
      },
    },
  },
};

export default preview;