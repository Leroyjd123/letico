'use client';
/**
 * AuthProvider.tsx
 *
 * Wraps the app with auth state from useAuth().
 * All client components read auth via useAuthContext() from this module —
 * never call useAuth() directly in leaf components.
 *
 * Exported useAuthContext() is the single auth access point for all pages.
 */
import { createContext, useContext } from 'react';
import type { AuthContext } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';

interface AuthContextValue {
  auth: AuthContext | null;
  isProvisioning: boolean;
}

const AuthCtx = createContext<AuthContextValue>({
  auth: null,
  isProvisioning: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { auth, isProvisioning } = useAuth();
  return (
    <AuthCtx.Provider value={{ auth, isProvisioning }}>{children}</AuthCtx.Provider>
  );
}

export function useAuthContext(): AuthContextValue {
  return useContext(AuthCtx);
}
