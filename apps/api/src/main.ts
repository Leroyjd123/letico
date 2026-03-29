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
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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
    ],
  });

  const port = parseInt(process.env['PORT'] ?? '4000', 10);
  await app.listen(port);
  console.log(`Lectio API listening on http://localhost:${port}/api`);
}

bootstrap();
