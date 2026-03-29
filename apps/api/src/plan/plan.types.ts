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

export interface UserPlanRow {
  id: string;
  plan_id: string | null;
  plan_start_date: string | null;
}

export interface VerseContext {
  verseNumber: number;
  chapterNumber: number;
  bookName: string;
  bookUsfm: string;
}

export interface PlanDayViewDto {
  dayNumber: number;
  label: string;
  /** USFM code of the start verse's book (used by frontend for jw.org deep-link) */
  book: string;
  /** Chapter number of the start verse */
  chapter: number;
  startVerse: number;
  endVerse: number;
  startVerseId: number;
  endVerseId: number;
  isToday: boolean;
  offsetFromToday: number;
}
