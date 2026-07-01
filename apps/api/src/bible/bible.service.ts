/**
 * bible.service.ts
 *
 * All business logic for Bible data retrieval. Controllers are routing-only —
 * zero logic lives outside this service.
 *
 * Invariant: global_order is never returned to the client. Every query that
 * fetches verses must route through toVerseDto() to strip it.
 */
import { Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { InjectSupabase } from '../supabase/inject-supabase.decorator';
import { SupabaseProvider } from '../supabase/supabase.provider';
import type { BookRow, ChapterRow, VerseRow, BookDto, ChapterDto, VerseDto } from './bible.types';

@Injectable()
export class BibleService {
  private readonly logger = new Logger(BibleService.name);

  constructor(@InjectSupabase() private readonly supabase: SupabaseProvider) {}

  async getAllBooks(): Promise<BookDto[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('books')
      .select('id, usfm_code, name, testament, chapter_count, sort_order')
      .order('sort_order', { ascending: true });

    if (error || !data) {
      this.logger.error(`Failed to fetch books: ${error?.message}`);
      throw new InternalServerErrorException({
        error: { code: 'BOOKS_FETCH_FAILED', message: 'Failed to fetch books' },
      });
    }

    return (data as BookRow[]).map(this.toBookDto);
  }

  async getBookByUsfm(usfmCode: string): Promise<BookDto> {
    // Always normalise to uppercase — the API contract is case-insensitive
    const normalised = usfmCode.toUpperCase();

    const { data, error } = await this.supabase
      .getClient()
      .from('books')
      .select('id, usfm_code, name, testament, chapter_count, sort_order')
      .eq('usfm_code', normalised)
      .single();

    if (error || !data) {
      throw new NotFoundException({
        error: {
          code: 'BOOK_NOT_FOUND',
          message: `Book not found: ${normalised}`,
        },
      });
    }

    return this.toBookDto(data as BookRow);
  }

  async getChaptersByBook(usfmCode: string): Promise<ChapterDto[]> {
    const normalised = usfmCode.toUpperCase();

    // First resolve book to get book_id
    const book = await this.getBookByUsfm(normalised);

    const { data, error } = await this.supabase
      .getClient()
      .from('chapters')
      .select('id, book_id, number, verse_count')
      .eq('book_id', book.id)
      .order('number', { ascending: true });

    if (error || !data) {
      this.logger.error(`Failed to fetch chapters for ${normalised}: ${error?.message}`);
      throw new InternalServerErrorException({
        error: { code: 'CHAPTERS_FETCH_FAILED', message: 'Failed to fetch chapters' },
      });
    }

    return (data as ChapterRow[]).map(this.toChapterDto);
  }

  async getVersesByChapter(chapterId: number): Promise<VerseDto[]> {
    // Verify chapter exists first
    const { data: chapter, error: chapterError } = await this.supabase
      .getClient()
      .from('chapters')
      .select('id')
      .eq('id', chapterId)
      .single();

    if (chapterError || !chapter) {
      throw new NotFoundException({
        error: {
          code: 'CHAPTER_NOT_FOUND',
          message: `Chapter not found: ${chapterId}`,
        },
      });
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('verses')
      // Select all columns including global_order for internal ordering,
      // but global_order is stripped by toVerseDto before returning.
      .select('id, chapter_id, number, text, global_order')
      .eq('chapter_id', chapterId)
      .order('number', { ascending: true });

    if (error) {
      this.logger.error(`Failed to fetch verses for chapter ${chapterId}: ${error.message}`);
      throw new InternalServerErrorException({
        error: { code: 'VERSES_FETCH_FAILED', message: 'Failed to fetch verses' },
      });
    }

    if (!data || (data as VerseRow[]).length === 0) {
      throw new NotFoundException({
        error: {
          code: 'CHAPTER_NOT_FOUND',
          message: `Chapter not found: ${chapterId}`,
        },
      });
    }

    // toVerseDto explicitly omits global_order
    return (data as VerseRow[]).map(this.toVerseDto);
  }

  // ── Private mappers ────────────────────────────────────────────────────

  private toBookDto(row: BookRow): BookDto {
    return {
      id: row.id,
      usfmCode: row.usfm_code,
      name: row.name,
      testament: row.testament,
      chapterCount: row.chapter_count,
    };
  }

  private toChapterDto(row: ChapterRow): ChapterDto {
    return {
      id: row.id,
      bookId: row.book_id,
      number: row.number,
      verseCount: row.verse_count,
    };
  }

  private toVerseDto(row: VerseRow): VerseDto {
    // global_order is intentionally NOT included in the return value.
    // It is an internal implementation detail and must never be exposed to clients.
    return {
      id: row.id,
      chapterId: row.chapter_id,
      number: row.number,
      text: row.text,
    };
  }
}
