'use client';
/**
 * useAuth.ts
 *
 * Single source of auth state for the frontend.
 *
 * Resolution order on mount:
 *   1. Supabase session (signed-in user)  → { type: 'bearer', token }
 *   2. localStorage guest token          → { type: 'guest', guestToken }
 *   3. Neither found                     → auto-provision via POST /auth/guest, store in localStorage
 *
 * Edge case (DISCUSSION-012): if localStorage is cleared, a new guest is silently created.
 * Old progress is unrecoverable — no error is shown.
 */
import { useState, useEffect } from 'react';
import type { AuthContext } from '../lib/api';
import { createGuest } from '../lib/api';
import { getBrowserSupabaseClient } from '../lib/supabase';

const GUEST_TOKEN_KEY = 'lectio_guest_token';

export interface AuthState {
  auth: AuthContext | null;
  isProvisioning: boolean;
}

export function useAuth(): AuthState {
  const [auth, setAuth] = useState<AuthContext | null>(null);
  const [isProvisioning, setIsProvisioning] = useState(false);

  useEffect(() => {
    const supabase = getBrowserSupabaseClient();
    let cancelled = false;

    async function initialize() {
      // Path 1: Supabase session
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled) return;

      if (session) {
        setAuth({ type: 'bearer', token: session.access_token });
        return;
      }

      // Path 2: existing guest token in localStorage
      const existingToken = localStorage.getItem(GUEST_TOKEN_KEY);
      if (existingToken) {
        setAuth({ type: 'guest', guestToken: existingToken });
        return;
      }

      // Path 3: auto-provision a new guest — no button click required
      setIsProvisioning(true);
      try {
        const guest = await createGuest();
        if (cancelled) return;
        localStorage.setItem(GUEST_TOKEN_KEY, guest.guestToken);
        setAuth({ type: 'guest', guestToken: guest.guestToken });
      } catch {
        // Silently fail — the app remains in the null state and will retry on next mount
      } finally {
        if (!cancelled) setIsProvisioning(false);
      }
    }

    void initialize();

    // Keep auth in sync when Supabase session changes (sign-in / sign-out from Phase 5)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      if (session) {
        setAuth({ type: 'bearer', token: session.access_token });
      } else {
        // Signed out — fall back to guest token if present
        const guestToken = localStorage.getItem(GUEST_TOKEN_KEY);
        if (guestToken) {
          setAuth({ type: 'guest', guestToken });
        } else {
          setAuth(null);
        }
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return { auth, isProvisioning };
}

/** Persists a guest token to localStorage. Used by Phase 5 migration after OTP sign-in. */
export function storeGuestToken(token: string): void {
  localStorage.setItem(GUEST_TOKEN_KEY, token);
}
