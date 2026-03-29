/**
 * auth.controller.ts — routing only.
 *
 * Phase 2: guest creation endpoint.
 * Phase 3: GET /auth/me — returns userId + planId for plan navigation.
 * Phase 5: OTP send/verify, session refresh, guest migration.
 */
import { Controller, Post, Get, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { CurrentUser } from './current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /api/auth/guest
   * Creates a new anonymous guest session.
   * Returns guestToken — the client MUST persist this in localStorage.
   */
  @Post('guest')
  @HttpCode(HttpStatus.CREATED)
  async createGuest() {
    const data = await this.authService.createGuest();
    return { data };
  }

  /**
   * GET /api/auth/me
   * Returns the current user's id and planId.
   * Used by the plan view to resolve which plan to load.
   */
  @Get('me')
  @UseGuards(AuthGuard)
  async getMe(@CurrentUser() user: { id: string }) {
    const data = await this.authService.getMe(user.id);
    return { data };
  }
}
