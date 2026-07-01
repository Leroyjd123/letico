import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div
      style={{
        padding: 'var(--space-10) var(--space-6)',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--space-3)',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--font-headline)',
          fontSize: '0.9375rem',
          color: 'var(--color-text-primary)',
          textTransform: 'lowercase',
          fontWeight: 500,
          margin: 0,
        }}
      >
        {title}
      </p>
      {description && (
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '0.875rem',
            color: 'var(--color-text-muted)',
            textTransform: 'lowercase',
            margin: 0,
          }}
        >
          {description}
        </p>
      )}
      {action && <div style={{ marginTop: 'var(--space-2)' }}>{action}</div>}
    </div>
  );
}
