/**
 * api.ts — typed fetch wrappers for all Lectio API endpoints
 *
 * Auth modes:
 *   { type: 'bearer'; token: string }        — signed-in user (Supabase JWT)
 *   { type: 'guest'; guestToken: string }    — guest user (X-Guest-Token header)
 *
 * Error handling: all non-2xx responses throw ApiError with a typed code.
 * Never use raw fetch() outside this file.
 */
import type {
  Book,
  Chapter,
  Verse,
  PlanDayView,
  PlanDayListResponse,
  VerseReadResult,
  ContinuePosition,
  ProgressSummary,
  GuestUser,
  OtpSendResult,
  OtpVerifyResult,
  MigrateGuestResult,
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

export async function getPlanDays(
  planId: string,
  params: { limit?: number; offset?: number },
  auth: AuthContext,
): Promise<PlanDayListResponse> {
  const qs = new URLSearchParams();
  if (params.limit !== undefined) qs.set('limit', String(params.limit));
  if (params.offset !== undefined) qs.set('offset', String(params.offset));
  const query = qs.toString() ? `?${qs.toString()}` : '';
  const res = await request<PlanDayListResponse>(`/plan/${planId}/days${query}`, { auth });
  return res;
}

// ── Progress endpoints (auth required) ───────────────────────────────────────

export async function markVersesRead(
  verseIds: number[],
  auth: AuthContext,
): Promise<VerseReadResult> {
  const res = await request<{ data: VerseReadResult }>('/progress/verses', {
    method: 'POST',
    body: JSON.stringify({ verseIds }),
    auth,
  });
  return res.data;
}

export async function getContinuePosition(auth: AuthContext): Promise<ContinuePosition | null> {
  try {
    const res = await request<{ data: ContinuePosition }>('/progress/continue', { auth });
    return res.data;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export async function getProgressSummary(auth: AuthContext): Promise<ProgressSummary> {
  const res = await request<{ data: ProgressSummary }>('/progress/summary', { auth });
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
