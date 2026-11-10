/**
 * main.ts — NestJS bootstrap
 *
 * IMPORTANT: reflect-metadata must be imported before any NestJS module.
 * Missing this causes cryptic "Cannot read property of undefined" DI errors.
 */
import 'reflect-metadata';

// Load .env from monorepo root before any provider reads process.env
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Behind a reverse proxy / load balancer, rate limiting must key on the real
  // client IP. Set TRUST_PROXY to the number of proxy hops (e.g. 1).
  const trustProxy = parseInt(process.env['TRUST_PROXY'] ?? '0', 10);
  if (trustProxy > 0) app.set('trust proxy', trustProxy);

  // All routes prefixed with /api
  app.setGlobalPrefix('api');

  // Validate all incoming DTOs using class-validator decorators
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS — allow the frontend origin to call the API
  const frontendUrl = process.env['FRONTEND_URL'] ?? 'http://localhost:3000';
  app.enableCors({
    origin: frontendUrl.split(',').map((u) => u.trim()),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Guest-Token',
      'X-Timezone',
    ],
  });

  const port = parseInt(process.env['PORT'] ?? '4000', 10);
  await app.listen(port);
  console.log(`Lectio API listening on http://localhost:${port}/api`);
}

bootstrap();
