import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { SupabaseProvider } from '../supabase/supabase.provider';
import { mockSupabase, mockProvider, type MockResult, type RecordedQuery } from '../testing/mock-supabase';

const USER_ID = 'auth-user-uuid';

async function build(
  opts: { from?: (q: RecordedQuery) => MockResult; rpc?: Record<string, () => MockResult> },
  authClient?: unknown,
) {
  const db = mockSupabase(opts);
  const provider = mockProvider(db.client, authClient ?? db.client);
  const mod = await Test.createTestingModule({
    providers: [AuthService, { provide: SupabaseProvider, useValue: provider }],
  }).compile();
  return { service: mod.get(AuthService), db, provider };
}

describe('AuthService.createGuest', () => {
  it('creates a guest on the default plan without a start date', async () => {
    const { service, db } = await build({
      rpc: { default_plan_id: () => ({ data: 'plan-1' }) },
      from: () => ({ data: { guest_token: 'tok', created_at: '2026-03-30T00:00:00Z' } }),
    });
    const result = await service.createGuest();
    expect(result).toEqual({ guestToken: 'tok', createdAt: '2026-03-30T00:00:00Z' });
    const inserted = db.queries[0]!.argsOf('insert')[0] as Record<string, unknown>;
    expect(inserted['plan_id']).toBe('plan-1');
    expect(inserted['plan_start_date']).toBeUndefined();
  });

  it('throws GUEST_CREATE_FAILED when the insert fails', async () => {
    const { service } = await build({
      rpc: { default_plan_id: () => ({ data: null }) },
      from: () => ({ error: { message: 'boom' } }),
    });
    await expect(service.createGuest()).rejects.toThrow(ConflictException);
  });
});

describe('AuthService OTP — never touches the shared data client session', () => {
  it('sends the OTP through a throwaway auth client', async () => {
    const authClient = { auth: { signInWithOtp: jest.fn().mockResolvedValue({ error: null }) } };
    const { service, db, provider } = await build({}, authClient);
    await expect(service.sendOtp('user@example.com')).resolves.toEqual({ sent: true });
    expect(provider.createAuthClient).toHaveBeenCalled();
    expect(db.client.auth.signInWithOtp).not.toHaveBeenCalled();
  });

  it('rejects malformed emails', async () => {
    const { service } = await build({});
    await expect(service.sendOtp('not-an-email')).rejects.toThrow(BadRequestException);
  });

  it('maps a Supabase send error to OTP_SEND_FAILED', async () => {
    const authClient = { auth: { signInWithOtp: jest.fn().mockResolvedValue({ error: { message: 'rate' } }) } };
    const { service } = await build({}, authClient);
    await expect(service.sendOtp('user@example.com')).rejects.toThrow(BadRequestException);
  });

  it('verifies via the throwaway client and upserts the user on the data client', async () => {
    const authClient = {
      auth: {
        verifyOtp: jest.fn().mockResolvedValue({
          data: {
            session: { access_token: 'acc', refresh_token: 'ref' },
            user: { id: USER_ID, email: 'user@example.com' },
          },
          error: null,
        }),
      },
    };
    const { service, db } = await build({ from: () => ({}) }, authClient);
    const result = await service.verifyOtp('user@example.com', '123456');
    expect(result).toEqual({
      accessToken: 'acc',
      refreshToken: 'ref',
      user: { id: USER_ID, email: 'user@example.com' },
    });
    expect(db.client.auth.verifyOtp).not.toHaveBeenCalled();
    expect(db.queries[0]!.table).toBe('users');
    expect(db.queries[0]!.has('upsert')).toBe(true);
  });

  it('throws INVALID_OTP when verification fails', async () => {
    const authClient = {
      auth: { verifyOtp: jest.fn().mockResolvedValue({ data: { session: null, user: null }, error: { message: 'x' } }) },
    };
    const { service } = await build({}, authClient);
    await expect(service.verifyOtp('u@e.com', '000000')).rejects.toThrow(UnauthorizedException);
  });

  it('surfaces a failed user upsert instead of ignoring it', async () => {
    const authClient = {
      auth: {
        verifyOtp: jest.fn().mockResolvedValue({
          data: { session: { access_token: 'a', refresh_token: 'r' }, user: { id: USER_ID, email: 'u@e.com' } },
          error: null,
        }),
      },
    };
    const { service } = await build({ from: () => ({ error: { message: 'down' } }) }, authClient);
    await expect(service.verifyOtp('u@e.com', '123456')).rejects.toThrow(InternalServerErrorException);
  });
});

describe('AuthService.migrateGuest', () => {
  it('delegates to the transactional migrate_guest function', async () => {
    const { service, db } = await build({
      rpc: { migrate_guest: () => ({ data: [{ migrated_reads: 1200, already_migrated: false }] }) },
    });
    await expect(service.migrateGuest(USER_ID, 'guest-tok')).resolves.toEqual({
      migratedReads: 1200,
      alreadyMigrated: false,
    });
    expect(db.rpcCalls[0]).toEqual({
      fn: 'migrate_guest',
      args: { p_guest_token: 'guest-tok', p_user_id: USER_ID },
    });
  });

  it('reports alreadyMigrated for unknown tokens', async () => {
    const { service } = await build({
      rpc: { migrate_guest: () => ({ data: [{ migrated_reads: 0, already_migrated: true }] }) },
    });
    await expect(service.migrateGuest(USER_ID, 'gone')).resolves.toEqual({
      migratedReads: 0,
      alreadyMigrated: true,
    });
  });

  it('throws instead of reporting success when the migration fails', async () => {
    const { service } = await build({ rpc: { migrate_guest: () => ({ error: { message: 'x' } }) } });
    await expect(service.migrateGuest(USER_ID, 'tok')).rejects.toThrow(InternalServerErrorException);
  });
});

describe('AuthService.getMe', () => {
  it('falls back to the default plan when the user has none', async () => {
    const { service } = await build({
      rpc: { default_plan_id: () => ({ data: 'plan-default' }) },
      from: () => ({ data: { id: USER_ID, plan_id: null, plan_start_date: '2026-01-01' } }),
    });
    await expect(service.getMe(USER_ID)).resolves.toEqual({
      id: USER_ID,
      planId: 'plan-default',
      planStartDate: '2026-01-01',
    });
  });
});
