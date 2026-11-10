/**
 * progress.service.ts
 *
 * The sole write path for all reading progress.
 *
 * CRITICAL INVARIANT: every insert into verse_reads MUST use upsert with
 * { onConflict: 'user_id,verse_id', ignoreDuplicates: true } so re-reads are
 * silently ignored.
 *
 * PostgREST caps SELECTs at 1,000 rows, so nothing here loads a user's whole
 * reading history into Node. Multi-row work is done by SQL functions
 * (migrations/002) or, for export, by explicit pagination.
 */
import { Injectable } from '@nestjs/common';
import { InjectSupabase } from '../supabase/inject-supabase.decorator';
import { SupabaseProvider } from '../supabase/supabase.provider';
import { dbError } from '../common/db-errors';
import { todayDayNumber } from '../common/time-zone';
import { resolveUserPlan } from '../common/user-plan';
import type {
  MarkVersesReadResponseDto,
  UnmarkVersesReadResponseDto,
  ContinuePositionDto,
  ProgressSummaryDto,
  DailyCountDto,
  ResetProgressResponseDto,
  ExportProgressResponseDto,
} from './progress.types';

/** Offline reads older than this are stamped with the oldest allowed time. */
const MAX_BACKDATE_MS = 30 * 86_400_000;
const EXPORT_PAGE_SIZE = 1000;

/** Picks the read timestamp: the client's (offline queue) clamped to [now − 30d, now]. */
export function clampReadAt(clientReadAt: string | undefined, now: Date = new Date()): string {
  if (!clientReadAt) return now.toISOString();
  const t = Date.parse(clientReadAt);
  if (Number.isNaN(t)) return now.toISOString();
  const clamped = Math.min(now.getTime(), Math.max(now.getTime() - MAX_BACKDATE_MS, t));
  return new Date(clamped).toISOString();
}

@Injectable()
export class ProgressService {
  constructor(@InjectSupabase() private readonly supabase: SupabaseProvider) {}

  async markVersesRead(
    userId: string,
    verseIds: number[],
    readAt?: string,
  ): Promise<MarkVersesReadResponseDto> {
    const db = this.supabase.getClient();
    const ids = Array.from(new Set(verseIds));
    const at = clampReadAt(readAt);

    const { data, error } = await db
      .from('verse_reads')
      .upsert(
        ids.map((verseId) => ({ user_id: userId, verse_id: verseId, read_at: at })),
        { onConflict: 'user_id,verse_id', ignoreDuplicates: true },
      )
      .select('verse_id');
    if (error) dbError('MARK_READ_FAILED', error);

    const inserted = (data ?? []).length;
    return { inserted, alreadyRead: ids.length - inserted };
  }

  /** Marks verses as unread again (undo a mistaken tap). */
  async unmarkVersesRead(userId: string, verseIds: number[]): Promise<UnmarkVersesReadResponseDto> {
    const db = this.supabase.getClient();
    const { data, error } = await db
      .from('verse_reads')
      .delete()
      .eq('user_id', userId)
      .in('verse_id', Array.from(new Set(verseIds)))
      .select('verse_id');
    if (error) dbError('UNMARK_READ_FAILED', error);
    return { removed: (data ?? []).length };
  }

  /** First unread verse in the user's plan, or null when everything is read. */
  async getContinuePosition(userId: string): Promise<ContinuePositionDto | null> {
    const db = this.supabase.getClient();
    const { planId } = await resolveUserPlan(db, userId);

    const { data, error } = await db.rpc('first_unread_verse', {
      p_user_id: userId,
      p_plan_id: planId,
    });
    if (error) dbError('CONTINUE_LOOKUP_FAILED', error);

    const row = ((data ?? []) as Array<{
      verse_id: number;
      verse_number: number;
      chapter_number: number;
      book_name: string;
      book_usfm: string;
    }>)[0];
    if (!row) return null;

    return {
      bookUsfm: row.book_usfm,
      bookName: row.book_name,
      chapterNumber: row.chapter_number,
      verseNumber: row.verse_number,
      verseId: row.verse_id,
    };
  }

  async getProgressSummary(userId: string, timeZone: string): Promise<ProgressSummaryDto> {
    const db = this.supabase.getClient();
    const plan = await resolveUserPlan(db, userId);

    const [totalRes, streakRes, boundsRes] = await Promise.all([
      db.from('verse_reads').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      db.rpc('reading_streak', { p_user_id: userId, p_tz: timeZone }),
      db
        .from('plan_days')
        .select('day_number, start_global_order, end_global_order')
        .eq('plan_id', plan.planId)
        .in('day_number', [1, plan.totalDays]),
    ]);
    if (totalRes.error) dbError('SUMMARY_FAILED', totalRes.error);
    if (streakRes.error) dbError('SUMMARY_FAILED', streakRes.error);
    if (boundsRes.error) dbError('SUMMARY_FAILED', boundsRes.error);

    const bounds = (boundsRes.data ?? []) as Array<{
      day_number: number;
      start_global_order: number;
      end_global_order: number;
    }>;
    const firstDay = bounds.find((d) => d.day_number === 1);
    const lastDay = bounds.find((d) => d.day_number === plan.totalDays);

    let completionPct = 0;
    let aheadBehindVerses: number | null = null;

    if (firstDay && lastDay) {
      const planStart = firstDay.start_global_order;
      const planTotal = lastDay.end_global_order - planStart + 1;

      const { data: readInPlan, error } = await db.rpc('count_verses_read_in_range', {
        p_user_id: userId,
        p_start_global_order: planStart,
        p_end_global_order: lastDay.end_global_order,
      });
      if (error) dbError('SUMMARY_FAILED', error);
      const versesReadInPlan = (readInPlan as number | null) ?? 0;
      completionPct = Math.round((versesReadInPlan / planTotal) * 10000) / 100;

      if (plan.planStartDate) {
        // Everything up to and including today's reading is "expected".
        // Reading ahead counts as ahead; this assumes a sequential plan.
        const today = todayDayNumber(plan.planStartDate, timeZone, plan.totalDays);
        const { data: todayRow, error: todayError } = await db
          .from('plan_days')
          .select('end_global_order')
          .eq('plan_id', plan.planId)
          .eq('day_number', today)
          .maybeSingle();
        if (todayError) dbError('SUMMARY_FAILED', todayError);
        if (todayRow) {
          const expected = (todayRow as { end_global_order: number }).end_global_order - planStart + 1;
          aheadBehindVerses = versesReadInPlan - expected;
        }
      }
    }

    return {
      totalVersesRead: totalRes.count ?? 0,
      completionPct,
      streakDays: (streakRes.data as number | null) ?? 0,
      aheadBehindVerses,
    };
  }

  async getDailyCounts(userId: string, days: number, timeZone: string): Promise<DailyCountDto[]> {
    const { data, error } = await this.supabase.getClient().rpc('daily_read_counts', {
      p_user_id: userId,
      p_days: days,
      p_tz: timeZone,
    });
    if (error) dbError('DAILY_COUNTS_FAILED', error);
    return ((data ?? []) as Array<{ day: string; count: number }>).map((r) => ({
      date: r.day,
      count: r.count,
    }));
  }

  /** Archives and deletes ALL of the user's reads in one transaction. */
  async resetProgress(userId: string): Promise<ResetProgressResponseDto> {
    const { data, error } = await this.supabase
      .getClient()
      .rpc('reset_progress', { p_user_id: userId });
    if (error) dbError('RESET_FAILED', error);
    return { archivedCount: (data as number | null) ?? 0 };
  }

  /** Full verse_reads export, paginated past the 1,000-row PostgREST cap. */
  async exportProgress(userId: string): Promise<ExportProgressResponseDto> {
    const db = this.supabase.getClient();
    const verseReads: Array<{ verseId: number; readAt: string }> = [];

    for (let from = 0; ; from += EXPORT_PAGE_SIZE) {
      const { data, error } = await db
        .from('verse_reads')
        .select('verse_id, read_at')
        .eq('user_id', userId)
        .order('read_at', { ascending: true })
        .order('verse_id', { ascending: true })
        .range(from, from + EXPORT_PAGE_SIZE - 1);
      if (error) dbError('EXPORT_FAILED', error);

      const page = (data ?? []) as Array<{ verse_id: number; read_at: string }>;
      for (const r of page) verseReads.push({ verseId: r.verse_id, readAt: r.read_at });
      if (page.length < EXPORT_PAGE_SIZE) break;
    }

    return { userId, exportedAt: new Date().toISOString(), verseReads };
  }

  /**
   * Read verse ids for a user within startVerseId..endVerseId (inclusive, by
   * global_order). Ranges are capped well below the 1,000-row limit.
   */
  async getReadVerseIdsInRange(
    userId: string,
    startVerseId: number,
    endVerseId: number,
  ): Promise<number[]> {
    const db = this.supabase.getClient();

    const { data: bounds, error: boundsError } = await db
      .from('verses')
      .select('id, global_order')
      .in('id', [startVerseId, endVerseId]);
    if (boundsError) dbError('READS_LOOKUP_FAILED', boundsError);

    const byId = new Map(
      ((bounds ?? []) as { id: number; global_order: number }[]).map((v) => [v.id, v.global_order]),
    );
    const minOrder = byId.get(startVerseId);
    const maxOrder = byId.get(endVerseId);
    if (minOrder === undefined || maxOrder === undefined || maxOrder < minOrder) return [];
    const upper = Math.min(maxOrder, minOrder + 999);

    const { data, error } = await db
      .from('verse_reads')
      .select('verse_id, verses!inner(global_order)')
      .eq('user_id', userId)
      .gte('verses.global_order', minOrder)
      .lte('verses.global_order', upper);
    if (error) dbError('READS_LOOKUP_FAILED', error);

    return ((data ?? []) as Array<{ verse_id: number }>).map((r) => r.verse_id);
  }
}
