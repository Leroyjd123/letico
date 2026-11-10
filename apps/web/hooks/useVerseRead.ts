'use client';

/**
 * useVerseRead.ts — every reading-progress write goes through here.
 *
 *   1. Optimistic update of the plan-day query the screen is rendering, so the
 *      tile changes instantly (it used to write to a cache key nothing read).
 *   2. Enqueue to IndexedDB — always, so nothing is lost offline.
 *   3. Ask the app-wide sync queue to flush (no-op while offline).
 *
 * Verse ids come from the plan-day response, so marking works offline too.
 */
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import type { PlanDayView } from '@lectio/types';
import { enqueue, type QueueOp } from '../lib/offlineQueue';
import { applyToDay } from '../lib/planDay';
import { logger } from '../lib/logger';
import { useSync } from '../components/providers/AuthProvider';

export interface UseVerseReadResult {
  markRead: (verseIds: number[]) => void;
  markUnread: (verseIds: number[]) => void;
}

export function useVerseRead(planDayKey: QueryKey | null): UseVerseReadResult {
  const queryClient = useQueryClient();
  const { flush } = useSync();

  function submit(op: QueueOp, verseIds: number[]): void {
    if (!verseIds.length) return;
    logger.action(`reading:${op}`, { verseCount: verseIds.length });

    if (planDayKey) {
      void queryClient.cancelQueries({ queryKey: planDayKey });
      queryClient.setQueryData<PlanDayView>(planDayKey, (day) =>
        day ? applyToDay(day, op, verseIds) : day,
      );
    }

    void (async () => {
      const { dropped } = await enqueue(op, verseIds);
      if (dropped) logger.error('reading:queue-full', { op, count: verseIds.length });
      await flush();
    })();
  }

  return {
    markRead: (ids) => submit('mark', ids),
    markUnread: (ids) => submit('unmark', ids),
  };
}
