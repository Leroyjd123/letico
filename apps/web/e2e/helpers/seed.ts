/**
 * seed.ts — Test database helpers
 *
 * Clears test user state in Supabase before each journey.
 * Requires SUPABASE_TEST_URL and SUPABASE_SERVICE_ROLE_KEY env vars.
 *
 * Not run during normal unit tests — only for E2E journeys.
 */
import { createClient } from '@supabase/supabase-js';

function getTestClient() {
  const url = process.env['SUPABASE_TEST_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) throw new Error('SUPABASE_TEST_URL and SUPABASE_SERVICE_ROLE_KEY must be set for E2E tests');
  return createClient(url, key);
}

export async function clearVerseReads(userId: string): Promise<void> {
  const db = getTestClient();
  await db.from('verse_reads').delete().eq('user_id', userId);
}

export async function clearGuestToken(guestToken: string): Promise<void> {
  const db = getTestClient();
  await db.from('users').update({ archived_at: new Date().toISOString() }).eq('guest_token', guestToken);
}
