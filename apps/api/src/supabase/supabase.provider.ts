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

  constructor() {
    const url = process.env['SUPABASE_URL'];
    const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];

    if (!url || !key) {
      throw new Error(
        'Missing required env vars: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set.',
      );
    }

    this.client = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  getClient(): SupabaseClient {
    return this.client;
  }
}
