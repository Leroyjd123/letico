/**
 * auth.service.spec.ts
 *
 * Unit tests for AuthService.
 * DB is always mocked. Tests cover guest user creation and the /auth/me resolver.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SupabaseProvider } from '../supabase/supabase.provider';

const TODAY = new Date().toISOString().slice(0, 10);

describe('AuthService', () => {
  let service: AuthService;

  async function createService(mockClient: unknown) {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: SupabaseProvider,
          useValue: { getClient: () => mockClient },
        },
      ],
    }).compile();
    service = module.get<AuthService>(AuthService);
  }

  // ── createGuest ────────────────────────────────────────────────────────────

  describe('createGuest', () => {
    function buildMockClient(opts: {
      planData: { id: string } | null;
      insertResult: { guest_token: string; created_at: string } | null;
      insertError?: { message: string } | null;
    }) {
      const insertChain = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: opts.insertResult,
          error: opts.insertError ?? null,
        }),
      };
      const planChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: opts.planData }),
      };

      return {
        from: jest.fn().mockImplementation((table: string) => {
          if (table === 'plans') return planChain;
          return insertChain;
        }),
      };
    }

    it('creates a guest user row and returns guestToken + createdAt', async () => {
      const mockClient = buildMockClient({
        planData: { id: 'plan-1yr-uuid' },
        insertResult: { guest_token: 'test-token-uuid', created_at: '2026-03-30T00:00:00Z' },
      });
      await createService(mockClient);

      const result = await service.createGuest();

      expect(result.guestToken).toBe('test-token-uuid');
      expect(result.createdAt).toBe('2026-03-30T00:00:00Z');
    });

    it('inserts into users table with today as plan_start_date', async () => {
      const insertChain = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { guest_token: 'tok', created_at: '2026-03-30T00:00:00Z' },
          error: null,
        }),
      };
      const planChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { id: 'plan-uuid' } }),
      };
      const mockClient = {
        from: jest.fn().mockImplementation((table: string) =>
          table === 'plans' ? planChain : insertChain,
        ),
      };
      await createService(mockClient);

      await service.createGuest();

      expect(insertChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ plan_start_date: TODAY }),
      );
    });

    it('assigns the 1yr plan as default plan_id', async () => {
      const PLAN_ID = 'plan-1yr-uuid';
      const insertChain = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { guest_token: 'tok', created_at: '2026-03-30T00:00:00Z' },
          error: null,
        }),
      };
      const planChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { id: PLAN_ID } }),
      };
      const mockClient = {
        from: jest.fn().mockImplementation((table: string) =>
          table === 'plans' ? planChain : insertChain,
        ),
      };
      await createService(mockClient);

      await service.createGuest();

      expect(insertChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ plan_id: PLAN_ID }),
      );
    });

    it('still creates a guest when no plan is found (plan_id: null)', async () => {
      const insertChain = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { guest_token: 'tok', created_at: '2026-03-30T00:00:00Z' },
          error: null,
        }),
      };
      const planChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null }),
      };
      const mockClient = {
        from: jest.fn().mockImplementation((table: string) =>
          table === 'plans' ? planChain : insertChain,
        ),
      };
      await createService(mockClient);

      await service.createGuest();

      expect(insertChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ plan_id: null }),
      );
    });

    it('throws ConflictException with GUEST_CREATE_FAILED when insert fails', async () => {
      const mockClient = buildMockClient({
        planData: { id: 'plan-uuid' },
        insertResult: null,
        insertError: { message: 'unique constraint violation' },
      });
      await createService(mockClient);

      await expect(service.createGuest()).rejects.toThrow(ConflictException);
    });
  });
});
