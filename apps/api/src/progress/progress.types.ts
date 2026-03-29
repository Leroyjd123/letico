/**
 * progress.types.ts — DTOs and interfaces for the progress module.
 *
 * MarkVersesReadDto uses class-validator decorators so ValidationPipe
 * can reject malformed requests before they reach the service.
 */
import { IsArray, IsInt, ArrayMinSize, ArrayMaxSize } from 'class-validator';

export class MarkVersesReadDto {
  @IsArray()
  @IsInt({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  verseIds!: number[];
}

export interface MarkVersesReadResponseDto {
  inserted: number;
  alreadyRead: number;
}

export interface ContinuePositionDto {
  bookUsfm: string;
  bookName: string;
  chapterNumber: number;
  verseNumber: number;
  verseId: number;
}

export interface ProgressSummaryDto {
  totalVersesRead: number;
  completionPct: number;
  /** Streak calculation is deferred to Phase 6 */
  streakDays: number;
  /** Ahead/behind is deferred to Phase 6 */
  aheadBehindVerses: number | null;
}
