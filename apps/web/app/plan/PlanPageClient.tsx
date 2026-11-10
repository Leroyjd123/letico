'use client';
/**
 * PlanPageClient.tsx
 *
 * Renders every day of the reader's plan.
 *
 * Data flow:
 *   1. useAuthContext() → AuthContext
 *   2. GET /api/auth/me → { planId } — the user's active reading plan
 *   3. GET /api/plan/:planId/days/summary → Array<DaySummary> (completion for all 365 days)
 *   4. Scrolls to today's row on first render via a ref
 *   5. Tapping any row → client-side navigation to /read?day=N
 *
 * No locked days, no disabled states. R2: all days freely navigable.
 */
import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { MeResult, PlanDaySummary, PlanListItem } from '@lectio/types';
import { useAuthContext } from '../../components/providers/AuthProvider';
import { getMe, getPlanDaysSummary, listPlans } from '../../lib/api';
import { queryKeys } from '../../lib/queryKeys';
import { PlanDayRow } from '../../components/plan/PlanDayRow';
import { Button } from '../../components/ui/Button';

export function PlanPageClient() {
  const { auth, userKey } = useAuthContext();
  const todayRowRef = useRef<HTMLDivElement | null>(null);
  const didScroll = useRef(false);

  // ── Resolve user's planId ─────────────────────────────────────────────────
  const { data: me } = useQuery<MeResult>({
    queryKey: queryKeys.me(userKey),
    queryFn: () => getMe(auth!),
    enabled: auth !== null,
    staleTime: 5 * 60_000,
  });

  const { data: plans } = useQuery<PlanListItem[]>({
    queryKey: queryKeys.plans(),
    queryFn: listPlans,
    staleTime: 60 * 60_000,
  });
  const plan = plans?.find((p) => p.id === me?.planId);

  // ── Every day's completion in one call ────────────────────────────────────
  const {
    data: days,
    isLoading: daysLoading,
    isError,
    refetch,
  } = useQuery<PlanDaySummary[]>({
    queryKey: queryKeys.planSummary(userKey, me?.planId ?? ''),
    queryFn: () => getPlanDaysSummary(me!.planId!, auth!),
    enabled: auth !== null && !!me?.planId,
    staleTime: 2 * 60_000,
  });

  // ── Scroll today into view once (not on every background refetch) ────────
  useEffect(() => {
    if (didScroll.current || !todayRowRef.current) return;
    didScroll.current = true;
    todayRowRef.current.scrollIntoView({ block: 'center' });
  }, [days]);

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

  const isLoading = !isError && (daysLoading || !me);

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
          {plan ? `${plan.name} · ${plan.totalDays} days` : '\u00a0'}
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
                href={day.isToday ? '/read' : `/read?day=${day.dayNumber}`}
              />
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div style={{ padding: 'var(--space-10) var(--space-6)', textAlign: 'center', display: 'grid', gap: 'var(--space-4)', justifyItems: 'center' }}>
          <p style={{ fontFamily: 'var(--font-headline)', fontSize: '0.9375rem', color: 'var(--color-text-muted)', textTransform: 'lowercase' }}>
            your plan couldn&apos;t load
          </p>
          <Button variant="ghost" size="md" onClick={() => void refetch()}>
            try again
          </Button>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && (!days || days.length === 0) && (
        <div style={{ padding: 'var(--space-10) var(--space-6)', textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-headline)', fontSize: '0.9375rem', color: 'var(--color-text-muted)', textTransform: 'lowercase' }}>
            your plan will appear here once you start reading
          </p>
        </div>
      )}
    </div>
  );
}
