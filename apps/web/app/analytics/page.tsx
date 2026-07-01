import type { Metadata } from 'next';
import { AnalyticsPageClient } from './AnalyticsPageClient';

export const metadata: Metadata = {
  title: 'analytics · lectio',
  description: 'your reading history at a glance',
};

export default function AnalyticsPage() {
  return (
    <main
      style={{
        maxWidth: '48rem',
        margin: '0 auto',
        padding: 'var(--space-6) var(--space-6) 6rem var(--space-6)',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <AnalyticsPageClient />
    </main>
  );
}
