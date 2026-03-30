'use client';
/**
 * AuthProvider.tsx
 *
 * Wraps the app with auth state from useAuth().
 * Also activates useRealtimeSync for authenticated users (Phase 5).
 *
 * All client components read auth via useAuthContext() from this module.
 */
import { createContext, useContext } from 'react';
import type { AuthContext } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';

interface AuthContextValue {
  auth: AuthContext | null;
  isProvisioning: boolean;
}

const AuthCtx = createContext<AuthContextValue>({
  auth: null,
  isProvisioning: false,
});

function AuthProviderInner({ children }: { children: React.ReactNode }) {
  const { auth, isProvisioning } = useAuth();
  // Realtime subscription starts automatically on sign-in; no-ops for guests
  useRealtimeSync(auth);
  return (
    <AuthCtx.Provider value={{ auth, isProvisioning }}>{children}</AuthCtx.Provider>
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <AuthProviderInner>{children}</AuthProviderInner>;
}

export function useAuthContext(): AuthContextValue {
  return useContext(AuthCtx);
}
