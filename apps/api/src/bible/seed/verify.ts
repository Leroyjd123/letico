/**
 * verify.ts — post-seed validation
 *
 * Run: pnpm db:verify
 * Checks that the database is in a consistent state after seeding.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

const db = createClient(
  process.env['SUPABASE_URL'] ?? '',
  process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '',
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function verify() {
  console.log('Running seed verification...\n');
  let passed = 0;
  let failed = 0;

  async function check(label: string, assertion: () => Promise<boolean>) {
    try {
      const ok = await assertion();
      if (ok) {
        console.log(`  ✓ ${label}`);
        passed++;
      } else {
        console.error(`  ✗ ${label}`);
        failed++;
      }
    } catch (e) {
      console.error(`  ✗ ${label}: ${(e as Error).message}`);
      failed++;
    }
  }

  await check('books count = 66', async () => {
    const { count } = await db.from('books').select('*', { count: 'exact', head: true });
    return count === 66;
  });

  await check('chapters count = 1,189', async () => {
    const { count } = await db.from('chapters').select('*', { count: 'exact', head: true });
    return count === 1189;
  });

  await check('verses count = 31,102', async () => {
    const { count } = await db.from('verses').select('*', { count: 'exact', head: true });
    return count === 31102;
  });

  await check('global_order max = 31,102 (no gaps in assigned sequence)', async () => {
    const { data } = await db
      .from('verses')
      .select('global_order')
      .order('global_order', { ascending: false })
      .limit(1)
      .single();
    return (data as { global_order: number } | null)?.global_order === 31102;
  });

  await check('plans count = 3', async () => {
    const { count } = await db.from('plans').select('*', { count: 'exact', head: true });
    return count === 3;
  });

  await check('1yr plan has 365 days', async () => {
    const { data: plan } = await db
      .from('plans')
      .select('id')
      .eq('name', '1 year plan')
      .single();
    if (!plan) return false;
    const { count } = await db
      .from('plan_days')
      .select('*', { count: 'exact', head: true })
      .eq('plan_id', (plan as { id: string }).id);
    return count === 365;
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
  console.log('\n✅ All checks passed.');
}

verify().catch((err) => {
  console.error('Verification error:', err);
  process.exit(1);
});
