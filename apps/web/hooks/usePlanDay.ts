'use client';
/**
 * usePlanDay.ts — React Query wrapper for GET /plan/:planId/day/:dayNumber.
 * Stale time: 5 minutes. Disabled when planId or dayNumber are not available.
 */
import { useQuery } from '@tanstack/react-query';
import { getPlanDay } from '../lib/api';
import type { AuthContext } from '../lib/api';
import type { PlanDayView } from '@lectio/types';

export function usePlanDay(
  planId: string | null,
  dayNumber: number | null,
  auth: AuthContext | null,
): { data: PlanDayView | undefined; isLoading: boolean } {
  const { data, isLoading } = useQuery<PlanDayView>({
    queryKey: ['plan', planId, dayNumber],
    queryFn: () => getPlanDay(planId!, dayNumber!, auth!),
    enabled: auth !== null && planId !== null && dayNumber !== null,
    staleTime: 5 * 60_000,
  });

  return { data, isLoading };
}
