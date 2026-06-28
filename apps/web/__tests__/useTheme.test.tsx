'use client';

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useTheme } from '../hooks/useTheme';

function ThemeHarness() {
  const { theme, setTheme } = useTheme();

  return (
    <div>
      <span data-testid="theme-value">{theme}</span>
      <button onClick={() => setTheme('dark')}>dark</button>
      <button onClick={() => setTheme('light')}>light</button>
    </div>
  );
}

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('hydrates the saved theme onto documentElement', async () => {
    localStorage.setItem('lectio_theme', 'dark');

    render(<ThemeHarness />);

    await waitFor(() => {
      expect(screen.getByTestId('theme-value')).toHaveTextContent('dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });
  });

  it('removes the data-theme attribute when switching back to light', async () => {
    localStorage.setItem('lectio_theme', 'dark');

    render(<ThemeHarness />);

    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    fireEvent.click(screen.getByRole('button', { name: 'light' }));

    await waitFor(() => {
      expect(screen.getByTestId('theme-value')).toHaveTextContent('light');
      expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    });
  });
});
