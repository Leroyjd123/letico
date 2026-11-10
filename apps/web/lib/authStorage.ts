/**
 * authStorage.ts — the one place that knows where the guest token lives.
 * (Previously the localStorage key was copy-pasted into five files.)
 */
const GUEST_TOKEN_KEY = 'lectio_guest_token';

export function getGuestToken(): string | null {
  try {
    return localStorage.getItem(GUEST_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setGuestToken(token: string): void {
  try {
    localStorage.setItem(GUEST_TOKEN_KEY, token);
  } catch {
    // storage unavailable (private mode) — guest lives for this tab only
  }
}

export function clearGuestToken(): void {
  try {
    localStorage.removeItem(GUEST_TOKEN_KEY);
  } catch {
    // ignore
  }
}
