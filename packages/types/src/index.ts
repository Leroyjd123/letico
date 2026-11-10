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

/** One chapter (or part of one) that belongs to a plan day. */
export interface PlanDayChapter {
  chapterId: number;
  chapterNumber: number;
  /** USFM code, e.g. "GEN" */
  book: string;
  bookName: string;
  /** Verse ids in this chapter that belong to the day, ordered by verse number */
  verseIds: number[];
  /** Verse numbers matching verseIds index-for-index */
  verseNumbers: number[];
  /** Subset of verseIds the user has already read */
  readVerseIds: number[];
}

export interface PlanDayView {
  planId: string;
  dayNumber: number;
  totalDays: number;
  label: string;
  /** USFM code of the day's first book */
  book: string;
  /** First chapter of the day */
  chapter: number;
  startVerse: number;
  endVerse: number;
  startVerseId: number;
  endVerseId: number;
  /** Every chapter in the day, across book boundaries, in reading order */
  chapters: PlanDayChapter[];
  totalVerses: number;
  versesRead: number;
  isToday: boolean;
  offsetFromToday: number;
}

export interface PlanDaySummary {
  dayNumber: number;
  label: string;
  completionPct: number;
  isToday: boolean;
  offsetFromToday: number;
}

export interface VerseReadResult {
  inserted: number;
  alreadyRead: number;
}

export interface VerseUnreadResult {
  removed: number;
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
  /** % of the user's plan that has been read */
  completionPct: number;
  /** Consecutive local days with at least one verse read */
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

export interface DailyCount {
  date: string;
  count: number;
}

export interface PlanListItem {
  id: string;
  name: string;
  totalDays: number;
  isDefault: boolean;
}

export interface UpdateUserResult {
  planId: string | null;
  planStartDate: string | null;
}

export interface ResetProgressResult {
  archivedCount: number;
}

export interface ExportVerseRead {
  verseId: number;
  readAt: string;
}

export interface ExportProgressResult {
  userId: string;
  exportedAt: string;
  verseReads: ExportVerseRead[];
}

export interface MeResult {
  id: string;
  planId: string | null;
  planStartDate: string | null;
}

