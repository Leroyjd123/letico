/**
 * auth.controller.ts — routing only.
 *
 * Phase 2: guest creation endpoint.
 * Phase 5: OTP send/verify, session refresh, guest migration.
 */
import { Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';

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
}
