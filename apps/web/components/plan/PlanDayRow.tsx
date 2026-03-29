'use client';
/**
 * PlanDayRow.tsx
 *
 * A single row in the 365-day plan list.
 * All days are freely tappable — no locked, disabled, or dimmed states.
 * This follows R2 (no forced reading order): users read ahead or backfill freely.
 *
 * Layout: day number (small, muted) | passage label | thin progress bar | chevron
 * Today's row: var(--color-bg-elevated) background with subtle shadow.
 * Min touch target: 44px height.
 */
import type { CSSProperties } from 'react';
import { ProgressBar } from '../ui/ProgressBar';

interface PlanDayRowProps {
  dayNumber: number;
  label: string;
  completionPct: number;
  isToday: boolean;
  offsetFromToday: number;
  onClick: () => void;
}

export function PlanDayRow({
  dayNumber,
  label,
  completionPct,
  isToday,
  onClick,
}: PlanDayRowProps) {
  const containerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-4)',
    padding: 'var(--space-4) var(--space-5)',
    minHeight: '44px',
    cursor: 'pointer',
    backgroundColor: isToday ? 'var(--color-bg-elevated)' : 'transparent',
    boxShadow: isToday ? 'var(--shadow-card)' : 'none',
    borderRadius: isToday ? 'var(--radius-lg)' : '0',
    transition: 'background-color var(--duration-fast) var(--easing-standard)',
    userSelect: 'none',
    WebkitTapHighlightColor: 'transparent',
    border: 'none',
    width: '100%',
    textAlign: 'left',
  };

  const completionRounded = Math.round(completionPct);

  return (
    <button
      style={containerStyle}
      onClick={onClick}
      aria-label={`day ${dayNumber}, ${label}, ${completionRounded}% complete${isToday ? ', today' : ''}`}
    >
      {/* Day number column */}
      <span
        style={{
          fontFamily: 'var(--font-headline)',
          fontSize: '0.75rem',
          fontWeight: 500,
          color: isToday ? 'var(--color-primary)' : 'var(--color-text-muted)',
          minWidth: '2.5rem',
          textTransform: 'lowercase',
          letterSpacing: '0.02em',
          flexShrink: 0,
        }}
      >
        {isToday ? 'today' : `d${dayNumber}`}
      </span>

      {/* Label + progress bar */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
        <span
          style={{
            fontFamily: 'var(--font-headline)',
            fontSize: '0.9375rem',
            fontWeight: isToday ? 600 : 400,
            color: 'var(--color-text-primary)',
            textTransform: 'lowercase',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </span>
        {completionPct > 0 && (
          <ProgressBar
            value={completionPct}
            label={`${completionRounded}% complete`}
            height={3}
          />
        )}
      </div>

      {/* Completion % or chevron */}
      <span
        style={{
          fontFamily: 'var(--font-headline)',
          fontSize: '0.75rem',
          color: completionPct >= 100
            ? 'var(--color-success)'
            : completionPct > 0
            ? 'var(--color-text-secondary)'
            : 'var(--color-text-muted)',
          flexShrink: 0,
          minWidth: '2rem',
          textAlign: 'right',
        }}
        aria-hidden="true"
      >
        {completionPct >= 100 ? '✓' : completionPct > 0 ? `${completionRounded}%` : '›'}
      </span>
    </button>
  );
}
