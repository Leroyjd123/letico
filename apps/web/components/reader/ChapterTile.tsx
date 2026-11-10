'use client';
/**
 * ChapterTile.tsx
 *
 * Tap / click / Enter / Space: toggles the chapter (unread or partial → read,
 * read → unread, so a mistaken tap is undone by tapping again).
 * Long-press (600ms): opens the verse selector modal.
 * Alt+Enter (keyboard): opens the verse selector.
 *
 * The tap is a real `click` handler so keyboard users can activate it —
 * pointer events alone never fire for Enter/Space. Pointer events are only
 * used to detect the long press, which then suppresses the following click.
 * touch-action: manipulation prevents double-tap-to-zoom interference.
 * user-select: none prevents text selection on long-press (edge case E11).
 *
 * Active visual feedback: scale(0.94) on pointer down.
 * Hover hint "hold to select verses" fades in on hover (desktop UX).
 */
import { useState, useRef, type CSSProperties, type PointerEvent, type KeyboardEvent } from 'react';

export type ReadState = 'read' | 'partial' | 'unread';

interface ChapterTileProps {
  chapterNumber: number;
  /** Accessible name, e.g. "matthew 1" (defaults to "chapter N") */
  label?: string;
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
    backgroundImage: 'linear-gradient(to top, var(--chapter-partial-fill) 50%, transparent 50%)',
  },
  unread: {
    backgroundColor: 'var(--color-bg-elevated)',
    color: 'var(--color-text-secondary)',
    border: '1px solid var(--chapter-unread-border)',
  },
};

export function ChapterTile({
  chapterNumber,
  label,
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
    if (e.button !== 0) return;
    didLongPress.current = false;
    setPressed(true);

    timerRef.current = setTimeout(() => {
      didLongPress.current = true;
      setPressed(false);
      onLongPress();
    }, LONG_PRESS_MS);
  }

  function handlePointerUp() {
    clearTimer();
    setPressed(false);
  }

  function handlePointerCancel() {
    // Fires when the user scrolls the page from a tile: never a tap.
    clearTimer();
    setPressed(false);
  }

  function handleClick() {
    if (didLongPress.current) {
      didLongPress.current = false; // the long press already handled it
      return;
    }
    onTap();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.altKey && e.key === 'Enter') {
      e.preventDefault();
      onLongPress();
    }
  }

  const stateStyle = STATE_STYLES[readState];
  const readLabel =
    readState === 'read' ? 'read' : readState === 'partial' ? 'partially read' : 'unread';
  const actionHint = readState === 'read' ? 'tap to mark unread' : 'tap to mark read';

  return (
    <button
      type="button"
      aria-label={`${label ?? `chapter ${chapterNumber}`}, ${readLabel}. ${actionHint}; hold or alt+enter to choose verses`}
      aria-pressed={readState === 'read'}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={handleKeyDown}
      // Hint only for real mouse hover: touch devices emulate mouseenter on
      // tap and the hint would then stick over the chapter number.
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') setHovered(true); }}
      onPointerLeave={() => { setHovered(false); handlePointerCancel(); }}
      style={{
        ...stateStyle,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 'var(--radius-lg)',
        fontFamily: 'var(--font-headline)',
        fontWeight: 500,
        fontSize: '0.875rem',
        cursor: 'pointer',
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
                ? 'var(--read-hover-overlay)'
                : 'var(--chapter-hover-overlay)',
            borderRadius: 'inherit',
            fontFamily: 'var(--font-headline)',
            fontSize: '0.5625rem',
            fontWeight: 500,
            color: readState === 'read' ? 'var(--color-on-primary)' : 'var(--color-text-secondary)',
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

    </button>
  );
}
