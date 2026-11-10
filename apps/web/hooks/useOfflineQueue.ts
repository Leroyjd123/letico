'use client';

/**
 * useOfflineQueue.ts — flushes the IndexedDB queue of reading changes.
 *
 * Mounted ONCE, app-wide, by AuthProvider (it used to live only on /read, so
 * changes made elsewhere waited for a visit to /read).
 *
 * Flush strategy:
 *   - Items are sent in the order they were queued (mark/unmark order matters).
 *   - Each item is split into requests of ≤ 500 verse ids.
 *   - Transient failures (network, 5xx, 401, 408, 429) are retried with
 *     backoff; if still failing the flush stops and retries later (on the
 *     `online` event, on the next local change, or every 30 s).
 *   - Requests the server rejects outright (other 4xx) can never succeed:
 *     they are dropped instead of blocking the queue forever.
 *   - Only one flush runs at a time; a flush requested mid-flush runs again
 *     right after.
 */
import { useEffect, useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { AuthContext } from '../lib/api';
import { ApiError, markVersesRead, unmarkVersesRead } from '../lib/api';
import { getPendingReads, removeItems, type PendingRead } from '../lib/offlineQueue';
import { logger } from '../lib/logger';

const CHUNK_SIZE = 500;
const MAX_RETRIES = 3;
const RETRY_INTERVAL_MS = 30_000;

export interface UseOfflineQueueResult {
  /** True while queued changes could not be synced (they stay saved locally). */
  hasPermanentFailure: boolean;
  /** Try to sync now. Safe to call any time. */
  flush: () => Promise<void>;
}

/** True when retrying the same request later could succeed. */
export function isTransient(err: unknown): boolean {
  if (!(err instanceof ApiError)) return true; // network error / offline
  return err.status >= 500 || [401, 408, 429].includes(err.status);
}

async function sendItem(item: PendingRead, auth: AuthContext): Promise<void> {
  for (let i = 0; i < item.verseIds.length; i += CHUNK_SIZE) {
    const chunk = item.verseIds.slice(i, i + CHUNK_SIZE);
    if (item.op === 'unmark') await unmarkVersesRead(chunk, auth);
    else await markVersesRead(chunk, auth, item.queuedAt);
  }
}

export function useOfflineQueue(auth: AuthContext | null): UseOfflineQueueResult {
  const queryClient = useQueryClient();
  const isFlushing = useRef(false);
  const flushAgain = useRef(false);
  const [hasPermanentFailure, setHasPermanentFailure] = useState(false);

  const flush = useCallback(async (): Promise<void> => {
    if (!auth) return;
    if (isFlushing.current) {
      flushAgain.current = true;
      return;
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    isFlushing.current = true;
    let syncedAny = false;
    try {
      do {
        flushAgain.current = false;
        const pending = await getPendingReads();
        for (const item of pending) {
          let done = false;
          for (let attempt = 1; attempt <= MAX_RETRIES && !done; attempt++) {
            try {
              await sendItem(item, auth);
              done = true;
            } catch (err) {
              if (!isTransient(err)) {
                logger.error('sync:item-rejected', err);
                done = true; // can never succeed — drop it
                break;
              }
              if (attempt < MAX_RETRIES) {
                await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
              }
            }
          }
          if (!done) {
            setHasPermanentFailure(true);
            return; // keep order: stop here, retry later
          }
          await removeItems([item.id]);
          syncedAny = true;
        }
      } while (flushAgain.current);
      setHasPermanentFailure(false);
    } finally {
      isFlushing.current = false;
      if (syncedAny) {
        void queryClient.invalidateQueries({ queryKey: ['progress'] });
        void queryClient.invalidateQueries({ queryKey: ['plan'] });
      }
    }
  }, [auth, queryClient]);

  useEffect(() => {
    const onOnline = () => void flush();
    window.addEventListener('online', onOnline);
    void flush(); // covers page reloads with a non-empty queue
    const timer = setInterval(() => void flush(), RETRY_INTERVAL_MS);
    return () => {
      window.removeEventListener('online', onOnline);
      clearInterval(timer);
    };
  }, [flush]);

  return { hasPermanentFailure, flush };
}
