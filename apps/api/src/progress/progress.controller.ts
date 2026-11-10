/**
 * progress.controller.ts — routing only, zero business logic.
 */
import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { TimeZone } from '../common/time-zone';
import { ProgressService } from './progress.service';
import {
  MarkVersesReadDto,
  UnmarkVersesReadDto,
  DailyCountsQueryDto,
  ReadsInRangeQueryDto,
} from './progress.types';

@Controller('progress')
@UseGuards(AuthGuard)
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  /** POST /api/progress/verses — the sole write path for reading progress. */
  @Post('verses')
  @HttpCode(HttpStatus.OK)
  async markVersesRead(@Body() dto: MarkVersesReadDto, @CurrentUser() user: { id: string }) {
    const data = await this.progressService.markVersesRead(user.id, dto.verseIds, dto.readAt);
    return { data };
  }

  /** POST /api/progress/verses/unmark — undo: mark verses as unread. */
  @Post('verses/unmark')
  @HttpCode(HttpStatus.OK)
  async unmarkVersesRead(@Body() dto: UnmarkVersesReadDto, @CurrentUser() user: { id: string }) {
    const data = await this.progressService.unmarkVersesRead(user.id, dto.verseIds);
    return { data };
  }

  /** GET /api/progress/continue — first unread verse in the user's plan */
  @Get('continue')
  async getContinuePosition(@CurrentUser() user: { id: string }) {
    const data = await this.progressService.getContinuePosition(user.id);
    return { data };
  }

  /** GET /api/progress/summary — aggregate reading stats */
  @Get('summary')
  async getProgressSummary(@CurrentUser() user: { id: string }, @TimeZone() tz: string) {
    const data = await this.progressService.getProgressSummary(user.id, tz);
    return { data };
  }

  /** GET /api/progress/daily-counts?days=N (1–366) */
  @Get('daily-counts')
  async getDailyCounts(
    @Query() query: DailyCountsQueryDto,
    @CurrentUser() user: { id: string },
    @TimeZone() tz: string,
  ) {
    const data = await this.progressService.getDailyCounts(user.id, query.days, tz);
    return { data };
  }

  /** GET /api/progress/reads?startVerseId=X&endVerseId=Y */
  @Get('reads')
  async getReadVerseIds(@Query() query: ReadsInRangeQueryDto, @CurrentUser() user: { id: string }) {
    const data = await this.progressService.getReadVerseIdsInRange(
      user.id,
      query.startVerseId,
      query.endVerseId,
    );
    return { data };
  }

  /** POST /api/progress/reset — archive + delete all reads (atomic). */
  @Post('reset')
  @HttpCode(HttpStatus.OK)
  async resetProgress(@CurrentUser() user: { id: string }) {
    const data = await this.progressService.resetProgress(user.id);
    return { data };
  }

  /** GET /api/progress/export — full verse_reads export */
  @Get('export')
  async exportProgress(@CurrentUser() user: { id: string }) {
    const data = await this.progressService.exportProgress(user.id);
    return { data };
  }
}
