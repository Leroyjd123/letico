/**
 * OpenInJWButton.tsx
 *
 * Opens the current chapter on jw.org in a new tab.
 * Uses a native anchor — screen readers correctly identify it as a link.
 * Never a <button>: correct browser open-in-new-tab behaviour is preserved.
 */
import type { CSSProperties } from 'react';
import { buildJwLink } from '../../lib/jwLink';

interface OpenInJWButtonProps {
  /** USFM book code, e.g. "GEN" */
  book: string;
  chapter: number;
  label: string;
}

export function OpenInJWButton({ book, chapter, label }: OpenInJWButtonProps) {
  let href = '#';
  try {
    href = buildJwLink(book, chapter);
  } catch {
    // Unknown USFM code — link stays as '#'
  }

  const linkStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    padding: 'var(--space-2) var(--space-4)',
    fontFamily: 'var(--font-headline)',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: 'var(--color-primary)',
    textDecoration: 'none',
    textTransform: 'lowercase',
    borderRadius: 'var(--radius-full)',
    border: '1.5px solid var(--color-primary)',
    transition: 'opacity var(--duration-fast) var(--easing-standard)',
    userSelect: 'none',
    WebkitTapHighlightColor: 'transparent',
  };

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={linkStyle}
      aria-label={`open ${label} in jw.org (opens in new tab)`}
    >
      {/* External link icon */}
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path
          d="M6 2H2a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V8"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
        />
        <path
          d="M9 1h4v4M13 1L7.5 6.5"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      open in jw.org
    </a>
  );
}
