'use client';
import { useState, useEffect } from 'react';

export function NetworkBanner() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        backgroundColor: 'var(--color-primary)',
        color: 'var(--color-on-primary)',
        textAlign: 'center',
        padding: 'var(--space-2) var(--space-4)',
        fontFamily: 'var(--font-headline)',
        fontSize: '0.8125rem',
        textTransform: 'lowercase',
      }}
    >
      you&apos;re offline — your reads are saved locally
    </div>
  );
}
