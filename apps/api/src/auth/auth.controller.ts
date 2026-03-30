/**
 * auth.controller.ts — routing only.
 *
 * Phase 2: guest creation endpoint.
 * Phase 3: GET /auth/me — returns userId + planId for plan navigation.
 * Phase 5: OTP send/verify, guest migration.
 */
import { Controller, Post, Get, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
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
   */
  @Get('me')
  @UseGuards(AuthGuard)
  async getMe(@CurrentUser() user: { id: string }) {
    const data = await this.authService.getMe(user.id);
    return { data };
  }

  /**
   * POST /api/auth/otp/send
   * Validates the email and triggers a Supabase OTP email.
   * Returns { sent: true } on success.
   */
  @Post('otp/send')
  @HttpCode(HttpStatus.OK)
  async sendOtp(@Body() body: { email: string }) {
    const data = await this.authService.sendOtp(body.email ?? '');
    return { data };
  }

  /**
   * POST /api/auth/otp/verify
   * Verifies the 6-digit OTP for the given email.
   * Returns { accessToken, refreshToken, user } on success.
   */
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Body() body: { email: string; token: string }) {
    const data = await this.authService.verifyOtp(body.email ?? '', body.token ?? '');
    return { data };
  }

  /**
   * POST /api/auth/migrate
   * Transfers guest verse_reads to the authenticated user then archives the guest.
   * Requires auth (Bearer JWT from verifyOtp).
   */
  @Post('migrate')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  async migrateGuest(
    @Body() body: { guestToken: string },
    @CurrentUser() user: { id: string },
  ) {
    const data = await this.authService.migrateGuest(user.id, body.guestToken ?? '');
    return { data };
  }
}
