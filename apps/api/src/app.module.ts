import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { SupabaseModule } from './supabase/supabase.module';
import { BibleModule } from './bible/bible.module';
import { AuthModule } from './auth/auth.module';
import { PlanModule } from './plan/plan.module';
import { ProgressModule } from './progress/progress.module';

@Module({
  imports: [
    CacheModule.register({
      isGlobal: true,
      ttl: 86400 * 1000,
    }),
    SupabaseModule,
    BibleModule,
    AuthModule,
    PlanModule,
    ProgressModule,
  ],
})
export class AppModule {}
