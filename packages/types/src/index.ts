/**
 * @lectio/types — shared domain interfaces
 *
 * These are the canonical shapes for API responses and internal domain objects.
 * Import from here in both apps/web and apps/api.
 */

export interface Book {
  id: number;
  usfmCode: string;
  name: string;
  testament: 'OT' | 'NT';
  chapterCount: number;
}

export interface Chapter {
  id: number;
  bookId: number;
  number: number;
  verseCount: number;
}

export interface Verse {
  id: number;
  chapterId: number;
  number: number;
  text: string;
}

export interface PlanDayView {
  dayNumber: number;
  label: string;
  book: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
  startVerseId: number;
  endVerseId: number;
  isToday: boolean;
  offsetFromToday: number;
}

export interface PlanDayListItem {
  dayNumber: number;
  label: string;
  startVerseId: number;
  endVerseId: number;
  isToday: boolean;
  offsetFromToday: number;
}

export interface PlanDayListResponse {
  items: PlanDayListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface VerseReadResult {
  inserted: number;
  alreadyRead: number;
}

export interface ContinuePosition {
  bookUsfm: string;
  bookName: string;
  chapterNumber: number;
  verseNumber: number;
  verseId: number;
}

export interface ProgressSummary {
  totalVersesRead: number;
  completionPct: number;
  streakDays: number;
  aheadBehindVerses: number | null;
}

export interface GuestUser {
  guestToken: string;
  createdAt: string;
}

export interface VerseRange {
  startVerseId: number;
  endVerseId: number;
}

export interface OtpSendResult {
  sent: boolean;
}

export interface OtpVerifyResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
  };
}

export interface MigrateGuestResult {
  migratedReads: number;
  alreadyMigrated: boolean;
}

export type { };
