'use client';
/**
 * useRealtimeSync.ts
 *
 * Subscribes to Supabase Realtime postgres_changes on the verse_reads table
 * for the current authenticated user. Only activates for bearer (signed-in)
 * users — guests use the offline queue instead.
 *
 * On INSERT from any device: adds the new verse_id to the local React Query
 * cache Set and invalidates progress queries to refresh completion bars.
 *
 * On unmount (sign-out, page leave): unsubscribes the channel.
 */
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { AuthContext } from '../lib/api';
import { getBrowserSupabaseClient } from '../lib/supabase';

export function useRealtimeSync(auth: AuthContext | null): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Only subscribe for authenticated (bearer) users
    if (!auth || auth.type !== 'bearer') return;

    const supabase = getBrowserSupabaseClient();

    // Resolve the authenticated user's UUID so we can filter the subscription
    let channel: ReturnType<typeof supabase.channel> | null = null;

    supabase.auth.getUser().then(({ data }) => {
      const userId = data.user?.id;
      if (!userId) return;

      const authKey = `b:${auth.token.slice(-8)}`;
      const queryKey = ['verse-reads', authKey] as const;

      channel = supabase
        .channel(`verse-reads:${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'verse_reads',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            const newVerseId = (payload.new as { verse_id?: number }).verse_id;
            if (!newVerseId) return;

            // Optimistically add the new verse to the cached Set
            queryClient.setQueryData<Set<number>>(queryKey, (prev) => {
              const next = new Set(prev ?? []);
              next.add(newVerseId);
              return next;
            });

            // Refresh progress bars and plan completion
            void queryClient.invalidateQueries({ queryKey: ['progress'] });
          },
        )
        .subscribe();
    });

    return () => {
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [auth, queryClient]);
}
