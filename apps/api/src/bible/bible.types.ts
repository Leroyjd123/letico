/**
 * bible.types.ts — internal DB row shapes and API DTO shapes
 *
 * Row types: what Supabase returns from the DB.
 * Dto types: what the API returns to clients. global_order is NEVER in a Dto.
 */

// ── Database row shapes ────────────────────────────────────────────────────

export interface BookRow {
  id: number;
  usfm_code: string;
  name: string;
  testament: 'OT' | 'NT';
  chapter_count: number;
  sort_order: number;
}

export interface ChapterRow {
  id: number;
  book_id: number;
  number: number;
  verse_count: number;
}

export interface VerseRow {
  id: number;
  chapter_id: number;
  number: number;
  text: string;
  global_order: number; // present in DB, never in DTO response
}

// ── API DTO shapes ────────────────────────────────────────────────────────
// These match the interface definitions in @lectio/types exactly.
// global_order is stripped by the mapper functions in bible.service.ts.

export interface BookDto {
  id: number;
  usfmCode: string;
  name: string;
  testament: 'OT' | 'NT';
  chapterCount: number;
}

export interface ChapterDto {
  id: number;
  bookId: number;
  number: number;
  verseCount: number;
}

export interface VerseDto {
  id: number;
  chapterId: number;
  number: number;
  text: string;
  // global_order intentionally absent
}
