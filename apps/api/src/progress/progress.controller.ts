/**
 * progress.controller.ts — routing only, zero business logic.
 */
import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ProgressService } from './progress.service';
import { MarkVersesReadDto } from './progress.types';

@Controller('progress')
@UseGuards(AuthGuard)
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  /**
   * POST /api/progress/verses
   * The sole write path for all reading progress.
   */
  @Post('verses')
  @HttpCode(HttpStatus.OK)
  async markVersesRead(
    @Body() dto: MarkVersesReadDto,
    @CurrentUser() user: { id: string },
  ) {
    const data = await this.progressService.markVersesRead(user.id, dto.verseIds);
    return { data };
  }

  /** GET /api/progress/continue — first unread verse in the user's plan */
  @Get('continue')
  async getContinuePosition(@CurrentUser() user: { id: string }) {
    const data = await this.progressService.getContinuePosition(user.id);
    if (!data) {
      return { data: null };
    }
    return { data };
  }

  /** GET /api/progress/summary — aggregate reading stats */
  @Get('summary')
  async getProgressSummary(@CurrentUser() user: { id: string }) {
    const data = await this.progressService.getProgressSummary(user.id);
    return { data };
  }

  /**
   * GET /api/progress/reads?startVerseId=X&endVerseId=Y
   * Returns read verse IDs for the authenticated user in the given verse range.
   * Used by the frontend to compute per-chapter read state for ChapterGrid.
   */
  @Get('reads')
  async getReadVerseIds(
    @Query('startVerseId', ParseIntPipe) startVerseId: number,
    @Query('endVerseId', ParseIntPipe) endVerseId: number,
    @CurrentUser() user: { id: string },
  ) {
    const data = await this.progressService.getReadVerseIdsInRange(
      user.id,
      startVerseId,
      endVerseId,
    );
    return { data };
  }
}
