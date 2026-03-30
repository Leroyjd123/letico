'use client';
/**
 * LoginPageClient.tsx — 2-step OTP sign-in flow.
 *
 * Step 1: email → POST /api/auth/otp/send
 * Step 2: 6-digit code → POST /api/auth/otp/verify
 *         → supabase.auth.setSession (triggers useAuth onAuthStateChange)
 *         → if localStorage guest token: POST /api/auth/migrate → clear token
 *         → navigate to /read
 *
 * Language rules (R4): no "wrong code", no "expired", no urgency.
 * Error message: "that code didn't work — request a new one"
 */
import { useState, useRef } from 'react';
import { sendOtp, verifyOtp, migrateGuest } from '../../../lib/api';
import type { AuthContext } from '../../../lib/api';
import { getBrowserSupabaseClient } from '../../../lib/supabase';

const GUEST_TOKEN_KEY = 'lectio_guest_token';

type Step = 'email' | 'code';

export function LoginPageClient() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  // ── Step 1: send OTP ──────────────────────────────────────────────────────
  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await sendOtp(email.trim());
      setStep('code');
      setTimeout(() => codeRef.current?.focus(), 50);
    } catch {
      setError('couldn't send a code to that address — check the email and try again');
    } finally {
      setIsLoading(false);
    }
  }

  // ── Step 2: verify OTP + migrate guest ────────────────────────────────────
  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const result = await verifyOtp(email.trim(), code.trim());

      // Set the Supabase session on the client so useAuth picks it up via onAuthStateChange
      const supabase = getBrowserSupabaseClient();
      await supabase.auth.setSession({
        access_token: result.accessToken,
        refresh_token: result.refreshToken,
      });

      // Migrate guest progress if a guest token exists
      const guestToken = localStorage.getItem(GUEST_TOKEN_KEY);
      if (guestToken) {
        const bearerAuth: AuthContext = { type: 'bearer', token: result.accessToken };
        try {
          await migrateGuest(guestToken, bearerAuth);
        } catch {
          // Migration failure is non-fatal — reads remain on the guest account
          // Phase 7 can add a retry UI here
        }
        localStorage.removeItem(GUEST_TOKEN_KEY);
      }

      // Navigate to reading screen — auth state will be picked up by useAuth
      window.location.href = '/read';
    } catch {
      setError('that code didn't work — request a new one');
    } finally {
      setIsLoading(false);
    }
  }

  // ── Shared styles ─────────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: 'var(--space-3) var(--space-4)',
    fontFamily: 'var(--font-body)',
    fontSize: '1rem',
    color: 'var(--color-text-primary)',
    backgroundColor: 'var(--color-bg-surface)',
    border: '1px solid var(--color-outline)',
    borderRadius: 'var(--radius-md)',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const primaryBtnStyle: React.CSSProperties = {
    width: '100%',
    padding: 'var(--space-3) var(--space-4)',
    fontFamily: 'var(--font-headline)',
    fontSize: '1rem',
    fontWeight: 500,
    color: 'var(--color-bg-page)',
    backgroundColor: 'var(--color-primary)',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    cursor: isLoading ? 'wait' : 'pointer',
    textTransform: 'lowercase' as const,
    opacity: isLoading ? 0.7 : 1,
  };

  return (
    <div
      style={{
        maxWidth: '24rem',
        margin: '0 auto',
        padding: 'var(--space-12) var(--space-6)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-8)',
      }}
    >
      {/* Header */}
      <div>
        <h1
          style={{
            fontFamily: 'var(--font-headline)',
            fontSize: '1.5rem',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            textTransform: 'lowercase',
            margin: '0 0 var(--space-2)',
          }}
        >
          {step === 'email' ? 'sign in' : 'enter your code'}
        </h1>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '0.9375rem',
            color: 'var(--color-text-muted)',
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          {step === 'email'
            ? 'we'll send a sign-in code to your email'
            : `we sent a 6-digit code to ${email}`}
        </p>
      </div>

      {/* Step 1: email form */}
      {step === 'email' && (
        <form
          onSubmit={(e) => { void handleSendCode(e); }}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
        >
          <input
            ref={emailRef}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            autoFocus
            autoComplete="email"
            style={inputStyle}
          />
          <button type="submit" disabled={isLoading || !email.trim()} style={primaryBtnStyle}>
            {isLoading ? 'sending…' : 'send code'}
          </button>
          {error && (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: 0 }}>
              {error}
            </p>
          )}
        </form>
      )}

      {/* Step 2: OTP form */}
      {step === 'code' && (
        <form
          onSubmit={(e) => { void handleVerify(e); }}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
        >
          <input
            ref={codeRef}
            type="text"
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="6-digit code"
            required
            autoComplete="one-time-code"
            style={{ ...inputStyle, letterSpacing: '0.25em', textAlign: 'center', fontSize: '1.25rem' }}
          />
          <button
            type="submit"
            disabled={isLoading || code.trim().length < 6}
            style={primaryBtnStyle}
          >
            {isLoading ? 'verifying…' : 'verify'}
          </button>
          {error && (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: 0 }}>
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={() => { setStep('email'); setCode(''); setError(null); }}
            style={{
              fontFamily: 'var(--font-headline)',
              fontSize: '0.875rem',
              color: 'var(--color-text-muted)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              textTransform: 'lowercase',
              padding: 0,
              textAlign: 'left',
            }}
          >
            ← use a different email
          </button>
        </form>
      )}

      {/* Back to reading link */}
      <a
        href="/read"
        style={{
          fontFamily: 'var(--font-headline)',
          fontSize: '0.875rem',
          color: 'var(--color-text-muted)',
          textDecoration: 'none',
          textTransform: 'lowercase',
        }}
      >
        continue without signing in →
      </a>
    </div>
  );
}
