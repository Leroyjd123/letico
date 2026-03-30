'use client';
/**
 * GuestBackupNudge.tsx
 *
 * One-per-session inline banner shown to guest users after ≥ 10 chapters are
 * marked read in the current session.
 *
 * Rules (R3, R4):
 *   - No pressure language ("you might lose your progress" not "you WILL lose it")
 *   - Entirely dismissible — once dismissed it does not reappear this session
 *   - sessionStorage key ensures it shows at most once per browser session
 *
 * The sign-in action is a placeholder for Phase 5 OTP flow.
 */

const SESSION_KEY = 'lectio_nudge_shown';

interface GuestBackupNudgeProps {
  onDismiss: () => void;
  onSignIn: () => void;
}

export function GuestBackupNudge({ onDismiss, onSignIn }: GuestBackupNudgeProps) {
  function handleDismiss() {
    sessionStorage.setItem(SESSION_KEY, '1');
    onDismiss();
  }

  function handleSignIn() {
    sessionStorage.setItem(SESSION_KEY, '1');
    onSignIn();
  }

  return (
    <div
      role="status"
      aria-label="sign in to keep your progress"
      style={{
        margin: '0 0 var(--space-4)',
        padding: 'var(--space-4) var(--space-5)',
        borderRadius: 'var(--radius-lg)',
        backgroundColor: 'var(--color-bg-surface)',
        border: '1px solid var(--color-outline)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
      }}
    >
      <p
        style={{
          margin: 0,
          fontFamily: 'var(--font-body)',
          fontSize: '0.875rem',
          color: 'var(--color-text-primary)',
          lineHeight: 1.5,
        }}
      >
        your reading is saved on this device — sign in to keep it across devices
      </p>

      <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
        <button
          onClick={handleSignIn}
          style={{
            fontFamily: 'var(--font-headline)',
            fontSize: '0.875rem',
            fontWeight: 500,
            color: 'var(--color-primary)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            textTransform: 'lowercase',
          }}
        >
          sign in
        </button>

        <button
          onClick={handleDismiss}
          style={{
            fontFamily: 'var(--font-headline)',
            fontSize: '0.8125rem',
            color: 'var(--color-text-muted)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            textTransform: 'lowercase',
          }}
        >
          not now
        </button>
      </div>
    </div>
  );
}

/** Returns true if the nudge should be shown this session (not already dismissed). */
export function shouldShowNudge(): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  return sessionStorage.getItem(SESSION_KEY) === null;
}
