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
    gap: 'var(--space-4)',
    boxShadow: 'var(--shadow-card)',
  };

  return (
    <div style={cardStyle} role="region" aria-label={`day ${dayNumber} reading card`}>
      {/* Day label */}
      <div>
        <p
          style={{
            fontFamily: 'var(--font-headline)',
            fontSize: '0.75rem',
            fontWeight: 500,
            color: 'var(--color-text-muted)',
            textTransform: 'lowercase',
            letterSpacing: '0.05em',
            marginBottom: 'var(--space-1)',
          }}
        >
          day {dayNumber}
        </p>
        <h2
          style={{
            fontFamily: 'var(--font-headline)',
            fontSize: '1.25rem',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            textTransform: 'lowercase',
            margin: 0,
          }}
        >
          {label}
        </h2>
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
