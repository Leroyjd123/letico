import { Inject } from '@nestjs/common';
import { SupabaseProvider } from './supabase.provider';

/**
 * @InjectSupabase() — inject the SupabaseProvider into a service.
 *
 * Usage:
 *   constructor(@InjectSupabase() private readonly supabase: SupabaseProvider) {}
 */
export const InjectSupabase = () => Inject(SupabaseProvider);
