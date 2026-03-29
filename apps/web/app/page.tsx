/**
 * page.tsx — root page (/)
 *
 * Phase 1: Token smoke-test — confirms CSS tokens are injected correctly.
 * Phase 2: Will redirect to /read.
 */
import { redirect } from 'next/navigation';

export default function RootPage() {
  redirect('/read');
}
