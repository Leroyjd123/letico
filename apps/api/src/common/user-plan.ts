/**
 * user-plan.ts — one place that answers "which plan is this user on?".
 * Previously copy-pasted in three services, each matching the default plan
 * by its display name.
 */
import { NotFoundException } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { dbError } from './db-errors';

export interface UserPlan {
  planId: string;
  planStartDate: string | null;
  totalDays: number;
}

export async function getDefaultPlanId(db: SupabaseClient): Promise<string | null> {
  const { data, error } = await db.rpc('default_plan_id');
  if (error) dbError('PLAN_LOOKUP_FAILED', error);
  return (data as string | null) ?? null;
}

export async function getPlanTotalDays(db: SupabaseClient, planId: string): Promise<number> {
  const { count, error } = await db
    .from('plan_days')
    .select('id', { count: 'exact', head: true })
    .eq('plan_id', planId);
  if (error) dbError('PLAN_LOOKUP_FAILED', error);
  return count ?? 0;
}

/** Resolves the user's plan (falling back to the default plan). Throws PLAN_NOT_FOUND. */
export async function resolveUserPlan(db: SupabaseClient, userId: string): Promise<UserPlan> {
  const { data: userRow, error } = await db
    .from('users')
    .select('plan_id, plan_start_date')
    .eq('id', userId)
    .is('archived_at', null)
    .maybeSingle();
  if (error) dbError('USER_LOOKUP_FAILED', error);

  const row = userRow as { plan_id: string | null; plan_start_date: string | null } | null;
  const planId = row?.plan_id ?? (await getDefaultPlanId(db));
  if (!planId) {
    throw new NotFoundException({ error: { code: 'PLAN_NOT_FOUND', message: 'no reading plan available' } });
  }
  return {
    planId,
    planStartDate: row?.plan_start_date ?? null,
    totalDays: await getPlanTotalDays(db, planId),
  };
}

/** "genesis 1", "genesis 1–3" or "deuteronomy 34 · matthew 1" */
export function buildPassageLabel(
  start: { bookName: string; bookUsfm: string; chapter: number },
  end: { bookName: string; bookUsfm: string; chapter: number },
): string {
  const startBook = start.bookName.toLowerCase();
  if (start.bookUsfm !== end.bookUsfm) {
    return `${startBook} ${start.chapter} · ${end.bookName.toLowerCase()} ${end.chapter}`;
  }
  if (start.chapter === end.chapter) return `${startBook} ${start.chapter}`;
  return `${startBook} ${start.chapter}–${end.chapter}`;
}
