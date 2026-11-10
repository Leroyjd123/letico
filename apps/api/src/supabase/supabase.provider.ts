/**
 * supabase.provider.ts
 *
 * Provides a single Supabase client instance using the service role key.
 * The service role key bypasses RLS — this is intentional for backend operations.
 * Guest write operations (verse_reads) must use this client since guest users
 * do not have a Supabase Auth session (no auth.uid() for RLS to match against).
 */
import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_CLIENT = Symbol('SUPABASE_CLIENT');

@Injectable()
export class SupabaseProvider {
  private readonly client: SupabaseClient;
  private readonly url: string;
  private readonly key: string;

  constructor() {
    const url = process.env['SUPABASE_URL'];
    const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];

    if (!url || !key) {
      throw new Error(
        'Missing required env vars: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set.',
      );
    }

    this.url = url;
    this.key = key;
    this.client = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  /**
   * Shared data client. NEVER call session-creating auth methods on it
   * (signInWithOtp, verifyOtp, setSession, ...): supabase-js would store the
   * resulting user session in memory and use that user's JWT for every later
   * query, so the whole API would silently run as the last user who signed in.
   */
  getClient(): SupabaseClient {
    return this.client;
  }

  /**
   * Returns a fresh, throwaway client for auth flows that create a session
   * (OTP send/verify). The session it stores dies with the client, so it can
   * never leak into the shared data client or into another request.
   */
  createAuthClient(): SupabaseClient {
    return createClient(this.url, this.key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
  }
}
