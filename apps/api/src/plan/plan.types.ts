/** DB row shapes and DTOs for the plan module */

export interface PlanDayRow {
  id: string;
  plan_id: string;
  day_number: number;
  start_verse_id: number;
  end_verse_id: number;
  start_global_order: number;
  end_global_order: number;
}

/** Row returned by the plan_day_chapters() SQL function */
export interface PlanDayChapterRow {
  chapter_id: number;
  chapter_number: number;
  book_usfm: string;
  book_name: string;
  verse_ids: number[];
  verse_numbers: number[];
  read_verse_ids: number[];
}

/** Row returned by the plan_days_summary() SQL function */
export interface PlanDaySummaryRow {
  day_number: number;
  total_verses: number;
  verses_read: number;
  start_book_name: string;
  start_book_usfm: string;
  start_chapter: number;
  end_book_name: string;
  end_book_usfm: string;
  end_chapter: number;
}

/** One chapter (or part of a chapter) that belongs to a plan day. */
export interface PlanDayChapterDto {
  chapterId: number;
  chapterNumber: number;
  /** USFM code, e.g. "GEN" — used for the jw.org deep-link */
  book: string;
  bookName: string;
  /** Verse ids in this chapter that belong to the day, ordered by verse number */
  verseIds: number[];
  /** Verse numbers matching verseIds index-for-index */
  verseNumbers: number[];
  /** Subset of verseIds this user has already read */
  readVerseIds: number[];
}

export interface PlanDayViewDto {
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
  chapters: PlanDayChapterDto[];
  totalVerses: number;
  versesRead: number;
  isToday: boolean;
  offsetFromToday: number;
}

/** Lightweight summary for the plan list view */
export interface PlanDaySummaryDto {
  dayNumber: number;
  label: string;
  completionPct: number;
  isToday: boolean;
  offsetFromToday: number;
}

export interface PlanListItemDto {
  id: string;
  name: string;
  totalDays: number;
  isDefault: boolean;
}
