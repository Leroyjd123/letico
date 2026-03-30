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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Injectable()
export class AuthService {
  constructor(@InjectSupabase() private readonly supabase: SupabaseProvider) {}

  // ── GET /auth/me ──────────────────────────────────────────────────────────

  /** Returns the authenticated user's profile including their planId. */
  async getMe(userId: string): Promise<{ id: string; planId: string | null }> {
    const db = this.supabase.getClient();

    const { data: userRow } = await db
      .from('users')
      .select('id, plan_id')
      .eq('id', userId)
      .is('archived_at', null)
      .single();

    if (!userRow) {
      return { id: userId, planId: null };
    }

    let planId = (userRow as { id: string; plan_id: string | null }).plan_id;

    if (!planId) {
      const { data: defaultPlan } = await db
        .from('plans')
        .select('id')
        .eq('name', '1 year plan')
        .limit(1)
        .single();
      planId = defaultPlan ? (defaultPlan as { id: string }).id : null;
    }

    return { id: userId, planId };
  }

  // ── POST /auth/guest ──────────────────────────────────────────────────────

  /**
   * Creates a guest user row in the users table.
   * The guest_token is a UUID that the client must store in localStorage.
   * The plan_id defaults to the 1yr plan so plan/today works immediately.
   */
  async createGuest(): Promise<{ guestToken: string; createdAt: string }> {
    const db = this.supabase.getClient();

    const { data: planData } = await db
      .from('plans')
      .select('id')
      .eq('name', '1 year plan')
      .limit(1)
      .single();

    const planId = planData ? (planData as { id: string }).id : null;

    const guestToken = crypto.randomUUID();
    const userId = crypto.randomUUID();

    const { data, error } = await db
      .from('users')
      .insert({
        id: userId,
        guest_token: guestToken,
        plan_id: planId,
        plan_start_date: new Date().toISOString().slice(0, 10),
      })
      .select('guest_token, created_at')
      .single();

    if (error) {
      throw new ConflictException({
        error: { code: 'GUEST_CREATE_FAILED', message: error.message },
      });
    }

    return {
      guestToken: (data as { guest_token: string; created_at: string }).guest_token,
      createdAt: (data as { guest_token: string; created_at: string }).created_at,
    };
  }

  // ── POST /auth/otp/send ───────────────────────────────────────────────────

  /**
   * Validates the email and triggers a Supabase OTP email.
   * Throws BadRequestException with code INVALID_EMAIL for malformed addresses.
   */
  async sendOtp(email: string): Promise<{ sent: true }> {
    if (!EMAIL_REGEX.test(email)) {
      throw new BadRequestException({
        error: { code: 'INVALID_EMAIL', message: 'Invalid email format' },
      });
    }

    const { error } = await this.supabase.getClient().auth.signInWithOtp({
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
    const { data, error } = await this.supabase.getClient().auth.verifyOtp({
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
    const db = this.supabase.getClient();
    await db.from('users').upsert(
      { id, email: userEmail ?? email },
      { onConflict: 'id' },
    );

    return {
      accessToken: access_token,
      refreshToken: refresh_token,
      user: { id, email: userEmail ?? email },
    };
  }

  // ── POST /auth/migrate ────────────────────────────────────────────────────

  /**
   * Transfers all verse_reads from a guest user to the authenticated user.
   * Duplicate reads (already read by the auth user) are silently skipped.
   * Archives the guest user row after migration.
   *
   * Safe to call multiple times — subsequent calls return alreadyMigrated: true.
   */
  async migrateGuest(
    authenticatedUserId: string,
    guestToken: string,
  ): Promise<{ migratedReads: number; alreadyMigrated: boolean }> {
    const db = this.supabase.getClient();

    // Locate the guest user (must not be already archived)
    const { data: guestUser } = await db
      .from('users')
      .select('id')
      .eq('guest_token', guestToken)
      .is('archived_at', null)
      .single();

    if (!guestUser) {
      // Already migrated or token never existed — treat as idempotent success
      return { migratedReads: 0, alreadyMigrated: true };
    }

    const guestUserId = (guestUser as { id: string }).id;

    // Fetch all verse_reads belonging to the guest
    const { data: guestReads } = await db
      .from('verse_reads')
      .select('verse_id, read_at')
      .eq('user_id', guestUserId);

    const reads = (guestReads ?? []) as Array<{ verse_id: number; read_at: string }>;

    // Transfer reads — ignoreDuplicates handles the overlap case (DISCUSSION-004)
    if (reads.length > 0) {
      await db.from('verse_reads').upsert(
        reads.map((r) => ({
          user_id: authenticatedUserId,
          verse_id: r.verse_id,
          read_at: r.read_at,
        })),
        { onConflict: 'user_id,verse_id', ignoreDuplicates: true },
      );
    }

    // Soft-delete the guest user row
    await db
      .from('users')
      .update({ archived_at: new Date().toISOString(), guest_token: null })
      .eq('id', guestUserId);

    return { migratedReads: reads.length, alreadyMigrated: false };
  }
}
