'use client';
/**
 * useOfflineQueue.ts
 *
 * Listens for online/offline window events and flushes the IndexedDB
 * pending-reads queue when connectivity is restored.
 *
 * Flush strategy:
 *   - Collect all unsynced PendingRead items from IndexedDB
 *   - Merge their verse IDs and chunk into batches of ≤ 500
 *   - Call POST /progress/verses for each batch (up to MAX_RETRIES with exponential backoff)
 *   - On full success: markSynced → clearSynced → invalidate progress queries
 *   - On permanent failure (all retries exhausted): set hasPermanentFailure = true
 *
 * Invariant: only one flush can run at a time (guarded by isFlushing ref).
 */
import { useEffect, useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { AuthContext } from '../lib/api';
import { markVersesRead } from '../lib/api';
import { getPendingReads, markSynced, clearSynced } from '../lib/offlineQueue';

const CHUNK_SIZE = 500;
const MAX_RETRIES = 3;

export interface UseOfflineQueueResult {
  /** True when a batch failed permanently after MAX_RETRIES. Show an error banner. */
  hasPermanentFailure: boolean;
  /** Manually trigger a flush (called by useVerseRead after each successful API write). */
  flush: () => Promise<void>;
}

export function useOfflineQueue(auth: AuthContext | null): UseOfflineQueueResult {
  const queryClient = useQueryClient();
  const isFlushing = useRef(false);
  const [hasPermanentFailure, setHasPermanentFailure] = useState(false);

  const flush = useCallback(async (): Promise<void> => {
    if (!auth || isFlushing.current) return;

    const pending = await getPendingReads();
    if (!pending.length) return;

    isFlushing.current = true;

    try {
      // Collect all verse IDs from unsynced items and record their IDB keys
      const allVerseIds = pending.flatMap((p) => p.verseIds);
      const pendingIds = pending.map((p) => p.id);

      // Chunk into batches of ≤ CHUNK_SIZE
      const chunks: number[][] = [];
      for (let i = 0; i < allVerseIds.length; i += CHUNK_SIZE) {
        chunks.push(allVerseIds.slice(i, i + CHUNK_SIZE));
      }

      let allSucceeded = true;

      for (const chunk of chunks) {
        let attempt = 0;
        let success = false;

        while (attempt < MAX_RETRIES && !success) {
          try {
            await markVersesRead(chunk, auth);
            success = true;
          } catch {
            attempt++;
            if (attempt < MAX_RETRIES) {
              // Exponential backoff: 1s, 2s, 4s
              await new Promise<void>((resolve) =>
                setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)),
              );
            }
          }
        }

        if (!success) {
          allSucceeded = false;
          break; // Stop processing further chunks — will retry on next online event
        }
      }

      if (allSucceeded) {
        await markSynced(pendingIds);
        await clearSynced();
        setHasPermanentFailure(false);
        void queryClient.invalidateQueries({ queryKey: ['progress'] });
      } else {
        setHasPermanentFailure(true);
      }
    } finally {
      isFlushing.current = false;
    }
  }, [auth, queryClient]);

  useEffect(() => {
    function handleOnline() {
      void flush();
    }

    window.addEventListener('online', handleOnline);

    // Flush immediately on mount if already online (covers page reload)
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      void flush();
    }

    return () => window.removeEventListener('online', handleOnline);
  }, [flush]);

  return { hasPermanentFailure, flush };
}
