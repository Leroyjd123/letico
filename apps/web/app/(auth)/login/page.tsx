/**
 * /login — Sign-in page (Server Component shell)
 *
 * Two-step OTP flow:
 *   Step 1: Enter email → POST /api/auth/otp/send
 *   Step 2: Enter 6-digit code → POST /api/auth/otp/verify → set session → migrate guest → /read
 */
import type { Metadata } from 'next';
import { LoginPageClient } from './LoginPageClient';

export const metadata: Metadata = {
  title: 'sign in · lectio',
  description: 'sign in to keep your reading across devices',
};

export default function LoginPage() {
  return <LoginPageClient />;
}
