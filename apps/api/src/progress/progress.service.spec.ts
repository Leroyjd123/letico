import { Test } from '@nestjs/testing';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ProgressService, clampReadAt } from './progress.service';
import { SupabaseProvider } from '../supabase/supabase.provider';
import { mockSupabase, mockProvider, type MockResult, type RecordedQuery } from '../testing/mock-supabase';

const USER = 'user-1';
const PLAN = 'plan-1';

async function build(opts: {
  from?: (q: RecordedQuery) => MockResult;
  rpc?: Record<string, (a: Record<string, unknown>) => MockResult>;
}) {
  const db = mockSupabase(opts);
  const mod = await Test.createTestingModule({
    providers: [ProgressService, { provide: SupabaseProvider, useValue: mockProvider(db.client) }],
  }).compile();
  return { service: mod.get(ProgressService), db };
}

/** users row → plan PLAN with 3 days of 10 verses each (global_order 1..30) */
function planTables(startDate: string | null) {
  return (q: RecordedQuery): MockResult => {
    if (q.table === 'users') return { data: { plan_id: PLAN, plan_start_date: startDate } };
    if (q.table === 'plan_days') {
      if (q.has('in')) {
        return {
          data: [
            { day_number: 1, start_global_order: 1, end_global_order: 10 },
            { day_number: 3, start_global_order: 21, end_global_order: 30 },
          ],
        };
      }
      if (q.has('maybeSingle')) {
        const day = q.calls.filter((c) => c.method === 'eq').find((c) => c.args[0] === 'day_number')?.args[1];
        return { data: { end_global_order: (day as number) * 10 } };
      }
      return { count: 3 };
    }
    if (q.table === 'verse_reads') return { count: 15 };
    return {};
  };
}

describe('clampReadAt', () => {
  const now = new Date('2026-06-15T12:00:00Z');
  it('defaults to now', () => expect(clampReadAt(undefined, now)).toBe(now.toISOString()));
  it('keeps a recent offline timestamp', () =>
    expect(clampReadAt('2026-06-14T08:00:00Z', now)).toBe('2026-06-14T08:00:00.000Z'));
  it('never accepts the future', () => expect(clampReadAt('2027-01-01T00:00:00Z', now)).toBe(now.toISOString()));
  it('clamps to 30 days back', () =>
    expect(clampReadAt('2020-01-01T00:00:00Z', now)).toBe('2026-05-16T12:00:00.000Z'));
});

describe('ProgressService.markVersesRead', () => {
  it('upserts deduplicated ids with ignoreDuplicates and the clamped readAt', async () => {
    const { service, db } = await build({ from: () => ({ data: [{ verse_id: 1 }] }) });
    const result = await service.markVersesRead(USER, [1, 2, 2], '2000-01-01T00:00:00Z');
    expect(result).toEqual({ inserted: 1, alreadyRead: 1 });
    const q = db.queries[0]!;
    const rows = q.argsOf('upsert')[0] as Array<{ verse_id: number; read_at: string }>;
    expect(rows.map((r) => r.verse_id)).toEqual([1, 2]);
    expect(Date.parse(rows[0]!.read_at)).toBeGreaterThan(Date.parse('2001-01-01'));
    expect(q.calls.find((c) => c.method === 'upsert')!.args[1]).toEqual({
      onConflict: 'user_id,verse_id',
      ignoreDuplicates: true,
    });
  });

  it('turns unknown verse ids (FK violation) into a 400', async () => {
    const { service } = await build({ from: () => ({ error: { message: 'fk', code: '23503' } }) });
    await expect(service.markVersesRead(USER, [999999])).rejects.toThrow(BadRequestException);
  });

  it('turns other DB errors into a typed 500', async () => {
    const { service } = await build({ from: () => ({ error: { message: 'down' } }) });
    await expect(service.markVersesRead(USER, [1])).rejects.toThrow(InternalServerErrorException);
  });
});

describe('ProgressService.unmarkVersesRead', () => {
  it('deletes only the given verses for this user', async () => {
    const { service, db } = await build({ from: () => ({ data: [{ verse_id: 4 }, { verse_id: 5 }] }) });
    await expect(service.unmarkVersesRead(USER, [4, 5])).resolves.toEqual({ removed: 2 });
    const q = db.queries[0]!;
    expect(q.has('delete')).toBe(true);
    expect(q.calls.find((c) => c.method === 'eq')!.args).toEqual(['user_id', USER]);
  });
});

describe('ProgressService.getContinuePosition', () => {
  it('maps the first_unread_verse row', async () => {
    const { service } = await build({
      from: planTables(null),
      rpc: {
        first_unread_verse: () => ({
          data: [{ verse_id: 4, verse_number: 1, chapter_number: 2, book_name: 'Genesis', book_usfm: 'GEN' }],
        }),
      },
    });
    await expect(service.getContinuePosition(USER)).resolves.toEqual({
      bookUsfm: 'GEN',
      bookName: 'Genesis',
      chapterNumber: 2,
      verseNumber: 1,
      verseId: 4,
    });
  });

  it('returns null when everything is read', async () => {
    const { service } = await build({ from: planTables(null), rpc: { first_unread_verse: () => ({ data: [] }) } });
    await expect(service.getContinuePosition(USER)).resolves.toBeNull();
  });
});

describe('ProgressService.getProgressSummary', () => {
  function rpc(readInPlan: number, streak = 2) {
    return {
      reading_streak: (a: Record<string, unknown>) => {
        expect(a['p_tz']).toBe('Asia/Kolkata');
        return { data: streak };
      },
      count_verses_read_in_range: () => ({ data: readInPlan }),
    };
  }

  it('reports completion against the plan and the local-day streak', async () => {
    const { service } = await build({ from: planTables(null), rpc: rpc(15) });
    const s = await service.getProgressSummary(USER, 'Asia/Kolkata');
    expect(s).toEqual({ totalVersesRead: 15, completionPct: 50, streakDays: 2, aheadBehindVerses: null });
  });

  it('counts reading ahead as ahead (reads beyond today are included)', async () => {
    // Start date today → today is day 1, expected 10 verses; 25 read in plan.
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    const { service } = await build({ from: planTables(today), rpc: rpc(25) });
    const s = await service.getProgressSummary(USER, 'Asia/Kolkata');
    expect(s.aheadBehindVerses).toBe(15);
  });
});

describe('ProgressService bulk operations never load all rows', () => {
  it('reset uses the atomic reset_progress function', async () => {
    const { service, db } = await build({ rpc: { reset_progress: () => ({ data: 1500 }) } });
    await expect(service.resetProgress(USER)).resolves.toEqual({ archivedCount: 1500 });
    expect(db.queries).toHaveLength(0);
  });

  it('reset surfaces failures', async () => {
    const { service } = await build({ rpc: { reset_progress: () => ({ error: { message: 'x' } }) } });
    await expect(service.resetProgress(USER)).rejects.toThrow(InternalServerErrorException);
  });

  it('daily counts come from SQL in the reader time zone', async () => {
    const { service, db } = await build({
      rpc: { daily_read_counts: () => ({ data: [{ day: '2026-06-14', count: 3 }] }) },
    });
    await expect(service.getDailyCounts(USER, 7, 'America/Chicago')).resolves.toEqual([
      { date: '2026-06-14', count: 3 },
    ]);
    expect(db.rpcCalls[0]!.args).toEqual({ p_user_id: USER, p_days: 7, p_tz: 'America/Chicago' });
  });

  it('export paginates past the 1,000-row cap', async () => {
    let page = 0;
    const { service, db } = await build({
      from: () => {
        const size = page++ === 0 ? 1000 : 234;
        return { data: Array.from({ length: size }, (_, i) => ({ verse_id: i + 1, read_at: '2026-01-01T00:00:00Z' })) };
      },
    });
    const result = await service.exportProgress(USER);
    expect(result.verseReads).toHaveLength(1234);
    expect(db.queries.map((q) => q.argsOf('range')[0])).toEqual([0, 1000]);
  });
});
