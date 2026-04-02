'use client';
/**
 * SettingsPageClient.tsx
 *
 * Full settings page implementation (Phase 7).
 *
 * Sections:
 *   account    — sign in/out, guest indicator
 *   reading    — plan selector (from /plan/list), plan start date
 *   appearance — theme switcher (light / dark / sepia)
 *   data       — reset progress (double-confirm), export data (JSON download)
 *
 * Design rules:
 *   - CSS tokens only, no hardcoded hex
 *   - All visible text lowercase
 *   - No gamification language
 *   - Only one permitted solid border: 2px solid var(--color-primary) for active plan
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthContext } from '../../components/providers/AuthProvider';
import { getBrowserSupabaseClient } from '../../lib/supabase';
import {
  listPlans,
  getMe,
  updateUser,
  resetProgress,
  exportProgress,
} from '../../lib/api';
import { useTheme } from '../../hooks/useTheme';
import type { Theme } from '../../hooks/useTheme';

const GUEST_TOKEN_KEY = 'lectio_guest_token';

// ── Shared style tokens ───────────────────────────────────────────────────────

const sectionHeadingStyle: React.CSSProperties = {
  fontFamily: 'var(--font-headline)',
  fontSize: '0.75rem',
  fontWeight: 600,
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  padding: '0 var(--space-5) var(--space-2)',
  margin: 0,
};

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

const actionBtnStyle: React.CSSProperties = {
  fontFamily: 'var(--font-headline)',
  fontSize: '0.9375rem',
  color: 'var(--color-text-muted)',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: 0,
  textTransform: 'lowercase',
};

// ── Component ─────────────────────────────────────────────────────────────────

export function SettingsPageClient() {
  const { auth, isProvisioning } = useAuthContext();
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();

  // ── Sign out ──────────────────────────────────────────────────────────────
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

  // ── Fetch user profile (planId, planStartDate) ────────────────────────────
  const { data: me } = useQuery({
    queryKey: ['me', auth],
    queryFn: () => getMe(auth!),
    enabled: !!auth,
  });

  // ── Fetch available plans ─────────────────────────────────────────────────
  const { data: plans = [], isLoading: plansLoading } = useQuery({
    queryKey: ['plans', 'list'],
    queryFn: () => listPlans(),
  });

  // ── Update user mutation (plan / start date) ──────────────────────────────
  const updateUserMutation = useMutation({
    mutationFn: (dto: { planId?: string; planStartDate?: string }) =>
      updateUser(dto, auth!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });

  // ── Reset progress ────────────────────────────────────────────────────────
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetFlash, setResetFlash] = useState<string | null>(null);

  const resetMutation = useMutation({
    mutationFn: () => resetProgress(auth!),
    onSuccess: (result) => {
      setResetConfirm(false);
      setResetFlash(`${result.archivedCount} verses archived`);
      setTimeout(() => setResetFlash(null), 3000);
      void queryClient.invalidateQueries({ queryKey: ['progress'] });
    },
    onError: () => {
      setResetConfirm(false);
    },
  });

  function handleResetClick() {
    if (!resetConfirm) {
      setResetConfirm(true);
      return;
    }
    resetMutation.mutate();
  }

  // ── Export data ───────────────────────────────────────────────────────────
  const [isExporting, setIsExporting] = useState(false);

  async function handleExport() {
    if (!auth || isExporting) return;
    setIsExporting(true);
    try {
      const data = await exportProgress(auth);
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lectio-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const themes: Theme[] = ['light', 'dark', 'sepia'];

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

      {/* ── Account ────────────────────────────────────────────────────────── */}
      <section style={{ marginTop: 'var(--space-6)' }}>
        <p style={sectionHeadingStyle}>account</p>

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
                  ...actionBtnStyle,
                  cursor: isSigningOut ? 'wait' : 'pointer',
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

      {/* ── Reading ─────────────────────────────────────────────────────────── */}
      <section style={{ marginTop: 'var(--space-6)' }}>
        <p style={sectionHeadingStyle}>reading</p>

        {/* Plan selector */}
        <div
          style={{
            padding: 'var(--space-3) var(--space-5)',
            borderBottom: '1px solid var(--color-outline)',
          }}
        >
          <p
            style={{
              ...labelStyle,
              marginTop: 0,
              marginBottom: 'var(--space-3)',
            }}
          >
            reading plan
          </p>

          {plansLoading && (
            <span style={mutedStyle}>loading plans…</span>
          )}

          {!plansLoading && plans.length === 0 && (
            <span style={mutedStyle}>no plans available</span>
          )}

          {!plansLoading && plans.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {plans.map((plan) => {
                const isActive = me?.planId === plan.id;
                return (
                  <button
                    key={plan.id}
                    onClick={() => {
                      if (!auth || isActive) return;
                      updateUserMutation.mutate({ planId: plan.id });
                    }}
                    disabled={!auth || updateUserMutation.isPending}
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.9375rem',
                      color: isActive
                        ? 'var(--color-primary)'
                        : 'var(--color-text-primary)',
                      background: 'none',
                      border: isActive
                        ? '2px solid var(--color-primary)'
                        : '1px solid var(--color-outline)',
                      borderRadius: 'var(--radius-md)',
                      cursor: isActive ? 'default' : 'pointer',
                      padding: 'var(--space-3) var(--space-4)',
                      textAlign: 'left',
                      textTransform: 'lowercase',
                      fontWeight: isActive ? 600 : 400,
                      opacity: updateUserMutation.isPending && !isActive ? 0.6 : 1,
                    }}
                    aria-pressed={isActive}
                  >
                    {plan.name}
                    <span
                      style={{
                        display: 'block',
                        fontSize: '0.8125rem',
                        color: 'var(--color-text-muted)',
                        fontWeight: 400,
                        marginTop: 'var(--space-1)',
                      }}
                    >
                      {plan.totalDays} days
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Plan start date */}
        <div style={rowStyle}>
          <label
            htmlFor="plan-start-date"
            style={labelStyle}
          >
            start date
          </label>
          <input
            id="plan-start-date"
            type="date"
            disabled={!auth}
            onChange={(e) => {
              if (!auth || !e.target.value) return;
              updateUserMutation.mutate({ planStartDate: e.target.value });
            }}
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '0.875rem',
              color: 'var(--color-text-primary)',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-outline)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-2) var(--space-3)',
              cursor: auth ? 'pointer' : 'not-allowed',
              opacity: auth ? 1 : 0.5,
            }}
          />
        </div>
      </section>

      {/* ── Appearance ──────────────────────────────────────────────────────── */}
      <section style={{ marginTop: 'var(--space-6)' }}>
        <p style={sectionHeadingStyle}>appearance</p>
        <div
          style={{
            ...rowStyle,
            justifyContent: 'flex-start',
            gap: 'var(--space-4)',
          }}
        >
          {themes.map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              style={{
                fontFamily: 'var(--font-headline)',
                fontSize: '0.9375rem',
                color:
                  theme === t
                    ? 'var(--color-primary)'
                    : 'var(--color-text-muted)',
                fontWeight: theme === t ? 600 : 400,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 'var(--space-2) 0',
                textTransform: 'lowercase',
              }}
              aria-pressed={theme === t}
            >
              {t}
            </button>
          ))}
        </div>
      </section>

      {/* ── Data ────────────────────────────────────────────────────────────── */}
      {auth && (
        <section style={{ marginTop: 'var(--space-6)' }}>
          <p style={sectionHeadingStyle}>data</p>

          {/* Reset progress */}
          <div style={rowStyle}>
            <span style={labelStyle}>reset progress</span>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 'var(--space-1)' }}>
              {resetFlash ? (
                <span style={{ ...mutedStyle, fontSize: '0.8125rem' }}>{resetFlash}</span>
              ) : (
                <>
                  {resetConfirm && (
                    <span style={{ ...mutedStyle, fontSize: '0.8125rem' }}>
                      tap again to confirm reset
                    </span>
                  )}
                  <button
                    onClick={handleResetClick}
                    disabled={resetMutation.isPending}
                    style={{
                      ...actionBtnStyle,
                      color: resetConfirm
                        ? 'var(--color-error, #b00020)'
                        : 'var(--color-text-muted)',
                      cursor: resetMutation.isPending ? 'wait' : 'pointer',
                      opacity: resetMutation.isPending ? 0.6 : 1,
                    }}
                  >
                    {resetMutation.isPending
                      ? 'resetting…'
                      : resetConfirm
                      ? 'confirm reset'
                      : 'reset'}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Export data */}
          <div style={rowStyle}>
            <span style={labelStyle}>export data</span>
            <button
              onClick={() => { void handleExport(); }}
              disabled={isExporting}
              style={{
                ...actionBtnStyle,
                cursor: isExporting ? 'wait' : 'pointer',
                opacity: isExporting ? 0.6 : 1,
              }}
            >
              {isExporting ? 'exporting…' : 'export json'}
            </button>
          </div>
        </section>
      )}

    </div>
  );
}
