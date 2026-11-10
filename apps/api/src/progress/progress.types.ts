/**
 * progress.types.ts — DTOs and interfaces for the progress module.
 *
 * Request DTOs use class-validator decorators so ValidationPipe rejects
 * malformed requests before they reach the service.
 */
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  ArrayMinSize,
  ArrayMaxSize,
  IsOptional,
  IsISO8601,
  Min,
  Max,
} from 'class-validator';

export class MarkVersesReadDto {
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  verseIds!: number[];

  /**
   * When the reads actually happened (offline queue). Clamped server-side to
   * the last 30 days and never in the future; defaults to "now".
   */
  @IsOptional()
  @IsISO8601({ strict: true })
  readAt?: string;
}

export class UnmarkVersesReadDto {
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  verseIds!: number[];
}

export class DailyCountsQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(366)
  days!: number;
}

export class ReadsInRangeQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  startVerseId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  endVerseId!: number;
}

export interface MarkVersesReadResponseDto {
  inserted: number;
  alreadyRead: number;
}

export interface UnmarkVersesReadResponseDto {
  removed: number;
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
  /** % of the user's plan that has been read */
  completionPct: number;
  /** Consecutive local days with at least one verse read */
  streakDays: number;
  /** Verses ahead (+) or behind (−) the plan schedule; null without a start date */
  aheadBehindVerses: number | null;
}

export interface DailyCountDto {
  date: string;
  count: number;
}

export interface ResetProgressResponseDto {
  archivedCount: number;
}

export interface ExportVerseReadDto {
  verseId: number;
  readAt: string;
}

export interface ExportProgressResponseDto {
  userId: string;
  exportedAt: string;
  verseReads: ExportVerseReadDto[];
}
