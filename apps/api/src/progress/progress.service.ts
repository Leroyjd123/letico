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
} from './progress.types';

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
      query = (query as ReturnType<typeof db.from>).not('id', 'in', `(${readIds.join(',')})`);
    }

    const { data: nextVerse } = await (query as ReturnType<typeof db.from>).single();

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
   * Streak and ahead/behind calculations are deferred to Phase 6.
   */
  async getProgressSummary(userId: string): Promise<ProgressSummaryDto> {
    const db = this.supabase.getClient();

    const { count } = await db
      .from('verse_reads')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    const totalVersesRead = count ?? 0;
    const completionPct = Math.round((totalVersesRead / 31102) * 10000) / 100;

    return {
      totalVersesRead,
      completionPct,
      streakDays: 0,         // Phase 6
      aheadBehindVerses: null, // Phase 6
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
