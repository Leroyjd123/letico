import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { SupabaseModule } from './supabase/supabase.module';
import { BibleModule } from './bible/bible.module';

@Module({
  imports: [
    // Default cache TTL: 24 hours (in ms). Individual routes can override.
    CacheModule.register({
      isGlobal: true,
      ttl: 86400 * 1000,
    }),
    SupabaseModule,
    BibleModule,
    // Phase 2: PlanModule, ProgressModule, AuthModule
  ],
})
export class AppModule {}
