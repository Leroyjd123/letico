import type { Preview } from '@storybook/react';
import { buildCssTokenString } from '@lectio/types/tokens';
import '../app/globals.css';

const cssTokens = buildCssTokenString();

const preview: Preview = {
  decorators: [
    (Story) => {
      if (typeof document !== 'undefined') {
        let styleEl = document.getElementById('lectio-tokens');
        if (!styleEl) {
          styleEl = document.createElement('style');
          styleEl.id = 'lectio-tokens';
          document.head.appendChild(styleEl);
        }
        styleEl.innerHTML = `:root { ${cssTokens} }`;
      }
      return Story();
    },
  ],
  parameters: {
    backgrounds: {
      default: 'lectio',
      values: [{ name: 'lectio', value: '#faf9f6' }],
    },
    layout: 'padded',
  },
};

export default preview;
