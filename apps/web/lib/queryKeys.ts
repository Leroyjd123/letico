/**
 * queryKeys.ts — every React Query key in one place.
 *
 * User-scoped keys include a STABLE user key (JWT `sub` or guest token), not a
 * slice of the access token: the token changes on every hourly refresh, which
 * used to orphan the cache and make optimistic updates write to dead keys.
 *
 * Top-level prefixes ('plan', 'progress', 'me') are what mutations invalidate.
 */
export const queryKeys = {
  me: (user: string) => ['me', user] as const,
  plans: () => ['plans', 'list'] as const,
  planDay: (user: string, day: number | 'today') => ['plan', 'day', user, day] as const,
  planSummary: (user: string, planId: string) => ['plan', 'summary', user, planId] as const,
  continue: (user: string) => ['progress', 'continue', user] as const,
  summary: (user: string) => ['progress', 'summary', user] as const,
  dailyCounts: (user: string, days: number) => ['progress', 'daily', user, days] as const,
};
