'use client';

interface RetryButtonProps {
  onRetry: () => void;
  isRetrying?: boolean;
  label?: string;
}

export function RetryButton({
  onRetry,
  isRetrying = false,
  label = 'try again',
}: RetryButtonProps) {
  return (
    <button
      onClick={onRetry}
      disabled={isRetrying}
      style={{
        fontFamily: 'var(--font-headline)',
        fontSize: '0.875rem',
        color: 'var(--color-primary)',
        textTransform: 'lowercase',
        background: 'none',
        border: 'none',
        cursor: isRetrying ? 'wait' : 'pointer',
        padding: 'var(--space-2) var(--space-4)',
        opacity: isRetrying ? 0.6 : 1,
      }}
      aria-label={isRetrying ? 'retrying…' : label}
    >
      {isRetrying ? 'retrying…' : label}
    </button>
  );
}
