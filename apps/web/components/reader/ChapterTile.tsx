'use client';
/**
 * ChapterTile.tsx
 *
 * Tap: marks entire chapter read.
 * Long-press (600ms): opens the verse selector modal.
 *
 * Uses pointer events (not mouse/touch) for unified desktop + mobile handling.
 * touch-action: manipulation prevents double-tap-to-zoom interference.
 * user-select: none prevents text selection on long-press (edge case E11).
 *
 * Active visual feedback: scale(0.94) on pointer down.
 * Hover hint "hold to select verses" fades in on hover (desktop UX).
 */
import { useState, useRef, type CSSProperties, type PointerEvent } from 'react';

export type ReadState = 'read' | 'partial' | 'unread' | 'locked';

interface ChapterTileProps {
  chapterNumber: number;
  readState: ReadState;
  onTap: () => void;
  onLongPress: () => void;
}

const LONG_PRESS_MS = 600;

const STATE_STYLES: Record<ReadState, CSSProperties> = {
  read: {
    backgroundColor: 'var(--color-primary)',
    color: 'var(--color-on-primary)',
    border: 'none',
  },
  partial: {
    backgroundColor: 'var(--color-bg-surface)',
    color: 'var(--color-text-primary)',
    border: '1.5px solid var(--color-outline)',
    backgroundImage: 'linear-gradient(to top, rgba(77,97,79,0.15) 50%, transparent 50%)',
  },
  unread: {
    backgroundColor: 'var(--color-bg-elevated)',
    color: 'var(--color-text-secondary)',
    border: '1px solid rgba(77,97,79,0.10)',
  },
  locked: {
    backgroundColor: 'var(--color-bg-surface)',
    color: 'var(--color-text-muted)',
    border: '1px solid var(--color-outline)',
    opacity: 0.35,
    pointerEvents: 'none' as const,
  },
};

export function ChapterTile({
  chapterNumber,
  readState,
  onTap,
  onLongPress,
}: ChapterTileProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);

  function clearTimer() {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function handlePointerDown(e: PointerEvent<HTMLButtonElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    didLongPress.current = false;
    setPressed(true);

    timerRef.current = setTimeout(() => {
      didLongPress.current = true;
      setPressed(false);
      onLongPress();
    }, LONG_PRESS_MS);
  }

  function handlePointerUp() {
    setPressed(false);
    if (!didLongPress.current) {
      clearTimer();
      onTap();
    }
  }

  function handlePointerCancel() {
    clearTimer();
    setPressed(false);
    didLongPress.current = false;
  }

  const stateStyle = STATE_STYLES[readState];
  const readLabel =
    readState === 'read'
      ? 'read'
      : readState === 'partial'
      ? 'partially read'
      : readState === 'locked'
      ? 'locked'
      : 'unread';

  return (
    <button
      aria-label={`chapter ${chapterNumber}, ${readLabel}`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerCancel}
      onPointerCancel={handlePointerCancel}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...stateStyle,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 'var(--radius-md)',
        fontFamily: 'var(--font-headline)',
        fontWeight: 500,
        fontSize: '0.875rem',
        cursor: readState === 'locked' ? 'not-allowed' : 'pointer',
        userSelect: 'none',
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
        aspectRatio: '1',
        transform: pressed ? 'scale(0.94)' : 'scale(1)',
        transition: `transform var(--duration-fast) var(--easing-standard)`,
        padding: 0,
        overflow: 'hidden',
        minWidth: 0,
      }}
    >
      {/* Chapter number */}
      <span>{chapterNumber}</span>

      {/* Read check mark */}
      {readState === 'read' && (
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
          style={{ position: 'absolute', bottom: 4, right: 4 }}
        >
          <path
            d="M2.5 6l2.5 2.5 4.5-4.5"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}

      {/* Hover hint — fades in on desktop */}
      {readState !== 'locked' && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor:
              readState === 'read'
                ? 'rgba(0,0,0,0.35)'
                : 'rgba(77,97,79,0.08)',
            borderRadius: 'inherit',
            fontFamily: 'var(--font-headline)',
            fontSize: '0.5625rem',
            fontWeight: 500,
            color: readState === 'read' ? '#fff' : 'var(--color-text-secondary)',
            textTransform: 'lowercase',
            opacity: hovered ? 1 : 0,
            transition: `opacity var(--duration-base) var(--easing-standard)`,
            pointerEvents: 'none',
            padding: '0 var(--space-1)',
            textAlign: 'center',
            lineHeight: 1.2,
          }}
        >
          hold to select verses
        </span>
      )}
    </button>
  );
}
