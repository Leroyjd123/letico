'use client';

import { useState, useEffect } from 'react';
import type { AuthContext } from './api';
import { getBrowserSupabaseClient } from './supabase';

const GUEST_TOKEN_KEY = 'lectio_guest_token';

export function useAuthContext(): AuthContext | null {
  const [auth, setAuth] = useState<AuthContext | null>(null);

  useEffect(() => {
    const supabase = getBrowserSupabaseClient();

    function applySession(session: { access_token: string } | null) {
      if (session) {
        setAuth({ type: 'bearer', token: session.access_token });
        return;
      }
      const guestToken = localStorage.getItem(GUEST_TOKEN_KEY);
      if (guestToken) {
        setAuth({ type: 'guest', guestToken });
      } else {
        setAuth(null);
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      applySession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return auth;
}

/** Persists a guest token to localStorage after POST /auth/guest */
export function storeGuestToken(token: string): void {
  localStorage.setItem(GUEST_TOKEN_KEY, token);
}
