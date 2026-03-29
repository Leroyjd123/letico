'use client';
/**
 * useVerseRead.ts
 *
 * Optimistic mutation hook for all verse-read write operations.
 *
 * Query key ['verse-reads', authId] holds a Set<number> of read verse IDs.
 * On mutate: snapshot → optimistically add IDs → submit to API.
 * On error: restore snapshot.
 * On settled: invalidate progress and plan queries to refetch real state.
 *
 * Offline: if navigator.onLine is false, writes to IndexedDB queue instead.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { markVersesRead } from '../lib/api';
import type { AuthContext } from '../lib/api';
import { queueForOffline } from '../lib/offlineQueue';

function authId(auth: AuthContext | null): string {
  if (!auth) return 'anon';
  return auth.type === 'bearer' ? `b:${auth.token.slice(-8)}` : `g:${auth.guestToken.slice(-8)}`;
}

export function useVerseRead(auth: AuthContext | null) {
  const queryClient = useQueryClient();
  const queryKey = ['verse-reads', authId(auth)] as const;

  const mutation = useMutation({
    mutationFn: (verseIds: number[]) => {
      if (!auth) throw new Error('No auth context — cannot mark verses read');
      return markVersesRead(verseIds, auth);
    },

    onMutate: async (verseIds: number[]) => {
      await queryClient.cancelQueries({ queryKey: ['progress'] });

      const previousSet = queryClient.getQueryData<Set<number>>(queryKey);
      const newSet = new Set(previousSet ?? []);
      verseIds.forEach((id) => newSet.add(id));
      queryClient.setQueryData(queryKey, newSet);

      return { previousSet };
    },

    onError: (_err, _verseIds, context) => {
      if (context?.previousSet !== undefined) {
        queryClient.setQueryData(queryKey, context.previousSet);
      }
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['progress'] });
      void queryClient.invalidateQueries({ queryKey: ['plan'] });
    },
  });

  function submit(verseIds: number[]) {
    if (!verseIds.length) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      void queueForOffline(verseIds);
      return;
    }
    mutation.mutate(verseIds);
  }

  return {
    markChapter: submit,
    markRange: submit,
    markDayComplete: submit,
    isPending: mutation.isPending,
  };
}
