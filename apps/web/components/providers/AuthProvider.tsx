'use client';

/**
 * AuthProvider.tsx
 *
 * App-wide state that every screen needs:
 *   - auth        — bearer (signed in) or guest credentials
 *   - userKey     — stable cache key for the current user
 *   - sync        — the offline queue (one instance for the whole app)
 * Also activates Realtime cross-device sync for signed-in users.
 */
import { createContext, useContext, useMemo } from 'react';
import type { AuthContext } from '../../lib/api';
import { userKey as toUserKey } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { useOfflineQueue, type UseOfflineQueueResult } from '../../hooks/useOfflineQueue';

interface AuthContextValue {
  auth: AuthContext | null;
  userKey: string;
  isProvisioning: boolean;
  /** Guest auto-provisioning failed (API unreachable). */
  provisionFailed: boolean;
  retryProvision: () => void;
}

const AuthCtx = createContext<AuthContextValue>({
  auth: null,
  userKey: 'anon',
  isProvisioning: false,
  provisionFailed: false,
  retryProvision: () => {},
});

const SyncCtx = createContext<UseOfflineQueueResult>({
  hasPermanentFailure: false,
  flush: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { auth, isProvisioning, provisionFailed, retryProvision } = useAuth();
  const sync = useOfflineQueue(auth);
  useRealtimeSync(auth);

  const key = toUserKey(auth);
  const value = useMemo(
    () => ({ auth, userKey: key, isProvisioning, provisionFailed, retryProvision }),
    // `auth` changes identity on token refresh; consumers that only need the
    // user identity should depend on userKey.
    [auth, key, isProvisioning, provisionFailed, retryProvision],
  );

  return (
    <AuthCtx.Provider value={value}>
      <SyncCtx.Provider value={sync}>{children}</SyncCtx.Provider>
    </AuthCtx.Provider>
  );
}

export function useAuthContext(): AuthContextValue {
  return useContext(AuthCtx);
}

export function useSync(): UseOfflineQueueResult {
  return useContext(SyncCtx);
}
