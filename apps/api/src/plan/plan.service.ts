/**
 * plan.service.ts
 *
 * Business logic for reading plan queries.
 * "Today" is computed in the reader's local time zone (X-Timezone header).
 * global_order never appears in any returned DTO.
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectSupabase } from '../supabase/inject-supabase.decorator';
import { SupabaseProvider } from '../supabase/supabase.provider';
import { dbError } from '../common/db-errors';
import { todayDayNumber } from '../common/time-zone';
import { buildPassageLabel, getPlanTotalDays, resolveUserPlan } from '../common/user-plan';
import type {
  PlanDayRow,
  PlanDayChapterRow,
  PlanDaySummaryRow,
  PlanDayViewDto,
  PlanDaySummaryDto,
  PlanListItemDto,
} from './plan.types';

function pct(read: number, total: number): number {
  return total > 0 ? Math.min(100, Math.round((read / total) * 10000) / 100) : 0;
}

@Injectable()
export class PlanService {
  constructor(@InjectSupabase() private readonly supabase: SupabaseProvider) {}

  async getPlanToday(userId: string, timeZone: string): Promise<PlanDayViewDto> {
    const plan = await resolveUserPlan(this.supabase.getClient(), userId);
    const today = todayDayNumber(plan.planStartDate, timeZone, plan.totalDays);
    return this.buildPlanDayView(userId, plan.planId, today, plan.totalDays, today);
  }

  async getPlanDay(
    planId: string,
    dayNumber: number,
    userId: string,
    timeZone: string,
  ): Promise<PlanDayViewDto> {
    const db = this.supabase.getClient();
    const plan = await resolveUserPlan(db, userId);
    // Offsets are only meaningful against the user's own plan schedule.
    const totalDays = plan.planId === planId ? plan.totalDays : await getPlanTotalDays(db, planId);
    const today =
      plan.planId === planId ? todayDayNumber(plan.planStartDate, timeZone, totalDays) : 1;
    return this.buildPlanDayView(userId, planId, dayNumber, totalDays, today);
  }

  /** Completion % for every day of a plan, computed in a single SQL query. */
  async getAllDaysSummary(
    planId: string,
    userId: string,
    timeZone: string,
  ): Promise<PlanDaySummaryDto[]> {
    const db = this.supabase.getClient();
    const plan = await resolveUserPlan(db, userId);

    const { data, error } = await db.rpc('plan_days_summary', {
      p_user_id: userId,
      p_plan_id: planId,
    });
    if (error) dbError('PLAN_SUMMARY_FAILED', error);
    const rows = (data ?? []) as PlanDaySummaryRow[];
    if (rows.length === 0) {
      throw new NotFoundException({
        error: { code: 'PLAN_NOT_FOUND', message: `No days found for plan ${planId}` },
      });
    }

    const today =
      plan.planId === planId ? todayDayNumber(plan.planStartDate, timeZone, rows.length) : 1;

    return rows.map((r) => ({
      dayNumber: r.day_number,
      label: buildPassageLabel(
        { bookName: r.start_book_name, bookUsfm: r.start_book_usfm, chapter: r.start_chapter },
        { bookName: r.end_book_name, bookUsfm: r.end_book_usfm, chapter: r.end_chapter },
      ),
      completionPct: pct(r.verses_read, r.total_verses),
      isToday: r.day_number === today,
      offsetFromToday: r.day_number - today,
    }));
  }

  /** Plans that actually have days, default plan first. */
  async listPlans(): Promise<PlanListItemDto[]> {
    const db = this.supabase.getClient();
    const { data, error } = await db
      .from('plans')
      .select('id, name, is_default, created_at, plan_days(count)')
      .order('created_at', { ascending: true });
    if (error) dbError('PLAN_LIST_FAILED', error);

    const rows = (data ?? []) as Array<{
      id: string;
      name: string;
      is_default: boolean;
      plan_days: Array<{ count: number }>;
    }>;

    return rows
      .map((p) => ({
        id: p.id,
        name: p.name,
        isDefault: p.is_default,
        totalDays: p.plan_days[0]?.count ?? 0,
      }))
      .filter((p) => p.totalDays > 0)
      .sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async buildPlanDayView(
    userId: string,
    planId: string,
    dayNumber: number,
    totalDays: number,
    todayNumber: number,
  ): Promise<PlanDayViewDto> {
    const db = this.supabase.getClient();

    const { data: planDayRow, error } = await db
      .from('plan_days')
      .select('id, plan_id, day_number, start_verse_id, end_verse_id, start_global_order, end_global_order')
      .eq('plan_id', planId)
      .eq('day_number', dayNumber)
      .maybeSingle();
    if (error) dbError('PLAN_DAY_LOOKUP_FAILED', error);
    if (!planDayRow) {
      throw new NotFoundException({
        error: { code: 'PLAN_DAY_NOT_FOUND', message: `Plan day ${dayNumber} not found` },
      });
    }
    const row = planDayRow as PlanDayRow;

    const { data: chapterData, error: chaptersError } = await db.rpc('plan_day_chapters', {
      p_user_id: userId,
      p_start_global_order: row.start_global_order,
      p_end_global_order: row.end_global_order,
    });
    if (chaptersError) dbError('PLAN_DAY_LOOKUP_FAILED', chaptersError);
    const chapterRows = (chapterData ?? []) as PlanDayChapterRow[];
    const first = chapterRows[0];
    const last = chapterRows[chapterRows.length - 1];
    if (!first || !last) {
      throw new NotFoundException({
        error: { code: 'PLAN_DAY_NOT_FOUND', message: `Plan day ${dayNumber} has no verses` },
      });
    }

    const chapters = chapterRows.map((c) => ({
      chapterId: c.chapter_id,
      chapterNumber: c.chapter_number,
      book: c.book_usfm,
      bookName: c.book_name,
      verseIds: c.verse_ids,
      verseNumbers: c.verse_numbers,
      readVerseIds: c.read_verse_ids,
    }));

    return {
      planId,
      dayNumber: row.day_number,
      totalDays,
      label: buildPassageLabel(
        { bookName: first.book_name, bookUsfm: first.book_usfm, chapter: first.chapter_number },
        { bookName: last.book_name, bookUsfm: last.book_usfm, chapter: last.chapter_number },
      ),
      book: first.book_usfm,
      chapter: first.chapter_number,
      startVerse: first.verse_numbers[0] ?? 1,
      endVerse: last.verse_numbers[last.verse_numbers.length - 1] ?? 1,
      startVerseId: row.start_verse_id,
      endVerseId: row.end_verse_id,
      chapters,
      totalVerses: chapters.reduce((n, c) => n + c.verseIds.length, 0),
      versesRead: chapters.reduce((n, c) => n + c.readVerseIds.length, 0),
      isToday: row.day_number === todayNumber,
      offsetFromToday: row.day_number - todayNumber,
    };
  }
}
