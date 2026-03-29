/**
 * /read page — Phase 1 placeholder
 *
 * Phase 1: Design system smoke-test swatches to verify tokens are working.
 * Phase 2: Replaced with the real reading home screen.
 */
export default function ReadPage() {
  return (
    <main
      style={{
        maxWidth: '48rem',
        margin: '0 auto',
        padding: '0 var(--space-6)',
        paddingTop: 'var(--space-8)',
      }}
    >
      <h1
        style={{
          fontFamily: 'var(--font-headline)',
          fontSize: '2rem',
          fontWeight: 600,
          textTransform: 'lowercase',
          color: 'var(--color-text-primary)',
          marginBottom: 'var(--space-8)',
        }}
      >
        lectio
      </h1>

      {/* Token smoke-test swatches */}
      <section style={{ marginBottom: 'var(--space-8)' }}>
        <p
          style={{
            fontFamily: 'var(--font-headline)',
            fontSize: '0.875rem',
            fontWeight: 500,
            color: 'var(--color-text-secondary)',
            textTransform: 'lowercase',
            marginBottom: 'var(--space-4)',
          }}
        >
          design system tokens
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          {[
            { name: 'bg-page', token: 'var(--color-bg-page)' },
            { name: 'bg-surface', token: 'var(--color-bg-surface)' },
            { name: 'bg-elevated', token: 'var(--color-bg-elevated)' },
            { name: 'primary', token: 'var(--color-primary)' },
            { name: 'primary-container', token: 'var(--color-primary-container)' },
            { name: 'primary-fixed', token: 'var(--color-primary-fixed)' },
          ].map((swatch) => (
            <div key={swatch.name} style={{ textAlign: 'center' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: swatch.token,
                  border: '0.5px solid rgba(195,200,192,0.2)',
                  marginBottom: 'var(--space-1)',
                }}
              />
              <span
                style={{
                  fontFamily: 'var(--font-headline)',
                  fontSize: '0.625rem',
                  color: 'var(--color-text-muted)',
                }}
              >
                {swatch.name}
              </span>
            </div>
          ))}
        </div>
      </section>

      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '1rem',
          color: 'var(--color-text-muted)',
        }}
      >
        phase 1 — foundation complete. reading screen coming in phase 2.
      </p>
    </main>
  );
}
