/**
 * tokens.ts — Design system token constants
 *
 * All colour, spacing, radius, font, animation, and shadow tokens.
 * buildCssTokenString() produces the CSS custom property declarations
 * to be injected into :root in the root layout.
 *
 * Rule: No hardcoded hex values anywhere in component files.
 * All styling must reference var(--token-name) from this registry.
 */

export const COLOR_TOKENS = {
  // Surface hierarchy
  bgPage: '#faf9f6',
  bgSurface: '#f4f3f0',
  bgElevated: '#ffffff',

  // Primary palette
  primary: '#4d614f',
  primaryContainer: '#657a67',
  primaryFixed: '#d2e8d1',
  onPrimary: '#ffffff',

  // Text
  textPrimary: '#1b1c1a',
  textSecondary: '#434842',
  textMuted: '#a8a29e',
  textInverse: '#ffffff',

  // Tertiary (cool accent)
  tertiary: '#4b5f6a',
  tertiaryFixed: '#d1e5f3',

  // State colours
  stateBorder: 'rgba(77,97,79,0.1)',
  statePartialFill: 'rgba(77,97,79,0.15)',

  // Ghost border (high-density fallback only)
  ghostBorder: 'rgba(195,200,192,0.2)',
} as const;

export const SPACE_TOKENS = {
  space1: '0.25rem',
  space2: '0.5rem',
  space3: '0.75rem',
  space4: '1rem',
  space5: '1.25rem',
  space6: '1.5rem',
  space8: '2rem',
  space10: '2.5rem',
  space12: '3rem',
  space16: '4rem',
} as const;

export const RADIUS_TOKENS = {
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  full: '9999px',
} as const;

export const FONT_TOKENS = {
  headline: 'Manrope, sans-serif',
  body: 'Inter, sans-serif',
} as const;

export const DURATION_TOKENS = {
  fast: '100ms',
  base: '200ms',
  slow: '300ms',
} as const;

export const EASING_TOKENS = {
  standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
} as const;

export const SHADOW_TOKENS = {
  floating: '0 8px 40px rgba(27,28,26,0.08)',
  continuePill: '0 8px 40px rgba(77,97,79,0.25)',
} as const;

/**
 * Converts the camelCase token key to a CSS custom property name.
 * e.g. "bgPage" → "--color-bg-page", "space4" → "--space-4"
 */
function toCssVarName(prefix: string, key: string): string {
  const kebab = key.replace(/([A-Z])/g, (match) => `-${match.toLowerCase()}`);
  return `--${prefix}-${kebab}`;
}

/**
 * buildCssTokenString()
 *
 * Returns a string of CSS custom property declarations suitable for injection
 * into a <style> tag on :root in the root layout.
 *
 * Output example:
 *   --color-bg-page: #faf9f6; --color-bg-surface: #f4f3f0; ...
 */
export function buildCssTokenString(): string {
  const declarations: string[] = [];

  for (const [key, value] of Object.entries(COLOR_TOKENS)) {
    declarations.push(`${toCssVarName('color', key)}: ${value}`);
  }

  for (const [key, value] of Object.entries(SPACE_TOKENS)) {
    // "space4" → "--space-4" (strip the "space" prefix in the var name)
    const num = key.replace('space', '');
    declarations.push(`--space-${num}: ${value}`);
  }

  for (const [key, value] of Object.entries(RADIUS_TOKENS)) {
    declarations.push(`--radius-${key}: ${value}`);
  }

  for (const [key, value] of Object.entries(FONT_TOKENS)) {
    declarations.push(`--font-${key}: ${value}`);
  }

  for (const [key, value] of Object.entries(DURATION_TOKENS)) {
    declarations.push(`--duration-${key}: ${value}`);
  }

  for (const [key, value] of Object.entries(EASING_TOKENS)) {
    declarations.push(`--easing-${key}: ${value}`);
  }

  for (const [key, value] of Object.entries(SHADOW_TOKENS)) {
    const kebab = key.replace(/([A-Z])/g, (m) => `-${m.toLowerCase()}`);
    declarations.push(`--shadow-${kebab}: ${value}`);
  }

  return declarations.join('; ');
}
