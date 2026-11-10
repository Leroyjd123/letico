/**
 * /read — Reading home screen (Server Component wrapper)
 *
 * Delegates all data fetching and interactivity to ReadPageClient.
 */
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ReadPageClient } from './ReadPageClient';

export const metadata: Metadata = {
  title: 'read · lectio',
  description: 'your daily bible reading',
};

export default function ReadPage() {
  // useSearchParams (?day=N) requires a Suspense boundary for static rendering.
  return (
    <Suspense fallback={null}>
      <ReadPageClient />
    </Suspense>
  );
}
