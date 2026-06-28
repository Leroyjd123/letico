'use client';
/**
 * TodayCard.tsx
 *
 * Shows the day label, progress bar, and mark-day-complete button.
 * On completion: button → check icon + "day N complete" text.
 * Transition is opacity 200ms only — no bounce, no spring.
 * All colours via CSS custom properties.
 */
import { type CSSProperties } from 'react';
import { ProgressBar } from '../ui/ProgressBar';
import { Button } from '../ui/Button';

interface TodayCardProps {
  dayNumber: number;
  label: string;
  completionPct: number;
  isComplete: boolean;
  onMarkDayComplete: () => void;
}

export function TodayCard({
  dayNumber,
  label,
  completionPct,
  isComplete,
  onMarkDayComplete,
}: TodayCardProps) {
  const cardStyle: CSSProperties = {
    backgroundColor: 'var(--color-bg-surface)',
    borderRadius: 'var(--radius-xl)',
    padding: 'var(--space-6)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-5)',
    boxShadow: 'var(--shadow-card)',
  };

  return (
    <div style={cardStyle} role="region" aria-label={`day ${dayNumber} reading card`}>
      {/* Header row: calendar icon + day info */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-4)' }}>
        {/* Calendar icon */}
        <div
          style={{
            width: '2.75rem',
            height: '2.75rem',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--color-primary-fixed)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
          aria-hidden="true"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect x="2" y="4" width="16" height="14" rx="2" stroke="var(--color-primary)" strokeWidth="1.5" fill="none"/>
            <line x1="2" y1="8" x2="18" y2="8" stroke="var(--color-primary)" strokeWidth="1.25"/>
            <line x1="6" y1="2" x2="6" y2="6" stroke="var(--color-primary)" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="14" y1="2" x2="14" y2="6" stroke="var(--color-primary)" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>

        {/* Day label */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontFamily: 'var(--font-headline)',
              fontSize: '0.6875rem',
              fontWeight: 500,
              color: 'var(--color-primary)',
              textTransform: 'uppercase',
              letterSpacing: '0.14em',
              marginBottom: 'var(--space-1)',
            }}
          >
            today&apos;s focus
          </p>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '0.75rem',
              color: 'var(--color-text-muted)',
              textTransform: 'lowercase',
              letterSpacing: '0.04em',
              marginBottom: 'var(--space-1)',
            }}
          >
            day {dayNumber}
          </p>
          <h2
            style={{
              fontFamily: 'var(--font-headline)',
              fontSize: '1.25rem',
              fontWeight: 500,
              color: 'var(--color-text-primary)',
              textTransform: 'lowercase',
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            {label}
          </h2>
        </div>
      </div>

      {/* Progress bar */}
      <ProgressBar
        value={completionPct}
        label={`${Math.round(completionPct)}% complete`}
        height={8}
      />

      {/* Action area — transitions between incomplete and complete states */}
      <div
        style={{
          transition: `opacity var(--duration-base) var(--easing-standard)`,
        }}
      >
        {isComplete ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              color: 'var(--color-success)',
              fontFamily: 'var(--font-headline)',
              fontSize: '0.9375rem',
              fontWeight: 500,
              textTransform: 'lowercase',
            }}
            aria-live="polite"
          >
            {/* Check icon SVG */}
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden="true"
            >
              <circle cx="10" cy="10" r="10" fill="var(--color-success)" />
              <path
                d="M6 10l3 3 5-5"
                stroke="white"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            day {dayNumber} complete
          </div>
        ) : (
          <Button
            variant="primary"
            size="md"
            onClick={onMarkDayComplete}
            fullWidth
          >
            mark day {dayNumber} complete
          </Button>
        )}
      </div>
    </div>
  );
}
