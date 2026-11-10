/**
 * api.ts — typed fetch wrappers for all Lectio API endpoints
 *
 * Auth modes:
 *   { type: 'bearer'; token: string }        — signed-in user (Supabase JWT)
 *   { type: 'guest'; guestToken: string }    — guest user (X-Guest-Token header)
 *
 * Error handling: all non-2xx responses throw ApiError with a typed code.
 * Never use raw fetch() outside this file.
 * Every request carries X-Timezone so the API computes "today" locally.
 */
import type {
  Book,
  Chapter,
  Verse,
  PlanDayView,
  PlanDaySummary,
  VerseReadResult,
  VerseUnreadResult,
  ContinuePosition,
  ProgressSummary,
  GuestUser,
  OtpSendResult,
  OtpVerifyResult,
  MigrateGuestResult,
  DailyCount,
  PlanListItem,
  UpdateUserResult,
  ResetProgressResult,
  ExportProgressResult,
  MeResult,
} from '@lectio/types';

// ── Error type ───────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ── Auth context ─────────────────────────────────────────────────────────────

export type AuthContext =
  | { type: 'bearer'; token: string }
  | { type: 'guest'; guestToken: string };

/** Decodes the `sub` claim of a JWT without verifying it (the API verifies). */
function jwtSubject(token: string): string | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const sub = (JSON.parse(json) as { sub?: unknown }).sub;
    return typeof sub === 'string' ? sub : null;
  } catch {
    return null;
  }
}

/**
 * Stable per-user cache key. Survives token refreshes (unlike the token
 * itself) and differs between accounts and guests.
 */
export function userKey(auth: AuthContext | null): string {
  if (!auth) return 'anon';
  if (auth.type === 'guest') return `g:${auth.guestToken}`;
  return `u:${jwtSubject(auth.token) ?? auth.token}`;
}

/** The reader's IANA time zone, so "today" follows their local calendar. */
function timeZoneHeader(): Record<string, string> {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz ? { 'X-Timezone': tz } : {};
  } catch {
    return {};
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

const BASE_URL =
  (typeof process !== 'undefined'
    ? process.env['NEXT_PUBLIC_API_BASE_URL']
    : undefined) ?? 'http://localhost:4000/api';

function authHeaders(auth?: AuthContext): Record<string, string> {
  if (!auth) return {};
  if (auth.type === 'bearer') return { Authorization: `Bearer ${auth.token}` };
  return { 'X-Guest-Token': auth.guestToken };
}

async function request<T>(
  path: string,
  options: RequestInit & { auth?: AuthContext } = {},
): Promise<T> {
  const { auth, ...fetchOptions } = options;

  const res = await fetch(`${BASE_URL}${path}`, {
    ...fetchOptions,
    headers: {
      'Content-Type': 'application/json',
      ...timeZoneHeader(),
      ...authHeaders(auth),
      ...(fetchOptions.headers as Record<string, string> | undefined),
    },
  });

  if (!res.ok) {
    let code = 'UNKNOWN_ERROR';
    let message = res.statusText;
    try {
      const body = (await res.json()) as { error?: { code?: string; message?: string } };
      code = body.error?.code ?? code;
      message = body.error?.message ?? message;
    } catch {
      // body wasn't JSON — keep defaults
    }
    throw new ApiError(code, res.status, message);
  }

  return res.json() as Promise<T>;
}

// ── Bible endpoints (no auth required) ───────────────────────────────────────

export async function getBooks(): Promise<Book[]> {
  const res = await request<{ data: Book[] }>('/bible/books');
  return res.data;
}

export async function getBook(usfmCode: string): Promise<Book> {
  const res = await request<{ data: Book }>(`/bible/books/${usfmCode}`);
  return res.data;
}

export async function getChapters(usfmCode: string): Promise<Chapter[]> {
  const res = await request<{ data: Chapter[] }>(`/bible/books/${usfmCode}/chapters`);
  return res.data;
}

export async function getVerses(chapterId: number): Promise<Verse[]> {
  const res = await request<{ data: Verse[] }>(`/bible/chapters/${chapterId}/verses`);
  return res.data;
}

// ── Plan endpoints (auth required) ───────────────────────────────────────────

export async function getPlanToday(auth: AuthContext): Promise<PlanDayView> {
  const res = await request<{ data: PlanDayView }>('/plan/today', { auth });
  return res.data;
}

export async function getPlanDay(
  planId: string,
  dayNumber: number,
  auth: AuthContext,
): Promise<PlanDayView> {
  const res = await request<{ data: PlanDayView }>(
    `/plan/${planId}/day/${dayNumber}`,
    { auth },
  );
  return res.data;
}

export async function getPlanDaysSummary(
  planId: string,
  auth: AuthContext,
): Promise<PlanDaySummary[]> {
  const res = await request<{ data: PlanDaySummary[] }>(`/plan/${planId}/days/summary`, { auth });
  return res.data;
}

export async function listPlans(): Promise<PlanListItem[]> {
  const res = await request<{ data: PlanListItem[] }>('/plan/list');
  return res.data;
}

// ── Progress endpoints (auth required) ───────────────────────────────────────

/**
 * @param readAt when the reading happened (offline queue). The server clamps
 *               it to the last 30 days.
 */
export async function markVersesRead(
  verseIds: number[],
  auth: AuthContext,
  readAt?: string,
): Promise<VerseReadResult> {
  const res = await request<{ data: VerseReadResult }>('/progress/verses', {
    method: 'POST',
    body: JSON.stringify(readAt ? { verseIds, readAt } : { verseIds }),
    auth,
  });
  return res.data;
}

export async function unmarkVersesRead(
  verseIds: number[],
  auth: AuthContext,
): Promise<VerseUnreadResult> {
  const res = await request<{ data: VerseUnreadResult }>('/progress/verses/unmark', {
    method: 'POST',
    body: JSON.stringify({ verseIds }),
    auth,
  });
  return res.data;
}

export async function getContinuePosition(auth: AuthContext): Promise<ContinuePosition | null> {
  const res = await request<{ data: ContinuePosition | null }>('/progress/continue', { auth });
  return res.data;
}

export async function getProgressSummary(auth: AuthContext): Promise<ProgressSummary> {
  const res = await request<{ data: ProgressSummary }>('/progress/summary', { auth });
  return res.data;
}

export async function getDailyCounts(days: number, auth: AuthContext): Promise<DailyCount[]> {
  const res = await request<{ data: DailyCount[] }>(`/progress/daily-counts?days=${days}`, { auth });
  return res.data;
}

export async function resetProgress(auth: AuthContext): Promise<ResetProgressResult> {
  const res = await request<{ data: ResetProgressResult }>('/progress/reset', {
    method: 'POST',
    auth,
  });
  return res.data;
}

export async function exportProgress(auth: AuthContext): Promise<ExportProgressResult> {
  const res = await request<{ data: ExportProgressResult }>('/progress/export', { auth });
  return res.data;
}

// ── Auth endpoints ────────────────────────────────────────────────────────────

export async function sendOtp(email: string): Promise<OtpSendResult> {
  const res = await request<{ data: OtpSendResult }>('/auth/otp/send', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
  return res.data;
}

export async function verifyOtp(email: string, token: string): Promise<OtpVerifyResult> {
  const res = await request<{ data: OtpVerifyResult }>('/auth/otp/verify', {
    method: 'POST',
    body: JSON.stringify({ email, token }),
  });
  return res.data;
}

export async function createGuest(): Promise<GuestUser> {
  const res = await request<{ data: GuestUser }>('/auth/guest', {
    method: 'POST',
  });
  return res.data;
}

export async function migrateGuest(
  guestToken: string,
  auth: AuthContext,
): Promise<MigrateGuestResult> {
  const res = await request<{ data: MigrateGuestResult }>('/auth/migrate', {
    method: 'POST',
    body: JSON.stringify({ guestToken }),
    auth,
  });
  return res.data;
}

export async function getMe(auth: AuthContext): Promise<MeResult> {
  const res = await request<{ data: MeResult }>('/auth/me', { auth });
  return res.data;
}

export async function updateUser(
  dto: { planId?: string; planStartDate?: string | null },
  auth: AuthContext,
): Promise<UpdateUserResult> {
  const res = await request<{ data: UpdateUserResult }>('/users/me', {
    method: 'PATCH',
    body: JSON.stringify(dto),
    auth,
  });
  return res.data;
}
