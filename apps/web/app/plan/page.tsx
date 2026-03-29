/**
 * /plan — 365-day reading plan list (Server Component wrapper)
 *
 * No server-side data fetching — plan data is user-specific and
 * fetched client-side via React Query with auth context.
 */
import type { Metadata } from 'next';
import { PlanPageClient } from './PlanPageClient';

export const metadata: Metadata = {
  title: 'plan · lectio',
  description: 'your 1-year bible reading plan',
};

export default function PlanPage() {
  return <PlanPageClient />;
}
