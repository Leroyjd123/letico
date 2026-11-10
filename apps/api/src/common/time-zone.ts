/**
 * time-zone.ts
 *
 * "Today", streaks and daily counts must follow the reader's LOCAL calendar,
 * not UTC — otherwise the day rolls over mid-afternoon in the Americas and in
 * the early morning in Asia. The web client sends its IANA zone in the
 * X-Timezone header; anything missing or invalid falls back to UTC.
 */
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export const DEFAULT_TIME_ZONE = 'UTC';

export function resolveTimeZone(raw: unknown): string {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 64) return DEFAULT_TIME_ZONE;
  try {
    // Throws RangeError for unknown zones. Return the caller's spelling: ICU
    // may canonicalise to legacy names (Asia/Kolkata → Asia/Calcutta).
    new Intl.DateTimeFormat('en-US', { timeZone: raw });
    return raw;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

/** Calendar date (YYYY-MM-DD) of `at` in the given IANA time zone. */
export function localDate(timeZone: string, at: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

/** Whole days from `from` to `to` (both YYYY-MM-DD). */
export function daysBetween(from: string, to: string): number {
  const a = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10));
  const b = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

/**
 * Day number of the plan that is "today" for the reader.
 * Day 1 when no start date is set; clamped to [1, totalDays].
 */
export function todayDayNumber(
  planStartDate: string | null,
  timeZone: string,
  totalDays: number,
  now: Date = new Date(),
): number {
  if (!planStartDate) return 1;
  const day = daysBetween(planStartDate.slice(0, 10), localDate(timeZone, now)) + 1;
  return Math.max(1, Math.min(Math.max(totalDays, 1), day));
}

/** @TimeZone() — the caller's validated IANA time zone (X-Timezone header). */
export const TimeZone = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest<Request>();
  return resolveTimeZone(request.headers['x-timezone']);
});
