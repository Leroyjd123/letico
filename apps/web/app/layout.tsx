/**
 * layout.tsx — Root layout (Server Component)
 *
 * Responsibilities:
 * - Load Manrope and Inter via next/font/google (avoids FOUT)
 * - Inject CSS custom property tokens into :root via buildCssTokenString()
 * - Apply font variables to <body>
 * - Wrap children in QueryProvider for React Query
 */
import type { Metadata } from 'next';
import { Manrope, Inter } from 'next/font/google';
import { buildCssTokenString } from '@lectio/types/tokens';
import { QueryProvider } from '../components/providers/QueryProvider';
import './globals.css';

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-headline',
  display: 'swap',
  weight: ['200', '300', '400', '500', '600'],
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
  weight: ['300', '400', '500'],
});

export const metadata: Metadata = {
  title: 'lectio',
  description: 'a quiet place to track your reading',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cssTokens = buildCssTokenString();

  return (
    <html lang="en" className={`${manrope.variable} ${inter.variable}`}>
      <head>
        {/* Inject all design tokens as CSS custom properties on :root */}
        <style
          dangerouslySetInnerHTML={{
            __html: `:root { ${cssTokens} }`,
          }}
        />
      </head>
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
