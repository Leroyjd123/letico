/**
 * users.service.spec.ts
 *
 * Tests for UsersService.updateUser().
 * DB is always mocked — chain: .from().update().eq().is().select().single()
 */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { SupabaseProvider } from '../supabase/supabase.provider';

const USER_ID = 'user-uuid-test';
const PLAN_ID = 'plan-uuid-test';

describe('UsersService', () => {
  let service: UsersService;

  async function createService(mockClient: unknown) {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: SupabaseProvider,
          useValue: { getClient: () => mockClient },
        },
      ],
    }).compile();
    service = module.get<UsersService>(UsersService);
  }

  function buildMockClient(
    data: unknown,
    error: unknown = null,
  ) {
    const chain = {
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data, error }),
    };
    return { from: jest.fn().mockReturnValue(chain), _chain: chain };
  }

  describe('updateUser', () => {
    it('updates plan_id and returns the new value', async () => {
      const { _chain, ...mockClient } = buildMockClient({
        plan_id: PLAN_ID,
        plan_start_date: null,
      });
      await createService(mockClient);

      const result = await service.updateUser(USER_ID, { planId: PLAN_ID });

      expect(result.planId).toBe(PLAN_ID);
      expect(result.planStartDate).toBeNull();
      expect(_chain.update).toHaveBeenCalledWith(
        expect.objectContaining({ plan_id: PLAN_ID }),
      );
    });

    it('updates plan_start_date and returns the new value', async () => {
      const { _chain, ...mockClient } = buildMockClient({
        plan_id: null,
        plan_start_date: '2026-04-01',
      });
      await createService(mockClient);

      const result = await service.updateUser(USER_ID, { planStartDate: '2026-04-01' });

      expect(result.planStartDate).toBe('2026-04-01');
      expect(_chain.update).toHaveBeenCalledWith(
        expect.objectContaining({ plan_start_date: '2026-04-01' }),
      );
    });

    it('updates both fields together', async () => {
      const { _chain, ...mockClient } = buildMockClient({
        plan_id: PLAN_ID,
        plan_start_date: '2026-04-01',
      });
      await createService(mockClient);

      const result = await service.updateUser(USER_ID, {
        planId: PLAN_ID,
        planStartDate: '2026-04-01',
      });

      expect(result.planId).toBe(PLAN_ID);
      expect(result.planStartDate).toBe('2026-04-01');
      expect(_chain.update).toHaveBeenCalledWith({
        plan_id: PLAN_ID,
        plan_start_date: '2026-04-01',
      });
    });

    it('throws NotFoundException when DB returns an error', async () => {
      const { ...mockClient } = buildMockClient(null, { message: 'not found' });
      await createService(mockClient);

      await expect(
        service.updateUser(USER_ID, { planId: PLAN_ID }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when data is null (user row not found)', async () => {
      const { ...mockClient } = buildMockClient(null, null);
      await createService(mockClient);

      await expect(
        service.updateUser(USER_ID, { planId: PLAN_ID }),
      ).rejects.toThrow(NotFoundException);
    });

    it('only includes defined fields in the update object (no undefined keys)', async () => {
      const { _chain, ...mockClient } = buildMockClient({
        plan_id: PLAN_ID,
        plan_start_date: null,
      });
      await createService(mockClient);

      // Only planId provided — plan_start_date must NOT be in the update payload
      await service.updateUser(USER_ID, { planId: PLAN_ID });

      const updateArg = (_chain.update.mock.calls[0] as unknown[][])[0] as Record<string, unknown>;
      expect(Object.keys(updateArg)).toEqual(['plan_id']);
      expect(updateArg['plan_start_date']).toBeUndefined();
    });
  });
});
