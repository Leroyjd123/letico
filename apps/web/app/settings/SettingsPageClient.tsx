'use client';
/**
 * SettingsPageClient.tsx
 *
 * Shows auth state and a sign-out action.
 *
 * Signed-in: displays email + "sign out" button.
 * Guest: displays "sign in" link.
 *
 * Sign out:
 *   1. supabase.auth.signOut() — clears Supabase session
 *   2. Remove lectio_guest_token from localStorage (so useAuth auto-provisions a fresh guest)
 *   3. Navigate to /read — useAuth will create a new guest on next mount
 *
 * Phase 7 adds: plan selection, theme toggle, reset progress, export.
 */
import { useState } from 'react';
import { useAuthContext } from '../../components/providers/AuthProvider';
import { getBrowserSupabaseClient } from '../../lib/supabase';

const GUEST_TOKEN_KEY = 'lectio_guest_token';

export function SettingsPageClient() {
  const { auth, isProvisioning } = useAuthContext();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      const supabase = getBrowserSupabaseClient();
      await supabase.auth.signOut();
      localStorage.removeItem(GUEST_TOKEN_KEY);
      window.location.href = '/read';
    } catch {
      setIsSigningOut(false);
    }
  }

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 'var(--space-4) var(--space-5)',
    borderBottom: '1px solid var(--color-outline)',
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-body)',
    fontSize: '0.9375rem',
    color: 'var(--color-text-primary)',
  };

  const mutedStyle: React.CSSProperties = {
    fontFamily: 'var(--font-body)',
    fontSize: '0.875rem',
    color: 'var(--color-text-muted)',
  };

  return (
    <div style={{ maxWidth: '36rem', margin: '0 auto' }}>
      {/* Page header */}
      <div
        style={{
          padding: 'var(--space-6) var(--space-6) var(--space-4)',
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
          settings
        </h1>
      </div>

      {/* Account section */}
      <section style={{ marginTop: 'var(--space-6)' }}>
        <p
          style={{
            fontFamily: 'var(--font-headline)',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'var(--color-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            padding: '0 var(--space-5) var(--space-2)',
            margin: 0,
          }}
        >
          account
        </p>

        {isProvisioning && (
          <div style={rowStyle}>
            <span style={mutedStyle}>loading…</span>
          </div>
        )}

        {!isProvisioning && auth?.type === 'bearer' && (
          <>
            <div style={rowStyle}>
              <span style={labelStyle}>signed in</span>
            </div>
            <div style={rowStyle}>
              <button
                onClick={() => { void handleSignOut(); }}
                disabled={isSigningOut}
                style={{
                  fontFamily: 'var(--font-headline)',
                  fontSize: '0.9375rem',
                  color: 'var(--color-text-muted)',
                  background: 'none',
                  border: 'none',
                  cursor: isSigningOut ? 'wait' : 'pointer',
                  padding: 0,
                  textTransform: 'lowercase',
                }}
              >
                {isSigningOut ? 'signing out…' : 'sign out'}
              </button>
            </div>
          </>
        )}

        {!isProvisioning && auth?.type === 'guest' && (
          <div style={rowStyle}>
            <span style={labelStyle}>reading as guest</span>
            <a
              href="/login"
              style={{
                fontFamily: 'var(--font-headline)',
                fontSize: '0.9375rem',
                color: 'var(--color-primary)',
                textDecoration: 'none',
                textTransform: 'lowercase',
              }}
            >
              sign in →
            </a>
          </div>
        )}
      </section>

      {/* Placeholder rows for Phase 7 */}
      <section style={{ marginTop: 'var(--space-6)' }}>
        <p
          style={{
            fontFamily: 'var(--font-headline)',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'var(--color-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            padding: '0 var(--space-5) var(--space-2)',
            margin: 0,
          }}
        >
          reading
        </p>
        <div style={rowStyle}>
          <span style={labelStyle}>reading plan</span>
          <span style={mutedStyle}>1 year · genesis to revelation</span>
        </div>
      </section>
    </div>
  );
}
