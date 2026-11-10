'use client';

/**
 * useRealtimeSync.ts — refreshes progress when another device writes.
 *
 * Subscribes to Supabase Realtime INSERTs on verse_reads for the signed-in
 * user (guests have no Supabase session). Requires verse_reads in the
 * supabase_realtime publication (migration 002).
 *
 * Keyed on the stable user key, not the auth object, so hourly token
 * refreshes don't tear down and recreate the channel.
 */
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { AuthContext } from '../lib/api';
import { userKey } from '../lib/api';
import { getBrowserSupabaseClient } from '../lib/supabase';

export function useRealtimeSync(auth: AuthContext | null): void {
  const queryClient = useQueryClient();
  const isBearer = auth?.type === 'bearer';
  const key = userKey(auth);

  useEffect(() => {
    if (!isBearer) return;
    const userId = key.startsWith('u:') ? key.slice(2) : null;
    if (!userId) return;

    const supabase = getBrowserSupabaseClient();
    let timer: ReturnType<typeof setTimeout> | null = null;

    const channel = supabase
      .channel(`verse-reads:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'verse_reads', filter: `user_id=eq.${userId}` },
        () => {
          // A bulk mark arrives as many events — refresh once.
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => {
            void queryClient.invalidateQueries({ queryKey: ['plan'] });
            void queryClient.invalidateQueries({ queryKey: ['progress'] });
          }, 500);
        },
      )
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [isBearer, key, queryClient]);
}
