/**
 * auth.guard.ts
 *
 * Resolves the calling user from one of two sources:
 *   1. Authorization: Bearer <token>  — Supabase JWT (signed-in user)
 *   2. X-Guest-Token: <uuid>          — guest user looked up in users table
 *
 * Attaches { id: string } to request.user on success.
 * Throws UnauthorizedException with code UNAUTHORIZED if neither header resolves.
 *
 * IMPORTANT: If the guest_token is not found, return 401 — never 400.
 * The client must not know whether the token format was valid.
 */
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { InjectSupabase } from '../supabase/inject-supabase.decorator';
import { SupabaseProvider } from '../supabase/supabase.provider';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@InjectSupabase() private readonly supabase: SupabaseProvider) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: { id: string } }>();
    const db = this.supabase.getClient();

    // ── Path 1: Bearer JWT ─────────────────────────────────────────────────
    const authHeader = request.headers['authorization'];
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const { data, error } = await db.auth.getUser(token);
      if (!error && data.user) {
        request.user = { id: data.user.id };
        return true;
      }
    }

    // ── Path 2: X-Guest-Token ──────────────────────────────────────────────
    const guestToken = request.headers['x-guest-token'];
    if (typeof guestToken === 'string' && guestToken.length > 0) {
      const { data, error } = await db
        .from('users')
        .select('id')
        .eq('guest_token', guestToken)
        .is('archived_at', null)
        .single();

      if (!error && data) {
        request.user = { id: (data as { id: string }).id };
        return true;
      }
    }

    throw new UnauthorizedException({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    });
  }
}
