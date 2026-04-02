/**
 * progress.service.ts
 *
 * The sole write path for all reading progress.
 *
 * CRITICAL INVARIANT: every insert into verse_reads MUST use upsert with
 * { onConflict: 'user_id,verse_id', ignoreDuplicates: true }. Any call
 * to .insert() without this protection is a P0 bug — it would throw a
 * unique constraint violation if the user re-reads a verse.
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectSupabase } from '../supabase/inject-supabase.decorator';
import { SupabaseProvider } from '../supabase/supabase.provider';
import type {
  MarkVersesReadResponseDto,
  ContinuePositionDto,
  ProgressSummaryDto,
  DailyCountDto,
  ResetProgressResponseDto,
  ExportProgressResponseDto,
} from './progress.types';

const TOTAL_BIBLE_VERSES = 31102;

@Injectable()
export class ProgressService {
  constructor(@InjectSupabase() private readonly supabase: SupabaseProvider) {}

  /**
   * Marks verses as read for the given user.
   * Uses upsert with ignoreDuplicates to safely handle re-reads.
   * read_at is set server-side — never trust a client timestamp.
   */
  async markVersesRead(
    userId: string,
    verseIds: number[],
  ): Promise<MarkVersesReadResponseDto> {
    const db = this.supabase.getClient();
    const readAt = new Date().toISOString();

    const rows = verseIds.map((verseId) => ({
      user_id: userId,
      verse_id: verseId,
      read_at: readAt,
    }));

    // ignoreDuplicates: true → only inserts new rows; already-read verses are silently skipped.
    // The returned data contains only the newly inserted rows.
    const { data, error } = await db
      .from('verse_reads')
      .upsert(rows, { onConflict: 'user_id,verse_id', ignoreDuplicates: true })
      .select('verse_id');

    if (error) {
      throw new Error(`Failed to mark verses read: ${error.message}`);
    }

    const inserted = (data ?? []).length;
    const alreadyRead = verseIds.length - inserted;

    return { inserted, alreadyRead };
  }

  /**
   * Returns the first unread verse in the user's plan (ordered by global_order).
   * Returns null if the user has read all verses in the plan.
   */
  async getContinuePosition(userId: string): Promise<ContinuePositionDto | null> {
    const db = this.supabase.getClient();

    // Resolve the user's plan id
    const { data: userRow } = await db
      .from('users')
      .select('plan_id')
      .eq('id', userId)
      .is('archived_at', null)
      .single();

    let planId: string;
    if (userRow && (userRow as { plan_id: string | null }).plan_id) {
      planId = (userRow as { plan_id: string }).plan_id;
    } else {
      const { data: defaultPlan } = await db
        .from('plans')
        .select('id')
        .eq('name', '1 year plan')
        .limit(1)
        .single();
      if (!defaultPlan) return null;
      planId = (defaultPlan as { id: string }).id;
    }

    // Get plan's total global_order range
    const { data: lastDay } = await db
      .from('plan_days')
      .select('end_global_order')
      .eq('plan_id', planId)
      .order('day_number', { ascending: false })
      .limit(1)
      .single();

    const { data: firstDay } = await db
      .from('plan_days')
      .select('start_global_order')
      .eq('plan_id', planId)
      .order('day_number', { ascending: true })
      .limit(1)
      .single();

    if (!firstDay || !lastDay) return null;

    const minOrder = (firstDay as { start_global_order: number }).start_global_order;
    const maxOrder = (lastDay as { end_global_order: number }).end_global_order;

    // Get all verse_ids the user has already read
    const { data: readData } = await db
      .from('verse_reads')
      .select('verse_id')
      .eq('user_id', userId);

    const readIds = (readData ?? []).map((r: { verse_id: number }) => r.verse_id);

    // Find the first verse in the plan range that hasn't been read
    let query = db
      .from('verses')
      .select(`
        id,
        number,
        chapters (
          number,
          books (
            name,
            usfm_code
          )
        )
      `)
      .gte('global_order', minOrder)
      .lte('global_order', maxOrder)
      .order('global_order', { ascending: true })
      .limit(1);

    if (readIds.length > 0) {
      // Filter out already-read verses
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      query = (query as any).not('id', 'in', `(${readIds.join(',')})`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: nextVerse } = await (query as any).single();

    if (!nextVerse) return null; // All done!

    const v = nextVerse as {
      id: number;
      number: number;
      chapters: { number: number; books: { name: string; usfm_code: string } };
    };
    const chapter = Array.isArray(v.chapters) ? v.chapters[0] : v.chapters;
    const book = Array.isArray(chapter?.books) ? chapter.books[0] : chapter?.books;

    return {
      bookUsfm: book?.usfm_code ?? '',
      bookName: book?.name ?? '',
      chapterNumber: chapter?.number ?? 0,
      verseNumber: v.number,
      verseId: v.id,
    };
  }

  /**
   * Returns a progress summary for the user.
   */
  async getProgressSummary(userId: string): Promise<ProgressSummaryDto> {
    const db = this.supabase.getClient();

    const { count } = await db
      .from('verse_reads')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    const totalVersesRead = count ?? 0;
    const completionPct = Math.round((totalVersesRead / TOTAL_BIBLE_VERSES) * 10000) / 100;

    // Calculate streak
    const { data: readDates } = await db
      .from('verse_reads')
      .select('read_at')
      .eq('user_id', userId)
      .order('read_at', { ascending: false });

    const uniqueUtcDates = Array.from(
      new Set(
        (readDates ?? []).map((r: { read_at: string }) => {
          const d = new Date(r.read_at);
          return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
        })
      )
    ).sort((a, b) => b.localeCompare(a));

    let streakDays = 0;
    const today = new Date();
    const todayStr = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`;
    const yesterday = new Date(today);
    yesterday.setUTCDate(today.getUTCDate() - 1);
    const yesterdayStr = `${yesterday.getUTCFullYear()}-${String(yesterday.getUTCMonth() + 1).padStart(2, '0')}-${String(yesterday.getUTCDate()).padStart(2, '0')}`;

    if (uniqueUtcDates.length > 0) {
      if (uniqueUtcDates[0] === todayStr) {
        streakDays = 1;
        let currentDate = new Date(today);
        for (let i = 1; i < uniqueUtcDates.length; i++) {
          currentDate.setUTCDate(currentDate.getUTCDate() - 1);
          const expectedStr = `${currentDate.getUTCFullYear()}-${String(currentDate.getUTCMonth() + 1).padStart(2, '0')}-${String(currentDate.getUTCDate()).padStart(2, '0')}`;
          if (uniqueUtcDates[i] === expectedStr) {
            streakDays++;
          } else {
            break;
          }
        }
      } else if (uniqueUtcDates[0] === yesterdayStr) {
        streakDays = 1;
        let currentDate = new Date(yesterday);
        for (let i = 1; i < uniqueUtcDates.length; i++) {
          currentDate.setUTCDate(currentDate.getUTCDate() - 1);
          const expectedStr = `${currentDate.getUTCFullYear()}-${String(currentDate.getUTCMonth() + 1).padStart(2, '0')}-${String(currentDate.getUTCDate()).padStart(2, '0')}`;
          if (uniqueUtcDates[i] === expectedStr) {
            streakDays++;
          } else {
            break;
          }
        }
      }
    }

    // Calculate ahead/behind
    let aheadBehindVerses: number | null = null;
    const { data: userRow } = await db
      .from('users')
      .select('plan_id, plan_start_date')
      .eq('id', userId)
      .is('archived_at', null)
      .single();

    if (userRow && (userRow as { plan_id: string | null }).plan_id) {
      const planId = (userRow as { plan_id: string }).plan_id;
      const planStartDate = (userRow as { plan_start_date: string | null }).plan_start_date;

      if (planStartDate) {
        const start = new Date(planStartDate);
        const startUtc = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
        const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
        const expectedDayNumber = Math.max(1, Math.min(365, Math.floor((todayUtc - startUtc) / 86400000) + 1));

        const { data: planDays } = await db
          .from('plan_days')
          .select('start_global_order, end_global_order')
          .eq('plan_id', planId)
          .lte('day_number', expectedDayNumber)
          .order('day_number', { ascending: true });

        if (planDays && planDays.length > 0) {
          const days = planDays as Array<{ start_global_order: number; end_global_order: number }>;
          let expectedVerseCount = 0;
          for (const d of days) {
            expectedVerseCount += (d.end_global_order - d.start_global_order + 1);
          }

          const firstDayStart = days[0]!.start_global_order;
          const lastDayEnd = days[days.length - 1]!.end_global_order;

          const { data: countData } = await db.rpc('count_verses_read_in_range', {
            p_user_id: userId,
            p_start_global_order: firstDayStart,
            p_end_global_order: lastDayEnd,
          });

          const versesReadInPlanRange = (countData as number) ?? 0;
          aheadBehindVerses = versesReadInPlanRange - expectedVerseCount;
        }
      }
    }

    return {
      totalVersesRead,
      completionPct,
      streakDays,
      aheadBehindVerses,
    };
  }

  async getDailyCounts(userId: string, days: number): Promise<DailyCountDto[]> {
    const db = this.supabase.getClient();

    const { data: readDates } = await db
      .from('verse_reads')
      .select('read_at')
      .eq('user_id', userId);

    const countsByDate = new Map<string, number>();

    const today = new Date();
    for (let i = 0; i < days; i++) {
      const target = new Date(today);
      target.setUTCDate(today.getUTCDate() - i);
      const str = `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, '0')}-${String(target.getUTCDate()).padStart(2, '0')}`;
      countsByDate.set(str, 0);
    }

    if (readDates) {
      for (const row of readDates) {
        const d = new Date((row as { read_at: string }).read_at);
        const str = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
        if (countsByDate.has(str)) {
          countsByDate.set(str, countsByDate.get(str)! + 1);
        }
      }
    }

    return Array.from(countsByDate.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Archives all of the user's verse_reads into archived_verse_reads, then
   * deletes them from verse_reads.
   *
   * NOTE: This operation is non-atomic. The archive insert and the delete are
   * two separate DB calls. If the archive insert fails, we abort and never
   * delete — so no progress is lost. However, if the delete fails after a
   * successful insert, archived rows will exist without the originals being
   * removed. Callers should surface this as a retryable error.
   */
  async resetProgress(userId: string): Promise<ResetProgressResponseDto> {
    const db = this.supabase.getClient();

    const { data: rows, error: fetchError } = await db
      .from('verse_reads')
      .select('verse_id, read_at')
      .eq('user_id', userId);

    if (fetchError) {
      throw new Error(`Failed to fetch verse_reads: ${fetchError.message}`);
    }

    const readRows = (rows ?? []) as Array<{ verse_id: number; read_at: string }>;

    if (readRows.length > 0) {
      const { error: archiveError } = await db
        .from('archived_verse_reads')
        .insert(
          readRows.map((r) => ({
            user_id: userId,
            verse_id: r.verse_id,
            read_at: r.read_at,
          })),
        );

      if (archiveError) {
        throw new Error(`Failed to archive verse_reads: ${archiveError.message}`);
      }

      const { error: deleteError } = await db
        .from('verse_reads')
        .delete()
        .eq('user_id', userId);

      if (deleteError) {
        throw new Error(`Failed to delete verse_reads after archive: ${deleteError.message}`);
      }
    }

    return { archivedCount: readRows.length };
  }

  /**
   * Returns all verse_reads for the user as a portable export payload.
   * read_at timestamps are preserved as-is from the database.
   */
  async exportProgress(userId: string): Promise<ExportProgressResponseDto> {
    const db = this.supabase.getClient();

    const { data, error } = await db
      .from('verse_reads')
      .select('verse_id, read_at')
      .eq('user_id', userId)
      .order('read_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to export verse_reads: ${error.message}`);
    }

    const readRows = (data ?? []) as Array<{ verse_id: number; read_at: string }>;

    return {
      userId,
      exportedAt: new Date().toISOString(),
      verseReads: readRows.map((r) => ({ verseId: r.verse_id, readAt: r.read_at })),
    };
  }

  /**
   * Returns the read verse IDs for a user within the range
   * defined by startVerseId..endVerseId (inclusive, using global_order internally).
   * Used by the frontend to compute per-chapter read state.
   */
  async getReadVerseIdsInRange(
    userId: string,
    startVerseId: number,
    endVerseId: number,
  ): Promise<number[]> {
    const db = this.supabase.getClient();

    // Resolve global_orders for the boundary verses
    const { data: bounds } = await db
      .from('verses')
      .select('id, global_order')
      .in('id', [startVerseId, endVerseId]);

    if (!bounds || bounds.length < 2) return [];

    const boundMap = new Map(
      (bounds as { id: number; global_order: number }[]).map((v) => [v.id, v.global_order]),
    );
    const minOrder = boundMap.get(startVerseId) ?? 0;
    const maxOrder = boundMap.get(endVerseId) ?? 0;

    if (minOrder === 0 || maxOrder === 0) return [];

    // Get all verse_reads for this user in the range
    const { data: readData } = await db
      .from('verse_reads')
      .select('verse_id, verses!inner(global_order)')
      .eq('user_id', userId)
      .gte('verses.global_order', minOrder)
      .lte('verses.global_order', maxOrder);

    return (readData ?? []).map((r: { verse_id: number }) => r.verse_id);
  }
}
