'use client';

/**
 * Button.tsx
 *
 * The only interactive button primitive in Lectio.
 * All colours reference CSS custom properties — no hardcoded hex values.
 *
 * Design rules:
 * - primary: gradient pill, white text
 * - ghost:   transparent fill, primary-coloured border + text
 * - text:    no background, no border — plain text tap target
 * - Scale to 0.94 on :active via CSS (no JS)
 * - Disabled: opacity 0.45, cursor not-allowed
 */
import { type CSSProperties, type ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'ghost' | 'text';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

const SIZE_STYLES: Record<ButtonSize, CSSProperties> = {
  sm: { padding: '0.5rem 1rem', fontSize: '0.875rem' },
  md: { padding: '0.75rem 1.5rem', fontSize: '1rem' },
  lg: { padding: '1rem 2rem', fontSize: '1.125rem' },
};

const VARIANT_STYLES: Record<ButtonVariant, CSSProperties> = {
  primary: {
    background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-container))',
    color: 'var(--color-on-primary, #ffffff)',
    borderRadius: 'var(--radius-full)',
    border: 'none',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--color-primary)',
    border: '1.5px solid var(--color-primary)',
    borderRadius: 'var(--radius-full)',
  },
  text: {
    background: 'transparent',
    color: 'var(--color-primary)',
    border: 'none',
    borderRadius: 'var(--radius-md)',
  },
};

// CSS injected once to handle :active scale and :disabled styles without JS
const BUTTON_CSS = `
  .lectio-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-headline);
    font-weight: 500;
    text-transform: lowercase;
    cursor: pointer;
    transition: opacity var(--duration-fast) var(--easing-standard),
                transform var(--duration-fast) var(--easing-standard);
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    text-decoration: none;
    white-space: nowrap;
  }
  .lectio-btn:active:not(:disabled) {
    transform: scale(0.94);
  }
  .lectio-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .lectio-btn:hover:not(:disabled) {
    opacity: 0.88;
  }
`;

let cssInjected = false;

function injectButtonCss() {
  if (cssInjected || typeof document === 'undefined') return;
  const style = document.createElement('style');
  style.textContent = BUTTON_CSS;
  document.head.appendChild(style);
  cssInjected = true;
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  className,
  style,
  children,
  onClick,
  type = 'button',
  ...rest
}: ButtonProps) {
  // Inject button CSS once on first render (client only)
  if (typeof window !== 'undefined') {
    injectButtonCss();
  }

  const combinedStyle: CSSProperties = {
    ...VARIANT_STYLES[variant],
    ...SIZE_STYLES[size],
    ...(fullWidth ? { width: '100%' } : {}),
    ...style,
  };

  return (
    <button
      type={type}
      disabled={disabled}
      className={`lectio-btn${className ? ` ${className}` : ''}`}
      style={combinedStyle}
      onClick={onClick}
      {...rest}
    >
      {children}
    </button>
  );
}
