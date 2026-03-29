/**
 * Text.tsx
 *
 * The only way to render text in Lectio. Enforces the type scale, font tokens,
 * and the lowercase-by-default philosophy. Never exceeds font-weight 500 in
 * UI chrome (the design system explicitly forbids 700/800).
 */
import type { CSSProperties } from 'react';

type TextVariant = 'display' | 'heading' | 'subheading' | 'body' | 'verse' | 'label' | 'caption';
type TextColor = 'primary' | 'secondary' | 'muted' | 'inverse';

interface TextProps {
  variant?: TextVariant;
  color?: TextColor;
  as?: keyof JSX.IntrinsicElements;
  lowercase?: boolean;
  className?: string;
  style?: CSSProperties;
  children: React.ReactNode;
}

/** Maps each variant to the correct type scale values using CSS tokens */
const VARIANT_STYLES: Record<TextVariant, CSSProperties> = {
  display: {
    fontFamily: 'var(--font-headline)',
    fontSize: '2rem',
    fontWeight: 600,
    lineHeight: 1.25,
  },
  heading: {
    fontFamily: 'var(--font-headline)',
    fontSize: '1.5rem',
    fontWeight: 600,
    lineHeight: 1.25,
  },
  subheading: {
    fontFamily: 'var(--font-headline)',
    fontSize: '1.25rem',
    fontWeight: 500,
    lineHeight: 1.25,
  },
  body: {
    fontFamily: 'var(--font-body)',
    fontSize: '1rem',
    fontWeight: 400,
    lineHeight: 1.5,
  },
  verse: {
    fontFamily: 'var(--font-body)',
    fontSize: '1.125rem',
    fontWeight: 400,
    lineHeight: 1.75,
  },
  label: {
    fontFamily: 'var(--font-headline)',
    fontSize: '0.875rem',
    fontWeight: 500,
    lineHeight: 1.25,
  },
  caption: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.75rem',
    fontWeight: 400,
    lineHeight: 1.5,
  },
};

/** Default semantic HTML element per variant */
const VARIANT_ELEMENT: Record<TextVariant, keyof JSX.IntrinsicElements> = {
  display: 'h1',
  heading: 'h2',
  subheading: 'h3',
  body: 'p',
  verse: 'p',
  label: 'span',
  caption: 'span',
};

const COLOR_STYLES: Record<TextColor, CSSProperties> = {
  primary: { color: 'var(--color-text-primary)' },
  secondary: { color: 'var(--color-text-secondary)' },
  muted: { color: 'var(--color-text-muted)' },
  inverse: { color: 'var(--color-text-inverse)' },
};

/**
 * Text — the universal text primitive.
 *
 * Enforces the Lectio type scale. Use `lowercase={false}` only for proper
 * nouns or verse text (Bible references are never transformed).
 */
export function Text({
  variant = 'body',
  color = 'primary',
  as,
  lowercase = true,
  className,
  style,
  children,
}: TextProps) {
  const Tag = (as ?? VARIANT_ELEMENT[variant]) as keyof JSX.IntrinsicElements;

  const combinedStyle: CSSProperties = {
    ...VARIANT_STYLES[variant],
    ...COLOR_STYLES[color],
    ...(lowercase ? { textTransform: 'lowercase' } : {}),
    ...style,
  };

  return (
    <Tag className={className} style={combinedStyle}>
      {children}
    </Tag>
  );
}
