import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { SupabaseModule } from './supabase/supabase.module';
import { BibleModule } from './bible/bible.module';
import { AuthModule } from './auth/auth.module';
import { PlanModule } from './plan/plan.module';
import { ProgressModule } from './progress/progress.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 20,
      },
    ]),
    CacheModule.register({
      isGlobal: true,
      ttl: 86400 * 1000,
    }),
    SupabaseModule,
    BibleModule,
    AuthModule,
    PlanModule,
    ProgressModule,
    UsersModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
