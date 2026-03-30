/**
 * /settings — Settings page (Server Component shell)
 */
import type { Metadata } from 'next';
import { SettingsPageClient } from './SettingsPageClient';

export const metadata: Metadata = {
  title: 'settings · lectio',
  description: 'account and reading preferences',
};

export default function SettingsPage() {
  return <SettingsPageClient />;
}
