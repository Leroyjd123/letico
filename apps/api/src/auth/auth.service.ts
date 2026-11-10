/**
 * auth.service.ts
 *
 * Phase 2: guest user creation.
 * Phase 3: GET /auth/me.
 * Phase 5: OTP send/verify, guest migration.
 */
import {
  Injectable,
  ConflictException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectSupabase } from '../supabase/inject-supabase.decorator';
import { SupabaseProvider } from '../supabase/supabase.provider';
import { dbError } from '../common/db-errors';
import { getDefaultPlanId } from '../common/user-plan';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Injectable()
export class AuthService {
  constructor(@InjectSupabase() private readonly supabase: SupabaseProvider) {}

  // ── GET /auth/me ──────────────────────────────────────────────────────────

  /** Returns the authenticated user's profile including their planId and planStartDate. */
  async getMe(userId: string): Promise<{ id: string; planId: string | null; planStartDate: string | null }> {
    const db = this.supabase.getClient();
    const { data: userRow, error } = await db
      .from('users')
      .select('id, plan_id, plan_start_date')
      .eq('id', userId)
      .is('archived_at', null)
      .maybeSingle();
    if (error) dbError('USER_LOOKUP_FAILED', error);

    const row = userRow as { plan_id: string | null; plan_start_date: string | null } | null;
    return {
      id: userId,
      planId: row?.plan_id ?? (await getDefaultPlanId(db)),
      planStartDate: row?.plan_start_date ?? null,
    };
  }

  // ── POST /auth/guest ──────────────────────────────────────────────────────

  /**
   * Creates a guest user row in the users table.
   * The guest_token is a UUID that the client must store in localStorage.
   * plan_id defaults to the default plan so plan/today works immediately;
   * plan_start_date stays null until the reader picks one.
   */
  async createGuest(): Promise<{ guestToken: string; createdAt: string }> {
    const db = this.supabase.getClient();
    const planId = await getDefaultPlanId(db);

    const { data, error } = await db
      .from('users')
      .insert({ id: crypto.randomUUID(), guest_token: crypto.randomUUID(), plan_id: planId })
      .select('guest_token, created_at')
      .single();

    if (error || !data) {
      throw new ConflictException({
        error: { code: 'GUEST_CREATE_FAILED', message: error?.message ?? 'guest not created' },
      });
    }

    const row = data as { guest_token: string; created_at: string };
    return { guestToken: row.guest_token, createdAt: row.created_at };
  }

  // ── POST /auth/otp/send ───────────────────────────────────────────────────

  /**
   * Validates the email and triggers a Supabase OTP email.
   * Throws BadRequestException with code INVALID_EMAIL for malformed addresses.
   */
  async sendOtp(email: string): Promise<{ sent: true }> {
    // DTO validation already checks this; kept as defence in depth.
    if (!EMAIL_REGEX.test(email)) {
      throw new BadRequestException({
        error: { code: 'INVALID_EMAIL', message: 'Invalid email format' },
      });
    }

    const { error } = await this.supabase.createAuthClient().auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });

    if (error) {
      throw new BadRequestException({
        error: { code: 'OTP_SEND_FAILED', message: error.message },
      });
    }

    return { sent: true };
  }

  // ── POST /auth/otp/verify ─────────────────────────────────────────────────

  /**
   * Verifies the OTP token for the given email.
   * On success: upserts a users row, returns access + refresh tokens.
   * Throws UnauthorizedException with code INVALID_OTP on failure.
   */
  async verifyOtp(
    email: string,
    token: string,
  ): Promise<{ accessToken: string; refreshToken: string; user: { id: string; email: string } }> {
    const { data, error } = await this.supabase.createAuthClient().auth.verifyOtp({
      email,
      token,
      type: 'email',
    });

    if (error || !data.session || !data.user) {
      throw new UnauthorizedException({
        error: { code: 'INVALID_OTP', message: 'Invalid or expired code — request a new one' },
      });
    }

    const { id, email: userEmail } = data.user;
    const { access_token, refresh_token } = data.session;

    // Upsert users table — handles returning users on a new device gracefully
    const { error: upsertError } = await this.supabase
      .getClient()
      .from('users')
      .upsert({ id, email: userEmail ?? email }, { onConflict: 'id' });
    if (upsertError) dbError('USER_UPSERT_FAILED', upsertError);

    return {
      accessToken: access_token,
      refreshToken: refresh_token,
      user: { id, email: userEmail ?? email },
    };
  }

  // ── POST /auth/migrate ────────────────────────────────────────────────────

  /**
   * Moves ALL of a guest's verse_reads (plus plan and start date, if the
   * account has none) to the authenticated user and archives the guest —
   * in a single transaction (migrate_guest SQL function). Duplicate reads are
   * skipped. Safe to call repeatedly: later calls return alreadyMigrated: true.
   */
  async migrateGuest(
    authenticatedUserId: string,
    guestToken: string,
  ): Promise<{ migratedReads: number; alreadyMigrated: boolean }> {
    const { data, error } = await this.supabase.getClient().rpc('migrate_guest', {
      p_guest_token: guestToken,
      p_user_id: authenticatedUserId,
    });
    if (error) dbError('MIGRATION_FAILED', error);

    const row = ((data ?? []) as Array<{ migrated_reads: number; already_migrated: boolean }>)[0];
    return {
      migratedReads: row?.migrated_reads ?? 0,
      alreadyMigrated: row?.already_migrated ?? true,
    };
  }
}
