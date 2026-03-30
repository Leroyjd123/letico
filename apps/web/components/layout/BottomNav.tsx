'use client';
/**
 * BottomNav.tsx — persistent bottom navigation bar.
 *
 * Three destinations: read · plan · settings
 * Active item is highlighted using CSS custom properties only (no hardcoded hex).
 * Hidden on /login to keep the sign-in screen uncluttered.
 */
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
  icon: string; // Unicode symbol — avoids an icon library dependency
}

const NAV_ITEMS: NavItem[] = [
  { href: '/read', label: 'read', icon: '◎' },
  { href: '/plan', label: 'plan', icon: '≡' },
  { href: '/settings', label: 'settings', icon: '⊙' },
];

const HIDDEN_ON = ['/login'];

export function BottomNav() {
  const pathname = usePathname();

  if (HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;

  return (
    <nav
      aria-label="main navigation"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '3.5rem',
        display: 'flex',
        alignItems: 'stretch',
        backgroundColor: 'var(--color-bg-page)',
        borderTop: '1px solid var(--color-outline)',
        zIndex: 50,
      }}
    >
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href || (item.href !== '/read' && pathname.startsWith(item.href));

        return (
          <a
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
            }}
          >
            <span style={{ fontSize: '1.125rem', lineHeight: 1 }}>{item.icon}</span>
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
          </a>
        );
      })}
    </nav>
  );
}
