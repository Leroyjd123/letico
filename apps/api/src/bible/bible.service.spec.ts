/**
 * bible.service.spec.ts
 *
 * Unit tests for BibleService.
 * The Supabase client is always mocked — never a real database in unit tests.
 * Tests verify: correct DB call arguments, correct DTO mapping, error cases.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { BibleService } from './bible.service';
import { SupabaseProvider } from '../supabase/supabase.provider';

/** Builds a mock Supabase fluent chain */
function buildMockDb(data: unknown, error: unknown = null) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data, error }),
    limit: jest.fn().mockReturnThis(),
  };
  // order() is both chainable and the terminal async call in some paths
  chain.order.mockResolvedValue({ data, error });
  return {
    from: jest.fn().mockReturnValue(chain),
    _chain: chain,
  };
}

describe('BibleService', () => {
  let service: BibleService;
  let mockSupabase: ReturnType<typeof buildMockDb>;

  const sampleBookRow = {
    id: 1,
    usfm_code: 'GEN',
    name: 'Genesis',
    testament: 'OT',
    chapter_count: 50,
    sort_order: 1,
  };

  const sampleChapterRow = {
    id: 1,
    book_id: 1,
    number: 1,
    verse_count: 31,
  };

  const sampleVerseRow = {
    id: 1,
    chapter_id: 1,
    number: 1,
    text: 'In the beginning...',
    global_order: 1,
  };

  beforeEach(async () => {
    mockSupabase = buildMockDb([sampleBookRow]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BibleService,
        {
          provide: SupabaseProvider,
          useValue: {
            getClient: () => mockSupabase,
          },
        },
      ],
    }).compile();

    service = module.get<BibleService>(BibleService);
  });

  // ── getAllBooks ──────────────────────────────────────────────────────────

  describe('getAllBooks', () => {
    it('returns mapped BookDto array ordered by sort_order ascending', async () => {
      mockSupabase = buildMockDb([sampleBookRow]);
      // Reconstruct module with new mock
      const module = await Test.createTestingModule({
        providers: [
          BibleService,
          { provide: SupabaseProvider, useValue: { getClient: () => mockSupabase } },
        ],
      }).compile();
      service = module.get<BibleService>(BibleService);

      const result = await service.getAllBooks();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 1,
        usfmCode: 'GEN',
        name: 'Genesis',
        testament: 'OT',
        chapterCount: 50,
      });
      // global_order and sort_order must not appear in the DTO
      expect(result[0]).not.toHaveProperty('global_order');
      expect(result[0]).not.toHaveProperty('sort_order');
      // DB must be called with ascending sort_order
      expect(mockSupabase._chain.order).toHaveBeenCalledWith('sort_order', { ascending: true });
    });

    it('throws with "Failed to fetch books" on DB error', async () => {
      mockSupabase = buildMockDb(null, { message: 'connection refused' });
      mockSupabase._chain.order.mockResolvedValue({ data: null, error: { message: 'connection refused' } });
      const module = await Test.createTestingModule({
        providers: [
          BibleService,
          { provide: SupabaseProvider, useValue: { getClient: () => mockSupabase } },
        ],
      }).compile();
      service = module.get<BibleService>(BibleService);

      await expect(service.getAllBooks()).rejects.toThrow('Failed to fetch books');
    });
  });

  // ── getBookByUsfm ────────────────────────────────────────────────────────

  describe('getBookByUsfm', () => {
    it('returns correct BookDto for found book', async () => {
      mockSupabase = buildMockDb(sampleBookRow);
      const module = await Test.createTestingModule({
        providers: [
          BibleService,
          { provide: SupabaseProvider, useValue: { getClient: () => mockSupabase } },
        ],
      }).compile();
      service = module.get<BibleService>(BibleService);

      const result = await service.getBookByUsfm('GEN');
      expect(result.usfmCode).toBe('GEN');
      expect(result.name).toBe('Genesis');
    });

    it('normalises usfmCode to uppercase before calling .eq()', async () => {
      mockSupabase = buildMockDb(sampleBookRow);
      const module = await Test.createTestingModule({
        providers: [
          BibleService,
          { provide: SupabaseProvider, useValue: { getClient: () => mockSupabase } },
        ],
      }).compile();
      service = module.get<BibleService>(BibleService);

      await service.getBookByUsfm('gen'); // lowercase input
      expect(mockSupabase._chain.eq).toHaveBeenCalledWith('usfm_code', 'GEN');
    });

    it('throws NotFoundException with BOOK_NOT_FOUND when book not found', async () => {
      mockSupabase = buildMockDb(null, { message: 'not found' });
      const module = await Test.createTestingModule({
        providers: [
          BibleService,
          { provide: SupabaseProvider, useValue: { getClient: () => mockSupabase } },
        ],
      }).compile();
      service = module.get<BibleService>(BibleService);

      await expect(service.getBookByUsfm('XYZ')).rejects.toThrow(NotFoundException);
    });
  });

  // ── getVersesByChapter ───────────────────────────────────────────────────

  describe('getVersesByChapter', () => {
    it('returns VerseDto array without global_order field', async () => {
      // chapter exists check → returns chapter; verses query → returns verses
      let callCount = 0;
      const mockClient = {
        from: jest.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            // chapter existence check
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({ data: sampleChapterRow, error: null }),
            };
          }
          // verses query
          const chain = {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({ data: [sampleVerseRow], error: null }),
          };
          return chain;
        }),
      };

      const module = await Test.createTestingModule({
        providers: [
          BibleService,
          { provide: SupabaseProvider, useValue: { getClient: () => mockClient } },
        ],
      }).compile();
      service = module.get<BibleService>(BibleService);

      const result = await service.getVersesByChapter(1);
      expect(result).toHaveLength(1);
      expect(result[0]).not.toHaveProperty('global_order');
      expect(result[0]).toEqual({ id: 1, chapterId: 1, number: 1, text: 'In the beginning...' });
    });

    it('throws NotFoundException with CHAPTER_NOT_FOUND when chapter does not exist', async () => {
      const mockClient = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
        }),
      };

      const module = await Test.createTestingModule({
        providers: [
          BibleService,
          { provide: SupabaseProvider, useValue: { getClient: () => mockClient } },
        ],
      }).compile();
      service = module.get<BibleService>(BibleService);

      await expect(service.getVersesByChapter(99999)).rejects.toThrow(NotFoundException);
    });
  });
});
