'use client';

/**
 * useContinueReading.ts — React Query wrapper for GET /progress/continue.
 * `position` is null both while loading and when everything is read, so
 * callers must check `isLoading` before saying "you've finished".
 */
import { useQuery } from '@tanstack/react-query';
import type { ContinuePosition } from '@lectio/types';
import { getContinuePosition } from '../lib/api';
import type { AuthContext } from '../lib/api';
import { queryKeys } from '../lib/queryKeys';

export function useContinueReading(
  auth: AuthContext | null,
  userKey: string,
): { position: ContinuePosition | null; isLoading: boolean; isError: boolean } {
  const { data, isLoading, isError } = useQuery<ContinuePosition | null>({
    queryKey: queryKeys.continue(userKey),
    queryFn: () => getContinuePosition(auth!),
    enabled: auth !== null,
    staleTime: 30_000,
  });
  return { position: data ?? null, isLoading: auth === null || isLoading, isError };
}
