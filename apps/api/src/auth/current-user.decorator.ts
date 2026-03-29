/**
 * @CurrentUser() param decorator
 *
 * Extracts request.user (set by AuthGuard) from the execution context.
 * Use in controller methods: @CurrentUser() user: { id: string }
 */
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): { id: string } => {
    const request = ctx.switchToHttp().getRequest<Request & { user: { id: string } }>();
    return request.user;
  },
);
