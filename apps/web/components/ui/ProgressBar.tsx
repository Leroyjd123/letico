/**
 * ProgressBar.tsx
 *
 * Accessible linear progress bar using CSS custom properties.
 * Smooth transition on value change: 200ms standard easing.
 * Can be a Server Component (no state, no interactivity).
 */
import type { CSSProperties } from 'react';

interface ProgressBarProps {
  /** 0–100 */
  value: number;
  label?: string;
  height?: number | string;
  className?: string;
  style?: CSSProperties;
}

export function ProgressBar({
  value,
  label,
  height = 6,
  className,
  style,
}: ProgressBarProps) {
  // Clamp value to valid range
  const clamped = Math.min(100, Math.max(0, value));
  const heightValue = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={className}
      style={{
        width: '100%',
        height: heightValue,
        backgroundColor: 'var(--color-bg-surface)',
        borderRadius: 'var(--radius-full)',
        overflow: 'hidden',
        ...style,
      }}
    >
      <div
        style={{
          width: `${clamped}%`,
          height: '100%',
          backgroundColor: 'var(--color-primary)',
          borderRadius: 'var(--radius-full)',
          transition: `width var(--duration-base) var(--easing-standard)`,
        }}
      />
    </div>
  );
}
