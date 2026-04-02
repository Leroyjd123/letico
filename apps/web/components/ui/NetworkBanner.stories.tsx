import type { Meta } from '@storybook/react';

const meta = {
  title: 'UI/NetworkBanner',
};
export default meta;

// Static representation — the real component auto-hides when online
export const Offline = {
  render: () => (
    <div
      role="status"
      style={{
        backgroundColor: 'var(--color-primary)',
        color: 'var(--color-on-primary)',
        textAlign: 'center',
        padding: '0.5rem 1rem',
        fontFamily: 'var(--font-headline)',
        fontSize: '0.8125rem',
        textTransform: 'lowercase',
      }}
    >
      you&apos;re offline — your reads are saved locally
    </div>
  ),
};
