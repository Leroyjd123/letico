/**
 * auth.service.ts
 *
 * Phase 2: guest user creation only.
 * Phase 5 adds OTP send/verify and guest migration.
 */
import { Injectable, ConflictException } from '@nestjs/common';
import { InjectSupabase } from '../supabase/inject-supabase.decorator';
import { SupabaseProvider } from '../supabase/supabase.provider';

@Injectable()
export class AuthService {
  constructor(@InjectSupabase() private readonly supabase: SupabaseProvider) {}

  /**
   * Creates a guest user row in the users table.
   * The guest_token is a UUID that the client must store in localStorage.
   * The plan_id defaults to the 1yr plan so plan/today works immediately.
   */
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

    // If user has no plan, default to the 1yr plan
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

  async createGuest(): Promise<{ guestToken: string; createdAt: string }> {
    const db = this.supabase.getClient();

    // Resolve the 1yr plan id to assign as default
    const { data: planData } = await db
      .from('plans')
      .select('id')
      .eq('name', '1 year plan')
      .limit(1)
      .single();

    const planId = planData ? (planData as { id: string }).id : null;

    // crypto.randomUUID() is available in Node 14.17+ / every modern runtime
    const guestToken = crypto.randomUUID();
    const userId = crypto.randomUUID();

    const { data, error } = await db
      .from('users')
      .insert({
        id: userId,
        guest_token: guestToken,
        plan_id: planId,
        plan_start_date: new Date().toISOString().slice(0, 10), // today as YYYY-MM-DD
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
}
