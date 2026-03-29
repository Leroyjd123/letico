'use client';
/**
 * useContinueReading.ts — React Query wrapper for GET /progress/continue.
 * Stale time: 30 seconds. Returns null when the user has finished or has no auth.
 */
import { useQuery } from '@tanstack/react-query';
import { getContinuePosition } from '../lib/api';
import type { AuthContext } from '../lib/api';
import type { ContinuePosition } from '@lectio/types';

export function useContinueReading(auth: AuthContext | null): ContinuePosition | null {
  const { data } = useQuery<ContinuePosition | null>({
    queryKey: ['progress', 'continue', auth ? (auth.type === 'bearer' ? auth.token.slice(-8) : auth.guestToken.slice(-8)) : 'anon'],
    queryFn: () => (auth ? getContinuePosition(auth) : Promise.resolve(null)),
    enabled: auth !== null,
    staleTime: 30_000,
    retry: false,
  });

  return data ?? null;
}
