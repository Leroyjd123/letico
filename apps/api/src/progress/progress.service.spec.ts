/**
 * progress.service.spec.ts
 *
 * Tests for ProgressService.
 * DB is always mocked. Tests cover the critical upsert invariant,
 * alreadyRead counting, and empty-verseIds edge case.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ProgressService } from './progress.service';
import { SupabaseProvider } from '../supabase/supabase.provider';

const USER_ID = 'user-uuid-test';

describe('ProgressService', () => {
  let service: ProgressService;

  async function createService(mockClient: unknown) {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProgressService,
        {
          provide: SupabaseProvider,
          useValue: { getClient: () => mockClient },
        },
      ],
    }).compile();
    service = module.get<ProgressService>(ProgressService);
  }

  describe('markVersesRead', () => {
    it('returns inserted = 3, alreadyRead = 0 for 3 new verse IDs', async () => {
      const insertedRows = [{ verse_id: 1 }, { verse_id: 2 }, { verse_id: 3 }];
      const upsertChain = {
        upsert: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({ data: insertedRows, error: null }),
      };
      const mockClient = { from: jest.fn().mockReturnValue(upsertChain) };
      await createService(mockClient);

      const result = await service.markVersesRead(USER_ID, [1, 2, 3]);

      expect(result.inserted).toBe(3);
      expect(result.alreadyRead).toBe(0);
    });

    it('returns inserted = 1, alreadyRead = 2 when 2 of 3 verses already exist', async () => {
      const insertedRows = [{ verse_id: 3 }]; // only 1 newly inserted
      const upsertChain = {
        upsert: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({ data: insertedRows, error: null }),
      };
      const mockClient = { from: jest.fn().mockReturnValue(upsertChain) };
      await createService(mockClient);

      const result = await service.markVersesRead(USER_ID, [1, 2, 3]);

      expect(result.inserted).toBe(1);
      expect(result.alreadyRead).toBe(2);
    });

    it('uses upsert with onConflict user_id,verse_id and ignoreDuplicates: true', async () => {
      const upsertChain = {
        upsert: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({ data: [], error: null }),
      };
      const mockClient = { from: jest.fn().mockReturnValue(upsertChain) };
      await createService(mockClient);

      await service.markVersesRead(USER_ID, [1]);

      expect(upsertChain.upsert).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ user_id: USER_ID, verse_id: 1 })]),
        { onConflict: 'user_id,verse_id', ignoreDuplicates: true },
      );
    });

    it('sets read_at server-side and never accepts a client timestamp', async () => {
      const upsertChain = {
        upsert: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({ data: [{ verse_id: 1 }], error: null }),
      };
      const mockClient = { from: jest.fn().mockReturnValue(upsertChain) };
      await createService(mockClient);

      const before = Date.now();
      await service.markVersesRead(USER_ID, [1]);
      const after = Date.now();

      const upsertArg = (upsertChain.upsert.mock.calls[0] as unknown[][])[0] as Array<{
        read_at: string;
      }>;
      const readAt = new Date(upsertArg[0]!.read_at).getTime();
      expect(readAt).toBeGreaterThanOrEqual(before);
      expect(readAt).toBeLessThanOrEqual(after);
    });

    it('throws when DB returns error', async () => {
      const upsertChain = {
        upsert: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({ data: null, error: { message: 'db error' } }),
      };
      const mockClient = { from: jest.fn().mockReturnValue(upsertChain) };
      await createService(mockClient);

      await expect(service.markVersesRead(USER_ID, [1])).rejects.toThrow('Failed to mark verses read');
    });

    it('returns inserted = 0, alreadyRead = 0 when no data returned (edge case)', async () => {
      const upsertChain = {
        upsert: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({ data: null, error: null }),
      };
      const mockClient = { from: jest.fn().mockReturnValue(upsertChain) };
      await createService(mockClient);

      const result = await service.markVersesRead(USER_ID, []);
      expect(result.inserted).toBe(0);
      expect(result.alreadyRead).toBe(0);
    });
  });

  describe('getContinuePosition', () => {
    function buildContinueMockClient(
      userPlanId: string | null,
      firstDay: unknown,
      lastDay: unknown,
      nextVerse: unknown,
    ) {
      let fromCallCount = 0;
      return {
        from: jest.fn().mockImplementation((table: string) => {
          fromCallCount++;
          if (table === 'users') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              is: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: userPlanId ? { plan_id: userPlanId } : { plan_id: null },
                error: null,
              }),
            };
          }
          if (table === 'plans') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              limit: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({ data: { id: 'plan-1' }, error: null }),
            };
          }
          if (table === 'plan_days') {
            // first call = lastDay query (desc), second = firstDay query (asc)
            const isFirst = fromCallCount <= 3;
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              order: jest.fn().mockReturnThis(),
              limit: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: isFirst ? lastDay : firstDay,
                error: null,
              }),
            };
          }
          if (table === 'verse_reads') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            };
          }
          if (table === 'verses') {
            return {
              select: jest.fn().mockReturnThis(),
              gte: jest.fn().mockReturnThis(),
              lte: jest.fn().mockReturnThis(),
              order: jest.fn().mockReturnThis(),
              limit: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: nextVerse,
                error: nextVerse ? null : { message: 'not found' },
              }),
            };
          }
          return { select: jest.fn().mockReturnThis() };
        }),
      };
    }

    it('returns first unread verse when some verses have been read', async () => {
      const lastDay = { end_global_order: 31102 };
      const firstDay = { start_global_order: 1 };
      const nextVerseData = {
        id: 5,
        number: 5,
        chapters: { number: 1, books: { name: 'Genesis', usfm_code: 'GEN' } },
      };
      const mockClient = buildContinueMockClient('plan-1', firstDay, lastDay, nextVerseData);
      await createService(mockClient);

      const result = await service.getContinuePosition(USER_ID);

      expect(result).not.toBeNull();
      expect(result?.verseId).toBe(5);
      expect(result?.bookUsfm).toBe('GEN');
      expect(result?.chapterNumber).toBe(1);
    });

    it('returns null when no unread verses remain (all read)', async () => {
      const lastDay = { end_global_order: 31102 };
      const firstDay = { start_global_order: 1 };
      const mockClient = buildContinueMockClient('plan-1', firstDay, lastDay, null);
      await createService(mockClient);

      const result = await service.getContinuePosition(USER_ID);
      expect(result).toBeNull();
    });
  });

  describe('getProgressSummary', () => {
    // Pin "today" to 2026-04-01 UTC for all streak / ahead-behind tests
    beforeAll(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-04-01T12:00:00.000Z'));
    });
    afterAll(() => {
      jest.useRealTimers();
    });

    /**
     * Builds a mock Supabase client for getProgressSummary.
     *
     * Call order inside the service:
     *   1. verse_reads — count query          (chain ends at .eq → { count })
     *   2. verse_reads — read_at query        (chain ends at .order → { data })
     *   3. users       — plan info            (chain ends at .single → { data })
     *   4. plan_days   — days up to today     (chain ends at .order → { data })   [optional]
     *   5. rpc         — verses read in range                                     [optional]
     */
    function buildSummaryMockClient({
      verseCount,
      readDates,
      userRow,
      planDays = [],
      versesReadInRange = 0,
    }: {
      verseCount: number;
      readDates: Array<{ read_at: string }>;
      userRow: { plan_id: string | null; plan_start_date: string | null } | null;
      planDays?: Array<{ start_global_order: number; end_global_order: number }>;
      versesReadInRange?: number;
    }) {
      const verseReadsChains = [
        // Call 1 — count query; chain ends at .eq()
        {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ count: verseCount, error: null }),
        },
        // Call 2 — read_at query; chain ends at .order()
        {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: readDates, error: null }),
        },
      ];
      let verseReadsIdx = 0;

      return {
        from: jest.fn().mockImplementation((table: string) => {
          if (table === 'verse_reads') {
            return verseReadsChains[verseReadsIdx++];
          }
          if (table === 'users') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              is: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({ data: userRow, error: null }),
            };
          }
          if (table === 'plan_days') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              lte: jest.fn().mockReturnThis(),
              order: jest.fn().mockResolvedValue({ data: planDays, error: null }),
            };
          }
          return {};
        }),
        rpc: jest.fn().mockResolvedValue({ data: versesReadInRange, error: null }),
      };
    }

    // ── completionPct ────────────────────────────────────────────────────────

    it('completionPct = 0 when no verses read', async () => {
      const mockClient = buildSummaryMockClient({
        verseCount: 0,
        readDates: [],
        userRow: { plan_id: null, plan_start_date: null },
      });
      await createService(mockClient);
      const result = await service.getProgressSummary(USER_ID);
      expect(result.totalVersesRead).toBe(0);
      expect(result.completionPct).toBe(0);
    });

    it('completionPct = 100 when all 31102 verses read', async () => {
      const mockClient = buildSummaryMockClient({
        verseCount: 31102,
        readDates: [],
        userRow: { plan_id: null, plan_start_date: null },
      });
      await createService(mockClient);
      const result = await service.getProgressSummary(USER_ID);
      expect(result.completionPct).toBe(100);
    });

    it('completionPct = 50 for exactly half the Bible', async () => {
      // 15551 / 31102 × 10000 = 4999.8… → round → 5000 → /100 = 50
      const mockClient = buildSummaryMockClient({
        verseCount: 15551,
        readDates: [],
        userRow: { plan_id: null, plan_start_date: null },
      });
      await createService(mockClient);
      const result = await service.getProgressSummary(USER_ID);
      expect(result.completionPct).toBe(50);
    });

    // ── streak ───────────────────────────────────────────────────────────────

    it('streakDays = 0 when no reads at all', async () => {
      const mockClient = buildSummaryMockClient({
        verseCount: 0,
        readDates: [],
        userRow: { plan_id: null, plan_start_date: null },
      });
      await createService(mockClient);
      const result = await service.getProgressSummary(USER_ID);
      expect(result.streakDays).toBe(0);
    });

    it('streakDays = 0 when last read was 2+ days ago', async () => {
      // today = 2026-04-01; last read = 2026-03-29 (3 days ago)
      const mockClient = buildSummaryMockClient({
        verseCount: 5,
        readDates: [
          { read_at: '2026-03-29T10:00:00.000Z' },
          { read_at: '2026-03-29T09:00:00.000Z' },
        ],
        userRow: { plan_id: null, plan_start_date: null },
      });
      await createService(mockClient);
      const result = await service.getProgressSummary(USER_ID);
      expect(result.streakDays).toBe(0);
    });

    it('streakDays = 1 when reads exist only today', async () => {
      const mockClient = buildSummaryMockClient({
        verseCount: 3,
        readDates: [{ read_at: '2026-04-01T08:00:00.000Z' }],
        userRow: { plan_id: null, plan_start_date: null },
      });
      await createService(mockClient);
      const result = await service.getProgressSummary(USER_ID);
      expect(result.streakDays).toBe(1);
    });

    it('streakDays = 3 for 3 consecutive days ending today', async () => {
      // today = 2026-04-01; reads on Apr 1, Mar 31, Mar 30
      const mockClient = buildSummaryMockClient({
        verseCount: 10,
        readDates: [
          { read_at: '2026-04-01T10:00:00.000Z' },
          { read_at: '2026-03-31T10:00:00.000Z' },
          { read_at: '2026-03-30T10:00:00.000Z' },
        ],
        userRow: { plan_id: null, plan_start_date: null },
      });
      await createService(mockClient);
      const result = await service.getProgressSummary(USER_ID);
      expect(result.streakDays).toBe(3);
    });

    it('streakDays = 2 for 2 consecutive days ending yesterday (not today)', async () => {
      // today = 2026-04-01; reads on Mar 31, Mar 30 — streak still counts
      const mockClient = buildSummaryMockClient({
        verseCount: 8,
        readDates: [
          { read_at: '2026-03-31T10:00:00.000Z' },
          { read_at: '2026-03-30T10:00:00.000Z' },
        ],
        userRow: { plan_id: null, plan_start_date: null },
      });
      await createService(mockClient);
      const result = await service.getProgressSummary(USER_ID);
      expect(result.streakDays).toBe(2);
    });

    it('streakDays resets correctly when there is a gap in reads', async () => {
      // today = 2026-04-01; reads on Apr 1, Mar 30 (gap on Mar 31) → streak = 1
      const mockClient = buildSummaryMockClient({
        verseCount: 6,
        readDates: [
          { read_at: '2026-04-01T10:00:00.000Z' },
          { read_at: '2026-03-30T10:00:00.000Z' },
        ],
        userRow: { plan_id: null, plan_start_date: null },
      });
      await createService(mockClient);
      const result = await service.getProgressSummary(USER_ID);
      expect(result.streakDays).toBe(1);
    });

    // ── aheadBehindVerses ────────────────────────────────────────────────────

    it('aheadBehindVerses = null when user has no plan', async () => {
      const mockClient = buildSummaryMockClient({
        verseCount: 50,
        readDates: [],
        userRow: { plan_id: null, plan_start_date: null },
      });
      await createService(mockClient);
      const result = await service.getProgressSummary(USER_ID);
      expect(result.aheadBehindVerses).toBeNull();
    });

    it('aheadBehindVerses = null when plan has no start date', async () => {
      const mockClient = buildSummaryMockClient({
        verseCount: 50,
        readDates: [],
        userRow: { plan_id: 'plan-1', plan_start_date: null },
      });
      await createService(mockClient);
      const result = await service.getProgressSummary(USER_ID);
      expect(result.aheadBehindVerses).toBeNull();
    });

    it('aheadBehindVerses = 0 when exactly on plan', async () => {
      // today = 2026-04-01 = plan start → expectedDayNumber = 1
      // plan day 1 covers verses 1–100 → expectedVerseCount = 100
      // user has read exactly 100 → diff = 0
      const mockClient = buildSummaryMockClient({
        verseCount: 100,
        readDates: [],
        userRow: { plan_id: 'plan-1', plan_start_date: '2026-04-01' },
        planDays: [{ start_global_order: 1, end_global_order: 100 }],
        versesReadInRange: 100,
      });
      await createService(mockClient);
      const result = await service.getProgressSummary(USER_ID);
      expect(result.aheadBehindVerses).toBe(0);
    });

    it('aheadBehindVerses > 0 when ahead of plan', async () => {
      const mockClient = buildSummaryMockClient({
        verseCount: 120,
        readDates: [],
        userRow: { plan_id: 'plan-1', plan_start_date: '2026-04-01' },
        planDays: [{ start_global_order: 1, end_global_order: 100 }],
        versesReadInRange: 120,
      });
      await createService(mockClient);
      const result = await service.getProgressSummary(USER_ID);
      expect(result.aheadBehindVerses).toBe(20);
    });

    it('aheadBehindVerses < 0 when behind plan', async () => {
      const mockClient = buildSummaryMockClient({
        verseCount: 80,
        readDates: [],
        userRow: { plan_id: 'plan-1', plan_start_date: '2026-04-01' },
        planDays: [{ start_global_order: 1, end_global_order: 100 }],
        versesReadInRange: 80,
      });
      await createService(mockClient);
      const result = await service.getProgressSummary(USER_ID);
      expect(result.aheadBehindVerses).toBe(-20);
    });
  });

  describe('getDailyCounts', () => {
    // Pin today to 2026-04-01 UTC so date bucketing is deterministic
    beforeAll(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-04-01T12:00:00.000Z'));
    });
    afterAll(() => {
      jest.useRealTimers();
    });

    function buildDailyCountsMockClient(readDates: Array<{ read_at: string }>) {
      return {
        from: jest.fn().mockImplementation((table: string) => {
          if (table === 'verse_reads') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockResolvedValue({ data: readDates, error: null }),
            };
          }
          return {};
        }),
      };
    }

    it('returns N entries for N days requested', async () => {
      const mockClient = buildDailyCountsMockClient([]);
      await createService(mockClient);
      const result = await service.getDailyCounts(USER_ID, 7);
      expect(result).toHaveLength(7);
    });

    it('returns all zeros when no reads exist', async () => {
      const mockClient = buildDailyCountsMockClient([]);
      await createService(mockClient);
      const result = await service.getDailyCounts(USER_ID, 7);
      expect(result.every((d) => d.count === 0)).toBe(true);
    });

    it('result is sorted in ascending date order', async () => {
      const mockClient = buildDailyCountsMockClient([]);
      await createService(mockClient);
      const result = await service.getDailyCounts(USER_ID, 7);
      for (let i = 1; i < result.length; i++) {
        expect(result[i]!.date > result[i - 1]!.date).toBe(true);
      }
    });

    it('counts reads correctly for dates within the window', async () => {
      // today = 2026-04-01; 7-day window = 2026-03-26 to 2026-04-01
      const mockClient = buildDailyCountsMockClient([
        { read_at: '2026-04-01T09:00:00.000Z' },
        { read_at: '2026-04-01T10:00:00.000Z' },
        { read_at: '2026-03-31T08:00:00.000Z' },
      ]);
      await createService(mockClient);
      const result = await service.getDailyCounts(USER_ID, 7);
      const apr1 = result.find((d) => d.date === '2026-04-01');
      const mar31 = result.find((d) => d.date === '2026-03-31');
      const mar30 = result.find((d) => d.date === '2026-03-30');
      expect(apr1?.count).toBe(2);
      expect(mar31?.count).toBe(1);
      expect(mar30?.count).toBe(0);
    });

    it('ignores reads outside the requested date window', async () => {
      // 2026-03-25 is outside a 7-day window ending 2026-04-01
      const mockClient = buildDailyCountsMockClient([
        { read_at: '2026-03-25T10:00:00.000Z' },
      ]);
      await createService(mockClient);
      const result = await service.getDailyCounts(USER_ID, 7);
      expect(result.every((d) => d.count === 0)).toBe(true);
    });
  });

  describe('resetProgress', () => {
    /**
     * resetProgress call order:
     *   1. verse_reads SELECT  → { data: rows }          (ends at .eq())
     *   2. archived_verse_reads INSERT → { error }       (ends at .insert())
     *   3. verse_reads DELETE  → { error }               (ends at .eq())
     */
    function buildResetMockClient({
      rows,
      archiveError = null,
      deleteError = null,
    }: {
      rows: Array<{ verse_id: number; read_at: string }>;
      archiveError?: unknown;
      deleteError?: unknown;
    }) {
      let verseReadsCallCount = 0;

      return {
        from: jest.fn().mockImplementation((table: string) => {
          if (table === 'verse_reads') {
            verseReadsCallCount++;
            if (verseReadsCallCount === 1) {
              // SELECT
              return {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockResolvedValue({ data: rows, error: null }),
              };
            }
            // DELETE
            return {
              delete: jest.fn().mockReturnThis(),
              eq: jest.fn().mockResolvedValue({ error: deleteError }),
            };
          }
          if (table === 'archived_verse_reads') {
            return {
              insert: jest.fn().mockResolvedValue({ error: archiveError }),
            };
          }
          return {};
        }),
      };
    }

    it('returns archivedCount = 0 when no reads exist', async () => {
      const mockClient = buildResetMockClient({ rows: [] });
      await createService(mockClient);

      const result = await service.resetProgress(USER_ID);
      expect(result.archivedCount).toBe(0);
    });

    it('returns archivedCount = N when N reads are archived', async () => {
      const rows = [
        { verse_id: 1, read_at: '2026-04-01T10:00:00.000Z' },
        { verse_id: 2, read_at: '2026-04-01T10:01:00.000Z' },
        { verse_id: 3, read_at: '2026-04-01T10:02:00.000Z' },
      ];
      const mockClient = buildResetMockClient({ rows });
      await createService(mockClient);

      const result = await service.resetProgress(USER_ID);
      expect(result.archivedCount).toBe(3);
    });

    it('inserts correct payload into archived_verse_reads', async () => {
      const rows = [{ verse_id: 42, read_at: '2026-04-01T10:00:00.000Z' }];
      const archiveInsert = jest.fn().mockResolvedValue({ error: null });

      const mockClient = {
        from: jest.fn().mockImplementation((table: string) => {
          if (table === 'verse_reads') {
            const callCount = (mockClient.from.mock.calls as unknown[][]).filter(
              (c) => c[0] === 'verse_reads',
            ).length;
            if (callCount === 1) {
              return {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockResolvedValue({ data: rows, error: null }),
              };
            }
            return {
              delete: jest.fn().mockReturnThis(),
              eq: jest.fn().mockResolvedValue({ error: null }),
            };
          }
          if (table === 'archived_verse_reads') {
            return { insert: archiveInsert };
          }
          return {};
        }),
      };
      await createService(mockClient);

      await service.resetProgress(USER_ID);

      expect(archiveInsert).toHaveBeenCalledWith([
        { user_id: USER_ID, verse_id: 42, read_at: '2026-04-01T10:00:00.000Z' },
      ]);
    });

    it('does NOT call delete when archive insert fails', async () => {
      const rows = [{ verse_id: 1, read_at: '2026-04-01T10:00:00.000Z' }];
      const mockClient = buildResetMockClient({
        rows,
        archiveError: { message: 'archive failed' },
      });
      await createService(mockClient);

      await expect(service.resetProgress(USER_ID)).rejects.toThrow('Failed to archive');

      // delete should never have been called
      const deleteCalls = (mockClient.from.mock.calls as unknown[][]).filter(
        (c) => c[0] === 'verse_reads',
      );
      // Only 1 call to verse_reads (the SELECT) — the DELETE call would be the 2nd
      expect(deleteCalls).toHaveLength(1);
    });
  });

  describe('exportProgress', () => {
    function buildExportMockClient(rows: Array<{ verse_id: number; read_at: string }>) {
      return {
        from: jest.fn().mockImplementation((table: string) => {
          if (table === 'verse_reads') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              order: jest.fn().mockResolvedValue({ data: rows, error: null }),
            };
          }
          return {};
        }),
      };
    }

    it('returns empty verseReads when no reads exist', async () => {
      const mockClient = buildExportMockClient([]);
      await createService(mockClient);

      const result = await service.exportProgress(USER_ID);
      expect(result.verseReads).toHaveLength(0);
    });

    it('maps verse_id → verseId and read_at → readAt correctly', async () => {
      const mockClient = buildExportMockClient([
        { verse_id: 100, read_at: '2026-04-01T08:00:00.000Z' },
        { verse_id: 200, read_at: '2026-04-01T09:00:00.000Z' },
      ]);
      await createService(mockClient);

      const result = await service.exportProgress(USER_ID);
      expect(result.verseReads).toEqual([
        { verseId: 100, readAt: '2026-04-01T08:00:00.000Z' },
        { verseId: 200, readAt: '2026-04-01T09:00:00.000Z' },
      ]);
    });

    it('includes userId and a valid ISO exportedAt timestamp', async () => {
      const mockClient = buildExportMockClient([]);
      await createService(mockClient);

      const before = Date.now();
      const result = await service.exportProgress(USER_ID);
      const after = Date.now();

      expect(result.userId).toBe(USER_ID);
      const exportedAtMs = new Date(result.exportedAt).getTime();
      expect(exportedAtMs).toBeGreaterThanOrEqual(before);
      expect(exportedAtMs).toBeLessThanOrEqual(after);
    });
  });
});
