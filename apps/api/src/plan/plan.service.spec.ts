import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PlanService } from './plan.service';
import { SupabaseProvider } from '../supabase/supabase.provider';
import { buildPassageLabel } from '../common/user-plan';
import { mockSupabase, mockProvider, type MockResult, type RecordedQuery } from '../testing/mock-supabase';

const USER = 'user-1';
const PLAN = 'plan-1';

async function build(opts: {
  from?: (q: RecordedQuery) => MockResult;
  rpc?: Record<string, (a: Record<string, unknown>) => MockResult>;
}) {
  const db = mockSupabase(opts);
  const mod = await Test.createTestingModule({
    providers: [PlanService, { provide: SupabaseProvider, useValue: mockProvider(db.client) }],
  }).compile();
  return { service: mod.get(PlanService), db };
}

const DAY_ROW = {
  id: 'd', plan_id: PLAN, day_number: 3, start_verse_id: 6, end_verse_id: 11,
  start_global_order: 6, end_global_order: 11,
};
const CHAPTERS = [
  { chapter_id: 3, chapter_number: 34, book_usfm: 'DEU', book_name: 'Deuteronomy',
    verse_ids: [6, 7, 8, 9], verse_numbers: [1, 2, 3, 4], read_verse_ids: [6] },
  { chapter_id: 4, chapter_number: 1, book_usfm: 'MAT', book_name: 'Matthew',
    verse_ids: [10, 11], verse_numbers: [1, 2], read_verse_ids: [] },
];

function tables(startDate: string | null, dayRow: unknown = DAY_ROW) {
  return (q: RecordedQuery): MockResult => {
    if (q.table === 'users') return { data: { plan_id: PLAN, plan_start_date: startDate } };
    if (q.table === 'plan_days') return q.has('maybeSingle') ? { data: dayRow } : { count: 365 };
    return {};
  };
}

describe('buildPassageLabel', () => {
  const gen = { bookName: 'Genesis', bookUsfm: 'GEN' };
  it('single chapter', () => expect(buildPassageLabel({ ...gen, chapter: 1 }, { ...gen, chapter: 1 })).toBe('genesis 1'));
  it('chapter range', () => expect(buildPassageLabel({ ...gen, chapter: 1 }, { ...gen, chapter: 3 })).toBe('genesis 1–3'));
  it('across books', () =>
    expect(buildPassageLabel({ ...gen, chapter: 50 }, { bookName: 'Exodus', bookUsfm: 'EXO', chapter: 2 })).toBe(
      'genesis 50 · exodus 2',
    ));
});

describe('PlanService.getPlanDay', () => {
  it('returns every chapter of the day, across the book boundary, with read state', async () => {
    const { service } = await build({ from: tables(null), rpc: { plan_day_chapters: () => ({ data: CHAPTERS }) } });
    const day = await service.getPlanDay(PLAN, 3, USER, 'UTC');
    expect(day.label).toBe('deuteronomy 34 · matthew 1');
    expect(day.chapters.map((c) => `${c.book} ${c.chapterNumber}`)).toEqual(['DEU 34', 'MAT 1']);
    expect(day.chapters[0]!.readVerseIds).toEqual([6]);
    expect(day.totalVerses).toBe(6);
    expect(day.versesRead).toBe(1);
    expect(day.startVerse).toBe(1);
    expect(day.endVerse).toBe(2);
    expect(day.totalDays).toBe(365);
    expect(day.offsetFromToday).toBe(2); // no start date → today is day 1
  });

  it('throws PLAN_DAY_NOT_FOUND for a missing day', async () => {
    const { service } = await build({ from: tables(null, null), rpc: {} });
    await expect(service.getPlanDay(PLAN, 999, USER, 'UTC')).rejects.toThrow(NotFoundException);
  });
});

describe('PlanService.getPlanToday', () => {
  it('uses the reader time zone to pick today', async () => {
    const dayRequested: unknown[] = [];
    const { service } = await build({
      from: (q) => {
        if (q.table === 'plan_days' && q.has('maybeSingle')) {
          dayRequested.push(q.calls.filter((c) => c.method === 'eq').find((c) => c.args[0] === 'day_number')?.args[1]);
        }
        return tables(
          new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Kiritimati' }).format(new Date()),
          { ...DAY_ROW, day_number: 1 },
        )(q);
      },
      rpc: { plan_day_chapters: () => ({ data: CHAPTERS }) },
    });
    // Start date = today in UTC+14 → day 1 there.
    const day = await service.getPlanToday(USER, 'Pacific/Kiritimati');
    expect(dayRequested).toEqual([1]);
    expect(day.isToday).toBe(true);
  });
});

describe('PlanService.getAllDaysSummary', () => {
  it('builds the whole plan from ONE SQL call', async () => {
    const { service, db } = await build({
      from: tables(null),
      rpc: {
        plan_days_summary: () => ({
          data: [
            { day_number: 1, total_verses: 31, verses_read: 31, start_book_name: 'Genesis', start_book_usfm: 'GEN',
              start_chapter: 1, end_book_name: 'Genesis', end_book_usfm: 'GEN', end_chapter: 1 },
            { day_number: 2, total_verses: 50, verses_read: 25, start_book_name: 'Genesis', start_book_usfm: 'GEN',
              start_chapter: 2, end_book_name: 'Genesis', end_book_usfm: 'GEN', end_chapter: 3 },
          ],
        }),
      },
    });
    const days = await service.getAllDaysSummary(PLAN, USER, 'UTC');
    expect(db.rpcCalls).toHaveLength(1);
    expect(days).toEqual([
      { dayNumber: 1, label: 'genesis 1', completionPct: 100, isToday: true, offsetFromToday: 0 },
      { dayNumber: 2, label: 'genesis 2–3', completionPct: 50, isToday: false, offsetFromToday: 1 },
    ]);
  });
});

describe('PlanService.listPlans', () => {
  it('hides plans with no days and puts the default first', async () => {
    const { service } = await build({
      from: () => ({
        data: [
          { id: 'a', name: '2 year plan', is_default: false, plan_days: [{ count: 0 }] },
          { id: 'b', name: 'chronological', is_default: false, plan_days: [{ count: 365 }] },
          { id: 'c', name: '1 year plan', is_default: true, plan_days: [{ count: 365 }] },
        ],
      }),
    });
    const plans = await service.listPlans();
    expect(plans.map((p) => p.id)).toEqual(['c', 'b']);
  });
});
