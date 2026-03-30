'use client';
/**
 * PlanPageClient.tsx
 *
 * Renders the full 365-day plan list.
 *
 * Data flow:
 *   1. useAuthContext() → AuthContext
 *   2. GET /api/auth/me → { planId } — the user's active reading plan
 *   3. GET /api/plan/:planId/days/summary → Array<DaySummary> (completion for all 365 days)
 *   4. Scrolls to today's row on first render via a ref
 *   5. Tapping any row → navigates to /read with ?day=N
 *
 * No locked days, no disabled states. R2: all days freely navigable.
 */
import { useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthContext } from '../../components/providers/AuthProvider';
import type { AuthContext } from '../../lib/api';
import { PlanDayRow } from '../../components/plan/PlanDayRow';

const BASE_URL =
  (typeof process !== 'undefined' ? process.env['NEXT_PUBLIC_API_BASE_URL'] : undefined) ??
  'http://localhost:4000/api';

interface DaySummary {
  dayNumber: number;
  label: string;
  completionPct: number;
  isToday: boolean;
  offsetFromToday: number;
}

function headers(auth: AuthContext): Record<string, string> {
  if (auth.type === 'bearer') return { Authorization: `Bearer ${auth.token}` };
  return { 'X-Guest-Token': auth.guestToken };
}

async function fetchMe(auth: AuthContext): Promise<{ id: string; planId: string | null }> {
  const res = await fetch(`${BASE_URL}/auth/me`, { headers: headers(auth) });
  if (!res.ok) return { id: '', planId: null };
  const json = (await res.json()) as { data: { id: string; planId: string | null } };
  return json.data;
}

async function fetchDaysSummary(planId: string, auth: AuthContext): Promise<DaySummary[]> {
  const res = await fetch(`${BASE_URL}/plan/${planId}/days/summary`, { headers: headers(auth) });
  if (!res.ok) return [];
  const json = (await res.json()) as { data: DaySummary[] };
  return json.data;
}

function authKey(auth: AuthContext | null): string {
  if (!auth) return 'anon';
  return auth.type === 'bearer' ? `b:${auth.token.slice(-8)}` : `g:${auth.guestToken.slice(-8)}`;
}

export function PlanPageClient() {
  const { auth } = useAuthContext();
  const todayRowRef = useRef<HTMLDivElement | null>(null);

  // ── Resolve user's planId ─────────────────────────────────────────────────
  const { data: me } = useQuery({
    queryKey: ['auth', 'me', authKey(auth)],
    queryFn: () => fetchMe(auth!),
    enabled: auth !== null,
    staleTime: 10 * 60_000,
  });

  // ── Fetch all 365 days' completion in one call ────────────────────────────
  const { data: days, isLoading: daysLoading } = useQuery<DaySummary[]>({
    queryKey: ['plan', 'all-days', me?.planId, authKey(auth)],
    queryFn: () => fetchDaysSummary(me!.planId!, auth!),
    enabled: auth !== null && !!me?.planId,
    staleTime: 2 * 60_000,
  });

  // ── Scroll today into view on first render ────────────────────────────────
  useEffect(() => {
    if (todayRowRef.current) {
      todayRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [days]);

  const handleDayClick = useCallback((dayNumber: number) => {
    window.location.href = `/read?day=${dayNumber}`;
  }, []);

  // ── Auth loading ──────────────────────────────────────────────────────────
  if (auth === null) {
    return (
      <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
        <p style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-text-muted)', fontSize: '0.9375rem', textTransform: 'lowercase' }}>
          loading…
        </p>
      </div>
    );
  }

  const isLoading = daysLoading || !me;

  return (
    <div style={{ maxWidth: '36rem', margin: '0 auto', paddingBottom: 'var(--space-16)' }}>
      {/* Sticky page header */}
      <div
        style={{
          padding: 'var(--space-6) var(--space-6) var(--space-4)',
          position: 'sticky',
          top: 0,
          backgroundColor: 'var(--color-bg-page)',
          zIndex: 10,
          borderBottom: '1px solid var(--color-outline)',
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-headline)',
            fontSize: '1.25rem',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            textTransform: 'lowercase',
            margin: 0,
          }}
        >
          reading plan
        </h1>
        <p
          style={{
            fontFamily: 'var(--font-headline)',
            fontSize: '0.8125rem',
            color: 'var(--color-text-muted)',
            textTransform: 'lowercase',
            margin: 'var(--space-1) 0 0',
          }}
        >
          1 year · genesis to revelation
        </p>
      </div>

      {/* Loading skeletons */}
      {isLoading && (
        <div style={{ padding: 'var(--space-4) var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
          {Array.from({ length: 12 }, (_, i) => (
            <div
              key={i}
              style={{
                height: 52,
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-bg-surface)',
                animation: 'pulse 1.4s ease-in-out infinite',
                animationDelay: `${i * 60}ms`,
              }}
            />
          ))}
        </div>
      )}

      {/* 365-day list */}
      {!isLoading && days && days.length > 0 && (
        <div style={{ padding: 'var(--space-3) var(--space-2)' }}>
          {days.map((day) => (
            <div key={day.dayNumber} ref={day.isToday ? todayRowRef : null}>
              <PlanDayRow
                dayNumber={day.dayNumber}
                label={day.label}
                completionPct={day.completionPct}
                isToday={day.isToday}
                offsetFromToday={day.offsetFromToday}
                onClick={() => handleDayClick(day.dayNumber)}
              />
              {!day.isToday && (
                <div
                  aria-hidden="true"
                  style={{
                    height: '1px',
                    margin: '0 var(--space-5)',
                    backgroundColor: 'var(--color-outline)',
                    opacity: 0.4,
                  }}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (!days || days.length === 0) && (
        <div style={{ padding: 'var(--space-10) var(--space-6)', textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-headline)', fontSize: '0.9375rem', color: 'var(--color-text-muted)', textTransform: 'lowercase' }}>
            your plan will appear here once you start reading
          </p>
        </div>
      )}
    </div>
  );
}
