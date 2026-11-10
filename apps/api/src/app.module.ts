import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { SupabaseModule } from './supabase/supabase.module';
import { BibleModule } from './bible/bible.module';
import { AuthModule } from './auth/auth.module';
import { PlanModule } from './plan/plan.module';
import { ProgressModule } from './progress/progress.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    CacheModule.register({
      isGlobal: true,
      ttl: 86400 * 1000,
    }),
    // Global rate limit per client IP; auth endpoints set tighter limits.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 300 }]),
    SupabaseModule,
    BibleModule,
    AuthModule,
    PlanModule,
    ProgressModule,
    UsersModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
