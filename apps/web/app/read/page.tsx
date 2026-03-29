/**
 * /read — Reading home screen (Server Component wrapper)
 *
 * Delegates all data fetching and interactivity to ReadPageClient.
 * Server-side session handling is deferred to Phase 5.
 */
import type { Metadata } from 'next';
import { ReadPageClient } from './ReadPageClient';

export const metadata: Metadata = {
  title: 'read · lectio',
  description: 'your daily bible reading',
};

export default function ReadPage() {
  return <ReadPageClient />;
}
