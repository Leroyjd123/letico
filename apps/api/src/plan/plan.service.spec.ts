/**
 * plan.service.spec.ts
 *
 * Tests for PlanService.
 * DB is always mocked. Tests verify UTC date arithmetic, label generation,
 * offset computation, and NotFoundException on missing days.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PlanService } from './plan.service';
import { SupabaseProvider } from '../supabase/supabase.provider';

/** Returns a mock for the Supabase fluent chain that resolves with given data */
function makeSingleMock(data: unknown, error: unknown = null) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data, error }),
  };
}

const FAKE_PLAN_ID = 'plan-uuid-123';
const FAKE_USER_ID = 'user-uuid-456';

const fakePlanDayRow = {
  id: 'day-uuid-001',
  plan_id: FAKE_PLAN_ID,
  day_number: 1,
  start_verse_id: 1,
  end_verse_id: 31,
  start_global_order: 1,
  end_global_order: 31,
};

const fakeVerseWithContext = {
  number: 1,
  chapters: {
    number: 1,
    books: { name: 'Genesis', usfm_code: 'GEN' },
  },
};

const fakeEndVerseWithContext = {
  number: 31,
  chapters: {
    number: 1,
    books: { name: 'Genesis', usfm_code: 'GEN' },
  },
};

describe('PlanService', () => {
  let service: PlanService;
  let callCount: number;

  function buildMockClient(
    userRow: unknown,
    planRow: unknown,
    planDayRow: unknown,
    startVerseData: unknown,
    endVerseData: unknown,
  ) {
    callCount = 0;
    let versesCallCount = 0;
    return {
      from: jest.fn().mockImplementation((table: string) => {
        callCount++;
        if (table === 'users') return makeSingleMock(userRow);
        if (table === 'plans') return makeSingleMock(planRow);
        if (table === 'plan_days') return makeSingleMock(planDayRow);
        if (table === 'verses') {
          versesCallCount++;
          // First verses call = start verse context, second = end verse context
          const vData = versesCallCount === 1 ? startVerseData : endVerseData;
          return makeSingleMock(vData);
        }
        return makeSingleMock(null, { message: 'unexpected table' });
      }),
    };
  }

  async function createService(mockClient: unknown) {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlanService,
        {
          provide: SupabaseProvider,
          useValue: { getClient: () => mockClient },
        },
      ],
    }).compile();
    service = module.get<PlanService>(PlanService);
  }

  describe('getPlanToday', () => {
    it('returns day 1 when plan_start_date is null', async () => {
      const userRow = { id: FAKE_USER_ID, plan_id: FAKE_PLAN_ID, plan_start_date: null };
      const mockClient = buildMockClient(
        userRow, null, fakePlanDayRow, fakeVerseWithContext, fakeEndVerseWithContext,
      );
      await createService(mockClient);

      const result = await service.getPlanToday(FAKE_USER_ID);

      expect(result.dayNumber).toBe(1);
      expect(result.isToday).toBe(true);
      expect(result.offsetFromToday).toBe(0);
    });

    it('computes correct day number from plan_start_date', async () => {
      // Set start date to 4 days ago → today should be day 5
      const fourDaysAgo = new Date();
      fourDaysAgo.setUTCDate(fourDaysAgo.getUTCDate() - 4);
      const startDateStr = fourDaysAgo.toISOString().slice(0, 10);

      const planDayRow5 = { ...fakePlanDayRow, day_number: 5 };
      const userRow = { id: FAKE_USER_ID, plan_id: FAKE_PLAN_ID, plan_start_date: startDateStr };
      const mockClient = buildMockClient(
        userRow, null, planDayRow5, fakeVerseWithContext, fakeEndVerseWithContext,
      );
      await createService(mockClient);

      const result = await service.getPlanToday(FAKE_USER_ID);

      expect(result.dayNumber).toBe(5);
      expect(result.isToday).toBe(true);
      expect(result.offsetFromToday).toBe(0);
    });

    it('defaults to 1yr plan when user has no plan_id', async () => {
      const userRow = { id: FAKE_USER_ID, plan_id: null, plan_start_date: null };
      const defaultPlan = { id: FAKE_PLAN_ID };
      const mockClient = buildMockClient(
        userRow, defaultPlan, fakePlanDayRow, fakeVerseWithContext, fakeEndVerseWithContext,
      );
      await createService(mockClient);

      const result = await service.getPlanToday(FAKE_USER_ID);
      expect(result.dayNumber).toBe(1);
    });
  });

  describe('getPlanDay', () => {
    it('returns the requested day with correct offsetFromToday', async () => {
      // plan_start_date = today → day 1 is today → day 3 offset = +2
      const today = new Date().toISOString().slice(0, 10);
      const userRow = { id: FAKE_USER_ID, plan_id: FAKE_PLAN_ID, plan_start_date: today };
      const planDayRow3 = { ...fakePlanDayRow, day_number: 3 };
      const mockClient = buildMockClient(
        userRow, null, planDayRow3, fakeVerseWithContext, fakeEndVerseWithContext,
      );
      await createService(mockClient);

      const result = await service.getPlanDay(FAKE_PLAN_ID, 3, FAKE_USER_ID);

      expect(result.dayNumber).toBe(3);
      expect(result.offsetFromToday).toBe(2);
      expect(result.isToday).toBe(false);
    });

    it('throws NotFoundException with PLAN_DAY_NOT_FOUND when day does not exist', async () => {
      const userRow = { id: FAKE_USER_ID, plan_id: FAKE_PLAN_ID, plan_start_date: null };
      const mockClient = buildMockClient(
        userRow, null, null, null, null,
      );
      // Override plan_days to return error
      const originalFrom = mockClient.from;
      mockClient.from = jest.fn().mockImplementation((table: string) => {
        if (table === 'plan_days') return makeSingleMock(null, { message: 'not found' });
        return originalFrom(table);
      });
      await createService(mockClient);

      await expect(service.getPlanDay(FAKE_PLAN_ID, 999, FAKE_USER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('buildLabel (via getPlanToday)', () => {
    it('produces single-chapter label when start and end are in the same chapter', async () => {
      const userRow = { id: FAKE_USER_ID, plan_id: FAKE_PLAN_ID, plan_start_date: null };
      const mockClient = buildMockClient(
        userRow, null, fakePlanDayRow, fakeVerseWithContext, fakeEndVerseWithContext,
      );
      await createService(mockClient);

      const result = await service.getPlanToday(FAKE_USER_ID);
      expect(result.label).toBe('genesis 1');
    });

    it('produces multi-chapter label when start and end are in different chapters', async () => {
      const endVerseMultiChapter = {
        number: 25,
        chapters: { number: 3, books: { name: 'Genesis', usfm_code: 'GEN' } },
      };
      const userRow = { id: FAKE_USER_ID, plan_id: FAKE_PLAN_ID, plan_start_date: null };
      const mockClient = buildMockClient(
        userRow, null, fakePlanDayRow, fakeVerseWithContext, endVerseMultiChapter,
      );
      await createService(mockClient);

      const result = await service.getPlanToday(FAKE_USER_ID);
      expect(result.label).toBe('genesis 1–3');
    });
  });
});
