'use client';

/**
 * BottomNav.tsx — persistent bottom navigation bar.
 *
 * Uses next/link for client-side navigation: plain <a> tags reloaded the
 * whole app on every tab change, throwing away the query cache and auth state.
 * Respects the iPhone home-indicator safe area. Hidden on /login.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
  icon: string; // Unicode symbol — avoids an icon library dependency
}

const NAV_ITEMS: NavItem[] = [
  { href: '/read', label: 'read', icon: '◎' },
  { href: '/plan', label: 'plan', icon: '≡' },
  { href: '/analytics', label: 'journey', icon: '⊠' },
  { href: '/settings', label: 'settings', icon: '⊙' },
];

const HIDDEN_ON = ['/login'];

export function BottomNav() {
  const pathname = usePathname() ?? '';
  if (HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;

  return (
    <nav
      aria-label="main navigation"
      className="glass-nav"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 'calc(var(--nav-height) + env(safe-area-inset-bottom, 0px))',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        display: 'flex',
        alignItems: 'stretch',
        boxShadow: 'var(--shadow-floating)',
        zIndex: 50,
      }}
    >
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.125rem',
              textDecoration: 'none',
              color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
              transition: 'color 120ms ease',
              position: 'relative',
              paddingBottom: '0.25rem',
            }}
          >
            <span aria-hidden="true" style={{ fontSize: '1.25rem', lineHeight: 1 }}>
              {item.icon}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-headline)',
                fontSize: '0.6875rem',
                textTransform: 'lowercase',
                fontWeight: isActive ? 600 : 400,
              }}
            >
              {item.label}
            </span>
            {isActive && (
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  bottom: '0.25rem',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '3px',
                  height: '3px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--color-primary)',
                }}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
