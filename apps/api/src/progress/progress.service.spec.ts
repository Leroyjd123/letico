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
});
