/**
 * auth.service.spec.ts
 *
 * Unit tests for AuthService.
 * DB and Supabase auth client are always mocked.
 * Covers: createGuest, sendOtp, verifyOtp, migrateGuest.
 */
import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { SupabaseProvider } from '../supabase/supabase.provider';

const TODAY = new Date().toISOString().slice(0, 10);
const USER_ID = 'auth-user-uuid';
const GUEST_TOKEN = 'guest-token-uuid';

// ── Mock factory helpers ───────────────────────────────────────────────────

function buildPlanChain(planId: string | null) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: planId ? { id: planId } : null }),
  };
}

function buildInsertChain(result: unknown, error: unknown = null) {
  return {
    insert: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: result, error }),
  };
}

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
  return module.get<AuthService>(AuthService);
}

// ── createGuest ────────────────────────────────────────────────────────────

describe('AuthService.createGuest', () => {
  it('creates a guest user row and returns guestToken + createdAt', async () => {
    const planChain = buildPlanChain('plan-uuid');
    const insertChain = buildInsertChain({
      guest_token: 'test-token',
      created_at: '2026-03-30T00:00:00Z',
    });
    const mockClient = {
      from: jest.fn().mockImplementation((t: string) =>
        t === 'plans' ? planChain : insertChain,
      ),
    };
    const service = await createService(mockClient);

    const result = await service.createGuest();

    expect(result.guestToken).toBe('test-token');
    expect(result.createdAt).toBe('2026-03-30T00:00:00Z');
  });

  it('inserts with today as plan_start_date', async () => {
    const insertChain = buildInsertChain({ guest_token: 'tok', created_at: '2026-03-30T00:00:00Z' });
    const mockClient = {
      from: jest.fn().mockImplementation((t: string) =>
        t === 'plans' ? buildPlanChain('plan-uuid') : insertChain,
      ),
    };
    const service = await createService(mockClient);

    await service.createGuest();

    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ plan_start_date: TODAY }),
    );
  });

  it('assigns the 1yr plan as default plan_id', async () => {
    const PLAN_ID = 'plan-1yr-uuid';
    const insertChain = buildInsertChain({ guest_token: 'tok', created_at: '2026-03-30T00:00:00Z' });
    const mockClient = {
      from: jest.fn().mockImplementation((t: string) =>
        t === 'plans' ? buildPlanChain(PLAN_ID) : insertChain,
      ),
    };
    const service = await createService(mockClient);

    await service.createGuest();

    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ plan_id: PLAN_ID }),
    );
  });

  it('uses plan_id: null when no plan is found', async () => {
    const insertChain = buildInsertChain({ guest_token: 'tok', created_at: '2026-03-30T00:00:00Z' });
    const mockClient = {
      from: jest.fn().mockImplementation((t: string) =>
        t === 'plans' ? buildPlanChain(null) : insertChain,
      ),
    };
    const service = await createService(mockClient);

    await service.createGuest();

    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ plan_id: null }),
    );
  });

  it('throws ConflictException with GUEST_CREATE_FAILED when insert fails', async () => {
    const insertChain = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: { message: 'constraint violation' } }),
    };
    const mockClient = {
      from: jest.fn().mockImplementation((t: string) =>
        t === 'plans' ? buildPlanChain('plan-uuid') : insertChain,
      ),
    };
    const service = await createService(mockClient);

    await expect(service.createGuest()).rejects.toThrow(ConflictException);
  });
});

// ── sendOtp ────────────────────────────────────────────────────────────────

describe('AuthService.sendOtp', () => {
  function buildOtpClient(error: unknown = null) {
    return {
      from: jest.fn(),
      auth: {
        signInWithOtp: jest.fn().mockResolvedValue({ error }),
      },
    };
  }

  it('returns { sent: true } for a valid email', async () => {
    const service = await createService(buildOtpClient());

    const result = await service.sendOtp('user@example.com');

    expect(result).toEqual({ sent: true });
  });

  it('throws BadRequestException with INVALID_EMAIL for a malformed address', async () => {
    const service = await createService(buildOtpClient());

    await expect(service.sendOtp('not-an-email')).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException with INVALID_EMAIL for empty string', async () => {
    const service = await createService(buildOtpClient());

    await expect(service.sendOtp('')).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException with OTP_SEND_FAILED when Supabase returns an error', async () => {
    const service = await createService(buildOtpClient({ message: 'rate limited' }));

    await expect(service.sendOtp('user@example.com')).rejects.toThrow(BadRequestException);
  });
});

// ── verifyOtp ──────────────────────────────────────────────────────────────

describe('AuthService.verifyOtp', () => {
  function buildVerifyClient(opts: {
    verifyResult: { data: unknown; error: unknown };
    upsertShouldFail?: boolean;
  }) {
    const upsertChain = {
      upsert: jest.fn().mockResolvedValue({ error: opts.upsertShouldFail ? { message: 'fail' } : null }),
    };
    return {
      from: jest.fn().mockReturnValue(upsertChain),
      auth: {
        verifyOtp: jest.fn().mockResolvedValue(opts.verifyResult),
      },
    };
  }

  it('returns accessToken, refreshToken, and user on success', async () => {
    const mockClient = buildVerifyClient({
      verifyResult: {
        data: {
          session: { access_token: 'acc-tok', refresh_token: 'ref-tok' },
          user: { id: USER_ID, email: 'user@example.com' },
        },
        error: null,
      },
    });
    const service = await createService(mockClient);

    const result = await service.verifyOtp('user@example.com', '123456');

    expect(result.accessToken).toBe('acc-tok');
    expect(result.refreshToken).toBe('ref-tok');
    expect(result.user).toEqual({ id: USER_ID, email: 'user@example.com' });
  });

  it('throws UnauthorizedException with INVALID_OTP when Supabase returns an error', async () => {
    const mockClient = buildVerifyClient({
      verifyResult: { data: { session: null, user: null }, error: { message: 'otp expired' } },
    });
    const service = await createService(mockClient);

    await expect(service.verifyOtp('user@example.com', '000000')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws UnauthorizedException when session is missing from Supabase response', async () => {
    const mockClient = buildVerifyClient({
      verifyResult: { data: { session: null, user: { id: USER_ID, email: 'u@e.com' } }, error: null },
    });
    const service = await createService(mockClient);

    await expect(service.verifyOtp('u@e.com', '123456')).rejects.toThrow(UnauthorizedException);
  });
});

// ── migrateGuest ───────────────────────────────────────────────────────────

describe('AuthService.migrateGuest', () => {
  function buildMigrateClient(opts: {
    guestUser: { id: string } | null;
    guestReads: Array<{ verse_id: number; read_at: string }>;
  }) {
    // Each call to db.from(table) returns a chain based on the table name and call order.
    // users is called twice: once to look up the guest, once to archive it.
    // verse_reads is called once (get reads) and optionally once (upsert).
    let usersCallCount = 0;
    let verseReadsCallCount = 0;

    return {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'users') {
          usersCallCount++;
          if (usersCallCount === 1) {
            // Look up guest user
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              is: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({ data: opts.guestUser }),
            };
          }
          // Archive guest
          return {
            update: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({ error: null }),
          };
        }
        if (table === 'verse_reads') {
          verseReadsCallCount++;
          if (verseReadsCallCount === 1) {
            // Get guest reads
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockResolvedValue({ data: opts.guestReads }),
            };
          }
          // Upsert for authenticated user
          return {
            upsert: jest.fn().mockResolvedValue({ error: null }),
          };
        }
        return {};
      }),
    };
  }

  it('returns alreadyMigrated: true when guest token is not found', async () => {
    const mockClient = buildMigrateClient({ guestUser: null, guestReads: [] });
    const service = await createService(mockClient);

    const result = await service.migrateGuest(USER_ID, GUEST_TOKEN);

    expect(result.alreadyMigrated).toBe(true);
    expect(result.migratedReads).toBe(0);
  });

  it('transfers verse_reads and returns migratedReads count', async () => {
    const reads = [
      { verse_id: 101, read_at: '2026-03-30T00:00:00Z' },
      { verse_id: 102, read_at: '2026-03-30T00:01:00Z' },
    ];
    const mockClient = buildMigrateClient({ guestUser: { id: 'guest-user-uuid' }, guestReads: reads });
    const service = await createService(mockClient);

    const result = await service.migrateGuest(USER_ID, GUEST_TOKEN);

    expect(result.alreadyMigrated).toBe(false);
    expect(result.migratedReads).toBe(2);
  });

  it('returns migratedReads: 0 when guest has no reads (clean migration)', async () => {
    const mockClient = buildMigrateClient({ guestUser: { id: 'guest-user-uuid' }, guestReads: [] });
    const service = await createService(mockClient);

    const result = await service.migrateGuest(USER_ID, GUEST_TOKEN);

    expect(result.migratedReads).toBe(0);
    expect(result.alreadyMigrated).toBe(false);
  });
});
