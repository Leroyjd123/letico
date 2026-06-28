'use client';
/**
 * AnalyticsPageClient.tsx — Analytics screen data shell.
 *
 * Data flow:
 *   1. useAuthContext() → AuthContext
 *   2. GET /api/progress/summary → ProgressSummary (completionPct, streakDays, aheadBehindVerses)
 *   3. GET /api/progress/daily-counts?days=7 → DailyCount[]
 *
 * Renders: two StatCards, StatusCard, ProgressGraph.
 * No gamification language anywhere. R1-compliant.
 */
import { useQuery } from '@tanstack/react-query';
import { useAuthContext } from '../../components/providers/AuthProvider';
import type { AuthContext } from '../../lib/api';
import { getProgressSummary, getDailyCounts } from '../../lib/api';
import { StatusCard } from '../../components/analytics/StatusCard';
import { StatCard } from '../../components/analytics/StatCard';
import { ProgressGraph } from '../../components/analytics/ProgressGraph';

function authKey(auth: AuthContext | null): string {
  if (!auth) return 'anon';
  return auth.type === 'bearer' ? `b:${auth.token.slice(-8)}` : `g:${auth.guestToken.slice(-8)}`;
}

export function AnalyticsPageClient() {
  const { auth } = useAuthContext();

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['progress', 'summary', authKey(auth)],
    queryFn: () => getProgressSummary(auth!),
    enabled: auth !== null,
    staleTime: 60_000,
  });

  const { data: dailyCounts, isLoading: dailyLoading } = useQuery({
    queryKey: ['progress', 'daily-counts', 7, authKey(auth)],
    queryFn: () => getDailyCounts(7, auth!),
    enabled: auth !== null,
    staleTime: 60_000,
  });

  // Auth not yet provisioned — show minimal loading text (matches PlanPageClient pattern)
  if (auth === null) {
    return (
      <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
        <p
          style={{
            fontFamily: 'var(--font-headline)',
            color: 'var(--color-text-muted)',
            fontSize: '0.9375rem',
            textTransform: 'lowercase',
          }}
        >
          loading…
        </p>
      </div>
    );
  }

  const isLoading = summaryLoading || !summary;
  const hasReads = summary && summary.totalVersesRead > 0;
  const hasRecentActivity = dailyCounts && dailyCounts.some((d) => d.count > 0);

  return (
    <div style={{ maxWidth: '36rem', margin: '0 auto' }}>
      {/* Sticky page header */}
      <div
        style={{
          padding: 'var(--space-6) var(--space-6) var(--space-5)',
          position: 'sticky',
          top: 0,
          backgroundColor: 'var(--color-bg-page)',
          zIndex: 10,
          borderBottom: '1px solid var(--color-state-border)',
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-headline)',
            fontSize: '1.75rem',
            fontWeight: 300,
            color: 'var(--color-text-primary)',
            textTransform: 'lowercase',
            margin: 0,
            letterSpacing: '-0.01em',
          }}
        >
          your journey
        </h1>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '0.8125rem',
            color: 'var(--color-text-muted)',
            textTransform: 'lowercase',
            marginTop: 'var(--space-1)',
            letterSpacing: '0.02em',
          }}
        >
          mapping the quiet evolution of your reading
        </p>
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div
          style={{
            padding: 'var(--space-6)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)',
          }}
        >
          <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 'var(--space-3)',
            }}
          >
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  height: 112,
                  borderRadius: 'var(--radius-lg)',
                  backgroundColor: 'var(--color-bg-surface)',
                  animation: 'pulse 1.4s ease-in-out infinite',
                  animationDelay: `${i * 80}ms`,
                }}
              />
            ))}
          </div>
          <div
            style={{
              height: 60,
              borderRadius: 'var(--radius-lg)',
              backgroundColor: 'var(--color-bg-surface)',
              animation: 'pulse 1.4s ease-in-out infinite',
              animationDelay: '160ms',
            }}
          />
          <div
            style={{
              height: 160,
              borderRadius: 'var(--radius-lg)',
              backgroundColor: 'var(--color-bg-surface)',
              animation: 'pulse 1.4s ease-in-out infinite',
              animationDelay: '240ms',
            }}
          />
        </div>
      )}

      {/* Analytics content */}
      {!isLoading && summary && (
        <div
          style={{
            padding: 'var(--space-6)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-5)',
          }}
        >
          {/* Stat cards grid: completion %, days of reading, verses read */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 'var(--space-3)',
            }}
          >
            <StatCard label="completed" value={`${summary.completionPct}%`} />
            <StatCard label="days of reading" value={summary.streakDays} />
            <StatCard label="verses read" value={summary.totalVersesRead} />
          </div>

          {/* Ahead / behind sentence — omitted when no plan */}
          <StatusCard aheadBehindVerses={summary.aheadBehindVerses} />

          {/* 7-day activity graph — only shown when there is recent activity */}
          {!dailyLoading && hasRecentActivity && (
            <div
              style={{
                backgroundColor: 'var(--color-stat-card-bg)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-5)',
              }}
            >
              <div style={{ marginBottom: 'var(--space-3)' }}>
                <p
                  style={{
                    fontFamily: 'var(--font-headline)',
                    fontSize: '0.6875rem',
                    letterSpacing: '0.18em',
                    color: 'var(--color-text-muted)',
                    textTransform: 'uppercase',
                    margin: 0,
                    fontWeight: 500,
                  }}
                >
                  last 7 days
                </p>
                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.75rem',
                    color: 'var(--color-text-muted)',
                    textTransform: 'lowercase',
                    marginTop: 'var(--space-1)',
                    opacity: 0.7,
                  }}
                >
                  a quiet record of your recent reading
                </p>
              </div>
              <ProgressGraph data={dailyCounts} />
            </div>
          )}

          {/* Empty state — no reads recorded yet */}
          {!hasReads && (
            <div style={{ padding: 'var(--space-8) 0', textAlign: 'center' }}>
              <p
                style={{
                  fontFamily: 'var(--font-headline)',
                  fontSize: '0.9375rem',
                  color: 'var(--color-text-muted)',
                  textTransform: 'lowercase',
                }}
              >
                your reading history will appear here
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
