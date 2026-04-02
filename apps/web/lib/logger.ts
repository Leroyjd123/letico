/**
 * logger.ts — togglable action logger
 *
 * Enabled in development by default.
 * Toggle at runtime via browser console:
 *   localStorage.setItem('lectio_debug', 'true')   // force on
 *   localStorage.setItem('lectio_debug', 'false')  // force off
 *   localStorage.removeItem('lectio_debug')         // back to default (on in dev)
 *
 * Disable for a session: logger.disable()
 * Re-enable:             logger.enable()
 */

const isDev = process.env.NODE_ENV === 'development';

function isEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const stored = localStorage.getItem('lectio_debug');
  if (stored !== null) return stored === 'true';
  return isDev;
}

/* eslint-disable no-console */
export const logger = {
  action(name: string, data?: unknown): void {
    if (!isEnabled()) return;
    if (data !== undefined) {
      console.log('%c[action] ' + name, 'color:#4d614f;font-weight:600', data);
    } else {
      console.log('%c[action] ' + name, 'color:#4d614f;font-weight:600');
    }
  },

  query(name: string, data?: unknown): void {
    if (!isEnabled()) return;
    if (data !== undefined) {
      console.log('%c[query]  ' + name, 'color:#4b5f6a', data);
    } else {
      console.log('%c[query]  ' + name, 'color:#4b5f6a');
    }
  },

  error(name: string, err?: unknown): void {
    if (!isEnabled()) return;
    console.error('%c[error]  ' + name, 'color:#b00020;font-weight:600', err ?? '');
  },

  info(name: string, data?: unknown): void {
    if (!isEnabled()) return;
    if (data !== undefined) {
      console.log('%c[info]   ' + name, 'color:#a8a29e', data);
    } else {
      console.log('%c[info]   ' + name, 'color:#a8a29e');
    }
  },

  enable(): void {
    if (typeof window !== 'undefined') localStorage.setItem('lectio_debug', 'true');
  },

  disable(): void {
    if (typeof window !== 'undefined') localStorage.setItem('lectio_debug', 'false');
  },
};
/* eslint-enable no-console */
