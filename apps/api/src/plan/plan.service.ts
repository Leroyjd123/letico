/**
 * plan.service.ts
 *
 * Business logic for reading plan queries.
 * All date arithmetic uses UTC to prevent timezone off-by-one errors.
 * global_order never appears in any returned DTO.
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectSupabase } from '../supabase/inject-supabase.decorator';
import { SupabaseProvider } from '../supabase/supabase.provider';
import type { PlanDayRow, UserPlanRow, VerseContext, PlanDayViewDto, PlanDaySummaryDto } from './plan.types';

@Injectable()
export class PlanService {
  constructor(@InjectSupabase() private readonly supabase: SupabaseProvider) {}

  async getPlanToday(userId: string): Promise<PlanDayViewDto> {
    const { planId, planStartDate } = await this.getUserPlanInfo(userId);
    const dayNumber = this.computeTodayDayNumber(planStartDate);
    return this.buildPlanDayView(planId, dayNumber, planStartDate);
  }

  async getPlanDay(planId: string, dayNumber: number, userId: string): Promise<PlanDayViewDto> {
    const { planStartDate } = await this.getUserPlanInfo(userId);
    return this.buildPlanDayView(planId, dayNumber, planStartDate);
  }

  /**
   * Returns completion % for all 365 days in a single round-trip.
   * Uses the count_verses_read_in_range SQL function for each day.
   * Labels are built from the start verse context of each day.
   *
   * Strategy: fetch all plan_days rows in one query, then call the DB
   * function for each day. Postgres handles 365 function calls in ~10ms.
   */
  async getAllDaysSummary(planId: string, userId: string): Promise<PlanDaySummaryDto[]> {
    const db = this.supabase.getClient();
    const { planStartDate } = await this.getUserPlanInfo(userId);

    // Fetch all plan days (id, day_number, start/end global_order, start_verse_id)
    const { data: daysData, error } = await db
      .from('plan_days')
      .select('day_number, start_global_order, end_global_order, start_verse_id')
      .eq('plan_id', planId)
      .order('day_number', { ascending: true });

    if (error || !daysData) {
      throw new NotFoundException({
        error: { code: 'PLAN_NOT_FOUND', message: `No days found for plan ${planId}` },
      });
    }

    const days = daysData as Array<{
      day_number: number;
      start_global_order: number;
      end_global_order: number;
      start_verse_id: number;
    }>;

    const todayDayNumber = this.computeTodayDayNumber(planStartDate);

    // Batch: call count_verses_read_in_range for all days in parallel (up to 20 concurrent)
    const CONCURRENCY = 20;
    const results: PlanDaySummaryDto[] = new Array(days.length);

    for (let i = 0; i < days.length; i += CONCURRENCY) {
      const batch = days.slice(i, i + CONCURRENCY);
      await Promise.all(
        batch.map(async (day, batchIdx) => {
          const idx = i + batchIdx;
          const dayRow = day;

          // Call the count_verses_read_in_range RPC function
          const { data: countData } = await db.rpc('count_verses_read_in_range', {
            p_user_id: userId,
            p_start_global_order: dayRow.start_global_order,
            p_end_global_order: dayRow.end_global_order,
          });

          const versesRead = (countData as number) ?? 0;
          const totalVerses = dayRow.end_global_order - dayRow.start_global_order + 1;
          const completionPct =
            totalVerses > 0
              ? Math.min(100, Math.round((versesRead / totalVerses) * 10000) / 100)
              : 0;

          // Resolve label from start verse
          const startCtx = await this.resolveVerseContext(dayRow.start_verse_id);
          const label = `${startCtx.bookName.toLowerCase()} ${startCtx.chapterNumber}`;

          results[idx] = {
            dayNumber: dayRow.day_number,
            label,
            completionPct,
            isToday: dayRow.day_number === todayDayNumber,
            offsetFromToday: dayRow.day_number - todayDayNumber,
          };
        }),
      );
    }

    return results;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async getUserPlanInfo(
    userId: string,
  ): Promise<{ planId: string; planStartDate: string | null }> {
    const db = this.supabase.getClient();

    const { data: userRow } = await db
      .from('users')
      .select('id, plan_id, plan_start_date')
      .eq('id', userId)
      .is('archived_at', null)
      .single();

    if (userRow && (userRow as UserPlanRow).plan_id) {
      return {
        planId: (userRow as UserPlanRow).plan_id as string,
        planStartDate: (userRow as UserPlanRow).plan_start_date,
      };
    }

    // Default to 1yr plan for users who haven't selected a plan
    const { data: defaultPlan } = await db
      .from('plans')
      .select('id')
      .eq('name', '1 year plan')
      .limit(1)
      .single();

    if (!defaultPlan) {
      throw new NotFoundException({
        error: { code: 'PLAN_NOT_FOUND', message: 'Default plan not found' },
      });
    }

    return {
      planId: (defaultPlan as { id: string }).id,
      planStartDate: null,
    };
  }

  private async buildPlanDayView(
    planId: string,
    dayNumber: number,
    planStartDate: string | null,
  ): Promise<PlanDayViewDto> {
    const db = this.supabase.getClient();

    const { data: planDayRow, error } = await db
      .from('plan_days')
      .select('id, plan_id, day_number, start_verse_id, end_verse_id, start_global_order, end_global_order')
      .eq('plan_id', planId)
      .eq('day_number', dayNumber)
      .single();

    if (error || !planDayRow) {
      throw new NotFoundException({
        error: {
          code: 'PLAN_DAY_NOT_FOUND',
          message: `Plan day ${dayNumber} not found`,
        },
      });
    }

    const row = planDayRow as PlanDayRow;

    // Resolve verse context for start and end in parallel
    const [startCtx, endCtx] = await Promise.all([
      this.resolveVerseContext(row.start_verse_id),
      this.resolveVerseContext(row.end_verse_id),
    ]);

    const offsetFromToday = this.computeOffsetFromToday(dayNumber, planStartDate);

    return {
      dayNumber: row.day_number,
      label: this.buildLabel(startCtx, endCtx),
      book: startCtx.bookUsfm,
      chapter: startCtx.chapterNumber,
      startVerse: startCtx.verseNumber,
      endVerse: endCtx.verseNumber,
      startVerseId: row.start_verse_id,
      endVerseId: row.end_verse_id,
      isToday: offsetFromToday === 0,
      offsetFromToday,
    };
  }

  private async resolveVerseContext(verseId: number): Promise<VerseContext> {
    const db = this.supabase.getClient();

    // Join: verses → chapters (via chapter_id FK) → books (via book_id FK)
    const { data, error } = await db
      .from('verses')
      .select(`
        number,
        chapters (
          number,
          books (
            name,
            usfm_code
          )
        )
      `)
      .eq('id', verseId)
      .single();

    if (error || !data) {
      throw new Error(`Failed to resolve verse context for verse ${verseId}`);
    }

    const v = data as {
      number: number;
      chapters: { number: number; books: { name: string; usfm_code: string } };
    };
    const chapter = Array.isArray(v.chapters) ? v.chapters[0] : v.chapters;
    const book = Array.isArray(chapter?.books) ? chapter.books[0] : chapter?.books;

    return {
      verseNumber: v.number,
      chapterNumber: chapter?.number ?? 0,
      bookName: book?.name ?? '',
      bookUsfm: book?.usfm_code ?? '',
    };
  }

  private buildLabel(start: VerseContext, end: VerseContext): string {
    const startBook = start.bookName.toLowerCase();
    const endBook = end.bookName.toLowerCase();

    if (start.bookUsfm !== end.bookUsfm) {
      // Spans two books: "deuteronomy 34 · matthew 1"
      return `${startBook} ${start.chapterNumber} · ${endBook} ${end.chapterNumber}`;
    }

    if (start.chapterNumber === end.chapterNumber) {
      // Single chapter: "genesis 1"
      return `${startBook} ${start.chapterNumber}`;
    }

    // Multiple chapters, same book: "genesis 1–3"
    return `${startBook} ${start.chapterNumber}–${end.chapterNumber}`;
  }

  /**
   * Computes today's day number using UTC arithmetic.
   * Returns 1 when planStartDate is null (no plan started).
   * Clamps to [1, 365].
   */
  private computeTodayDayNumber(planStartDate: string | null): number {
    if (!planStartDate) return 1;

    const today = new Date();
    const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    const start = new Date(planStartDate);
    const startUtc = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
    const dayNumber = Math.floor((todayUtc - startUtc) / 86400000) + 1;

    return Math.max(1, Math.min(365, dayNumber));
  }

  /**
   * Returns the offset from today for a given day number.
   * Negative = past, 0 = today, positive = future.
   */
  private computeOffsetFromToday(dayNumber: number, planStartDate: string | null): number {
    const todayDayNumber = this.computeTodayDayNumber(planStartDate);
    return dayNumber - todayDayNumber;
  }
}
