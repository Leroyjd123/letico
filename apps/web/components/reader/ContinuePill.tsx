'use client';
/**
 * ContinuePill.tsx
 *
 * Floating pill that sits ABOVE the bottom navigation bar (it used to be
 * hidden underneath it).
 * When position is available: a link that opens the first unread verse on
 * jw.org — "continue reading → {bookName} {chapter}".
 * While loading or on error: renders nothing (it used to say "you've finished"
 * to brand-new readers while the request was in flight).
 * When finished (all verses read): "you've finished" — muted, no celebration.
 *
 * Lectio is calm and guilt-free. No confetti, no bounce animation.
 */
import type { CSSProperties } from 'react';
import type { ContinuePosition } from '@lectio/types';
import { buildJwVerseLink } from '../../lib/jwLink';

interface ContinuePillProps {
  position: ContinuePosition | null;
  isLoading: boolean;
  isError?: boolean;
}

export function ContinuePill({ position, isLoading, isError = false }: ContinuePillProps) {
  if (isLoading || isError) return null;

  const baseStyle: CSSProperties = {
    position: 'fixed',
    // Bottom nav is var(--nav-height) tall plus the safe area; sit above it.
    bottom: 'calc(env(safe-area-inset-bottom, 0px) + var(--nav-height) + var(--space-3))',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    padding: 'var(--space-3) var(--space-6)',
    borderRadius: 'var(--radius-full)',
    fontFamily: 'var(--font-headline)',
    fontSize: '0.9375rem',
    fontWeight: 500,
    textTransform: 'lowercase',
    whiteSpace: 'nowrap',
    userSelect: 'none',
    WebkitTapHighlightColor: 'transparent',
    zIndex: 40,
    border: 'none',
    textDecoration: 'none',
  };

  if (!position) {
    return (
      <div
        style={{
          ...baseStyle,
          backgroundColor: 'var(--color-bg-surface)',
          color: 'var(--color-text-muted)',
          boxShadow: 'var(--shadow-card)',
          cursor: 'default',
        }}
        role="status"
      >
        you&apos;ve finished
      </div>
    );
  }

  let href = '#';
  try {
    href = buildJwVerseLink(position.bookUsfm, position.chapterNumber, position.verseNumber);
  } catch {
    // unknown book code — leave as '#'
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        ...baseStyle,
        backgroundColor: 'var(--color-primary)',
        color: 'var(--color-on-primary)',
        boxShadow: '0 8px 40px rgba(77,97,79,0.25)',
        cursor: 'pointer',
      }}
      aria-label={`continue reading ${position.bookName.toLowerCase()} ${position.chapterNumber}:${position.verseNumber} on jw.org (opens in new tab)`}
    >
      continue reading
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M3 8h10M9 4l4 4-4 4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {position.bookName.toLowerCase()} {position.chapterNumber}
    </a>
  );
}
