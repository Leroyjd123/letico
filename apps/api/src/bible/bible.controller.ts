/**
 * bible.controller.ts — routing only, zero business logic.
 *
 * All logic lives in BibleService. Controllers exist solely to map
 * HTTP verbs/paths to service calls and wrap responses.
 */
import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseInterceptors,
} from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { BibleService } from './bible.service';

@Controller('bible')
@UseInterceptors(CacheInterceptor)
export class BibleController {
  constructor(private readonly bibleService: BibleService) {}

  /** GET /api/bible/books — all 66 books in canonical order. Cache: 24h */
  @Get('books')
  @CacheTTL(86400 * 1000)
  async getAllBooks() {
    const data = await this.bibleService.getAllBooks();
    return { data };
  }

  /** GET /api/bible/books/:usfmCode — single book. Cache: 24h */
  @Get('books/:usfmCode')
  @CacheTTL(86400 * 1000)
  async getBook(@Param('usfmCode') usfmCode: string) {
    const data = await this.bibleService.getBookByUsfm(usfmCode);
    return { data };
  }

  /** GET /api/bible/books/:usfmCode/chapters — all chapters for a book. Cache: 24h */
  @Get('books/:usfmCode/chapters')
  @CacheTTL(86400 * 1000)
  async getChapters(@Param('usfmCode') usfmCode: string) {
    const data = await this.bibleService.getChaptersByBook(usfmCode);
    return { data };
  }

  /** GET /api/bible/chapters/:chapterId/verses — all verses. Cache: 1h */
  @Get('chapters/:chapterId/verses')
  @CacheTTL(3600 * 1000)
  async getVerses(@Param('chapterId', ParseIntPipe) chapterId: number) {
    const data = await this.bibleService.getVersesByChapter(chapterId);
    return { data };
  }
}
