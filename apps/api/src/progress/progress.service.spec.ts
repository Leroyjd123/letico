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
});
