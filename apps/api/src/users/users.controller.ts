/**
 * users.controller.ts — routing only, zero business logic.
 */
import {
  Controller,
  Patch,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { UsersService } from './users.service';
import { UpdateUserDto } from './users.types';

@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /** PATCH /api/users/me — update authenticated user's plan settings */
  @Patch('me')
  @HttpCode(HttpStatus.OK)
  async updateMe(
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: { id: string },
  ) {
    const data = await this.usersService.updateUser(user.id, dto);
    return { data };
  }
}
