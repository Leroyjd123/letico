'use client';
/**
 * ContinuePill.tsx
 *
 * Floating pill fixed above the bottom of the viewport.
 * When position is available: "continue reading → {bookName} {chapter}"
 * When null (all verses read): "you've finished" — muted styling, no celebration.
 *
 * Lectio is calm and guilt-free. No confetti, no bounce animation.
 */
import type { CSSProperties } from 'react';
import type { ContinuePosition } from '@lectio/types';

interface ContinuePillProps {
  position: ContinuePosition | null;
  onClick: (position: ContinuePosition) => void;
}

export function ContinuePill({ position, onClick }: ContinuePillProps) {
  const baseStyle: CSSProperties = {
    position: 'fixed',
    bottom: 'calc(env(safe-area-inset-bottom, 0px) + var(--space-6))',
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
        aria-label="you have finished your reading plan"
      >
        you&apos;ve finished
      </div>
    );
  }

  return (
    <button
      onClick={() => onClick(position)}
      style={{
        ...baseStyle,
        backgroundColor: 'var(--color-primary)',
        color: 'var(--color-on-primary)',
        boxShadow: '0 8px 40px rgba(77,97,79,0.25)',
        cursor: 'pointer',
      }}
      aria-label={`continue reading ${position.bookName} chapter ${position.chapterNumber}`}
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
    </button>
  );
}
