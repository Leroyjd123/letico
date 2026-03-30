'use client';
/**
 * useVerseRead.ts
 *
 * Optimistic mutation hook for all verse-read write operations.
 *
 * Write flow (Task 4.4):
 *   1. Optimistic update — always. The tile turns read immediately.
 *   2. Enqueue to IndexedDB — always. Reads are never lost.
 *   3. If online AND auth present: call API immediately, then markSynced.
 *      If offline: skip API call. useOfflineQueue flushes on reconnect.
 *   4. On API error: leave item in IndexedDB (synced=false). Will retry on reconnect.
 *   5. After write: invalidate progress + plan queries.
 *
 * Invariant (from implementation plan):
 *   The optimistic update MUST happen immediately regardless of network state.
 */
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { markVersesRead } from '../lib/api';
import type { AuthContext } from '../lib/api';
import { enqueueVerseReads, markSynced } from '../lib/offlineQueue';

function authId(auth: AuthContext | null): string {
  if (!auth) return 'anon';
  return auth.type === 'bearer' ? `b:${auth.token.slice(-8)}` : `g:${auth.guestToken.slice(-8)}`;
}

export interface UseVerseReadResult {
  markChapter: (verseIds: number[]) => void;
  markRange: (verseIds: number[]) => void;
  markDayComplete: (verseIds: number[]) => void;
  isPending: boolean;
}

export function useVerseRead(auth: AuthContext | null): UseVerseReadResult {
  const queryClient = useQueryClient();
  const queryKey = ['verse-reads', authId(auth)] as const;
  const [isPending, setIsPending] = useState(false);

  function submit(verseIds: number[]): void {
    if (!verseIds.length) return;

    void (async () => {
      // ── Step 1: Optimistic update ────────────────────────────────────────────
      await queryClient.cancelQueries({ queryKey: ['progress'] });

      const previousSet = queryClient.getQueryData<Set<number>>(queryKey);
      const newSet = new Set(previousSet ?? []);
      verseIds.forEach((id) => newSet.add(id));
      queryClient.setQueryData(queryKey, newSet);

      // ── Step 2: Always enqueue to IndexedDB ──────────────────────────────────
      const enqueued = await enqueueVerseReads(verseIds);
      // enqueued.dropped === true means the queue is full (10k cap).
      // The optimistic update still happened; the read just won't sync.

      // ── Step 3: If online, call API immediately ───────────────────────────────
      if (typeof navigator !== 'undefined' && navigator.onLine && auth) {
        setIsPending(true);
        try {
          await markVersesRead(verseIds, auth);
          // On success: mark the queued item as synced so flush skips it
          if (!enqueued.dropped) {
            await markSynced([enqueued.id]);
          }
        } catch {
          // API failed — leave the IndexedDB item unsynced.
          // useOfflineQueue will retry when connectivity returns.
        } finally {
          setIsPending(false);
        }
      }

      // ── Step 4: Refresh derived queries ──────────────────────────────────────
      void queryClient.invalidateQueries({ queryKey: ['progress'] });
      void queryClient.invalidateQueries({ queryKey: ['plan'] });
    })();
  }

  return {
    markChapter: submit,
    markRange: submit,
    markDayComplete: submit,
    isPending,
  };
}
