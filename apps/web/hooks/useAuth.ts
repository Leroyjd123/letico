'use client';

/**
 * useAuth.ts — single source of auth state for the frontend.
 *
 * Resolution order on mount:
 *   1. Supabase session (signed-in user)  → { type: 'bearer', token }
 *   2. localStorage guest token          → { type: 'guest', guestToken }
 *   3. Neither found                     → auto-provision via POST /auth/guest
 *
 * If provisioning fails (API down / offline) the caller gets
 * provisionFailed = true and can retry, instead of an endless "loading…".
 *
 * Signed in but a guest token is still stored → a previous guest migration
 * failed; it is retried here (the token is only cleared once it succeeds).
 */
import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { AuthContext } from '../lib/api';
import { createGuest, migrateGuest } from '../lib/api';
import { getBrowserSupabaseClient } from '../lib/supabase';
import { getGuestToken, setGuestToken, clearGuestToken } from '../lib/authStorage';
import { logger } from '../lib/logger';

export interface AuthState {
  auth: AuthContext | null;
  isProvisioning: boolean;
  provisionFailed: boolean;
  retryProvision: () => void;
}

export function useAuth(): AuthState {
  const [auth, setAuth] = useState<AuthContext | null>(null);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [provisionFailed, setProvisionFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const queryClient = useQueryClient();
  const retryProvision = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    const supabase = getBrowserSupabaseClient();
    let cancelled = false;

    async function retryPendingMigration(accessToken: string) {
      const guestToken = getGuestToken();
      if (!guestToken) return;
      try {
        const result = await migrateGuest(guestToken, { type: 'bearer', token: accessToken });
        clearGuestToken();
        logger.action('guest:migrate:retried', result);
        void queryClient.invalidateQueries({ queryKey: ['plan'] });
        void queryClient.invalidateQueries({ queryKey: ['progress'] });
      } catch (err) {
        logger.error('guest:migrate:retry-failed', err);
      }
    }

    function fromGuest(): AuthContext | null {
      const token = getGuestToken();
      return token ? { type: 'guest', guestToken: token } : null;
    }

    async function initialize() {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session) {
        setAuth({ type: 'bearer', token: session.access_token });
        void retryPendingMigration(session.access_token);
        return;
      }

      const guest = fromGuest();
      if (guest) {
        setAuth(guest);
        return;
      }

      setIsProvisioning(true);
      setProvisionFailed(false);
      try {
        const created = await createGuest();
        if (cancelled) return;
        setGuestToken(created.guestToken);
        setAuth({ type: 'guest', guestToken: created.guestToken });
      } catch {
        if (!cancelled) setProvisionFailed(true);
      } finally {
        if (!cancelled) setIsProvisioning(false);
      }
    }

    void initialize();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      if (session) {
        // Only replace state when the token actually changed.
        setAuth((prev) =>
          prev?.type === 'bearer' && prev.token === session.access_token
            ? prev
            : { type: 'bearer', token: session.access_token },
        );
      } else {
        setAuth(fromGuest());
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [attempt, queryClient]);

  return { auth, isProvisioning, provisionFailed, retryProvision };
}
