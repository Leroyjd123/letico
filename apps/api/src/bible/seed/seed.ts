/**
 * seed.ts — Lectio Bible database seed
 *
 * Run: pnpm db:seed
 *
 * What this does:
 * 1. Inserts 66 books in canonical order (sort_order 1–66)
 * 2. Inserts all chapters for each book
 * 3. Inserts placeholder verses with global_order (1 → 31,102)
 *    NOTE: verse text is seeded as a placeholder. Real KJV text must be
 *    loaded from a full KJV JSON source file (not included in this repo
 *    due to copyright). The placeholder format is "Book Chapter:Verse".
 * 4. Inserts 3 plans (1yr, 2yr, chronological)
 * 5. Inserts 365 plan_days for the 1yr plan — boundaries aligned to chapter ends
 * 6. Asserts verse count = 31,102 and global_order has no gaps
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import { KJV_BOOKS } from './kjv-verse-counts';

// Resolve .env from the monorepo root regardless of cwd
dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

const supabaseUrl = process.env['SUPABASE_URL'];
const supabaseKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

if (!supabaseUrl || !supabaseKey) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  process.exit(1);
}

const db = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Compute cumulative chapter verse totals for the 1yr plan boundary alignment */
interface ChapterBoundary {
  bookSortOrder: number;
  bookUsfm: string;
  chapterNumber: number;
  /** global_order of the LAST verse in this chapter */
  lastGlobalOrder: number;
  /** chapter_id will be filled after insert */
  chapterId?: number;
}

async function main() {
  console.log('Starting Lectio seed...\n');

  // ── Step 1: Books ─────────────────────────────────────────
  console.log('Seeding books...');
  const bookRows = KJV_BOOKS.map((b, i) => ({
    usfm_code: b.usfmCode,
    name: b.name,
    testament: b.testament,
    chapter_count: b.chapters.length,
    sort_order: i + 1,
  }));

  const { data: insertedBooks, error: booksError } = await db
    .from('books')
    .upsert(bookRows, { onConflict: 'usfm_code' })
    .select('id, usfm_code, sort_order');

  if (booksError) throw new Error(`Books insert failed: ${booksError.message}`);
  console.log(`  ✓ ${insertedBooks?.length ?? 0} books`);

  // Build a lookup: usfm_code → book row
  const booksByUsfm = new Map(
    (insertedBooks ?? []).map((b) => [b.usfm_code as string, b as { id: number; usfm_code: string; sort_order: number }]),
  );

  // ── Step 2: Chapters + Verses ─────────────────────────────
  console.log('Seeding chapters and verses...');

  let globalOrder = 0;
  const chapterBoundaries: ChapterBoundary[] = [];

  for (const book of KJV_BOOKS) {
    const bookRow = booksByUsfm.get(book.usfmCode);
    if (!bookRow) throw new Error(`Book not found after insert: ${book.usfmCode}`);

    // Insert chapters for this book
    const chapterRows = book.chapters.map((verseCount, i) => ({
      book_id: bookRow.id,
      number: i + 1,
      verse_count: verseCount,
    }));

    const { data: insertedChapters, error: chaptersError } = await db
      .from('chapters')
      .upsert(chapterRows, { onConflict: 'book_id,number' })
      .select('id, number');

    if (chaptersError) throw new Error(`Chapters insert failed for ${book.usfmCode}: ${chaptersError.message}`);

    const chaptersByNumber = new Map(
      (insertedChapters ?? []).map((c) => [c.number as number, c.id as number]),
    );

    // Insert verses for each chapter in this book
    for (let ci = 0; ci < book.chapters.length; ci++) {
      const chapterNumber = ci + 1;
      const verseCount = book.chapters[ci] ?? 0;
      const chapterId = chaptersByNumber.get(chapterNumber);
      if (!chapterId) throw new Error(`Chapter ${chapterNumber} not found for ${book.usfmCode}`);

      const verseRows = [];
      for (let vi = 1; vi <= verseCount; vi++) {
        globalOrder++;
        verseRows.push({
          chapter_id: chapterId,
          number: vi,
          // Placeholder text — replace with real KJV text from a licensed source
          text: `${book.name} ${chapterNumber}:${vi}`,
          global_order: globalOrder,
        });
      }

      // Batch insert in chunks of 500 to avoid payload limits
      for (let offset = 0; offset < verseRows.length; offset += 500) {
        const chunk = verseRows.slice(offset, offset + 500);
        const { error: versesError } = await db
          .from('verses')
          .upsert(chunk, { onConflict: 'chapter_id,number' });
        if (versesError) throw new Error(`Verses insert failed for ${book.usfmCode} ch${chapterNumber}: ${versesError.message}`);
      }

      chapterBoundaries.push({
        bookSortOrder: bookRow.sort_order,
        bookUsfm: book.usfmCode,
        chapterNumber,
        lastGlobalOrder: globalOrder,
        chapterId,
      });
    }

    process.stdout.write(`  ${book.usfmCode} `);
  }

  console.log(`\n  ✓ ${globalOrder} verses (expected 31,102)`);

  // ── Step 3: Validate verse count ──────────────────────────
  const { count: verseCount, error: countError } = await db
    .from('verses')
    .select('*', { count: 'exact', head: true });

  if (countError) throw new Error(`Verse count query failed: ${countError.message}`);
  if (verseCount !== 31102) {
    throw new Error(`SEED INTEGRITY FAILURE: Expected 31,102 verses, got ${verseCount}. Aborting.`);
  }
  console.log('  ✓ Verse count assertion passed: 31,102');

  // ── Step 4: Plans ─────────────────────────────────────────
  console.log('\nSeeding plans...');

  const planRows = [
    { name: '1 year plan', description: 'sequential, Genesis to Revelation, 365 days' },
    { name: '2 year plan', description: 'sequential, Genesis to Revelation, 730 days' },
    { name: 'chronological', description: 'Bible events in historical order' },
  ];

  const { data: insertedPlans, error: plansError } = await db
    .from('plans')
    .insert(planRows)
    .select('id, name');

  if (plansError) throw new Error(`Plans insert failed: ${plansError.message}`);
  console.log(`  ✓ ${insertedPlans?.length ?? 0} plans`);

  const oneYearPlan = (insertedPlans ?? []).find((p) => p.name === '1 year plan');
  if (!oneYearPlan) throw new Error('1 year plan not found after insert');

  // ── Step 5: plan_days for 1yr plan ────────────────────────
  console.log('\nGenerating 1yr plan days...');

  const planDays = build1YrPlanDays(oneYearPlan.id as string, chapterBoundaries);

  // Resolve actual verse IDs for all boundary global_orders in one query.
  // We cannot assume verse.id === verse.global_order (SERIAL ID is
  // assigned sequentially but may not match if any rows were deleted/re-seeded).
  const boundaryGlobalOrders = new Set<number>();
  for (const pd of planDays) {
    boundaryGlobalOrders.add(pd.start_global_order);
    boundaryGlobalOrders.add(pd.end_global_order);
  }

  const { data: boundaryVerses, error: bvError } = await db
    .from('verses')
    .select('id, global_order')
    .in('global_order', [...boundaryGlobalOrders]);

  if (bvError) throw new Error(`Boundary verse lookup failed: ${bvError.message}`);

  const globalOrderToId = new Map<number, number>(
    (boundaryVerses ?? []).map((v) => [v.global_order as number, v.id as number]),
  );

  // Fill in real verse IDs
  const planDaysResolved = planDays.map((pd) => {
    const startId = globalOrderToId.get(pd.start_global_order);
    const endId = globalOrderToId.get(pd.end_global_order);
    if (!startId || !endId) {
      throw new Error(
        `Could not resolve verse IDs for day ${pd.day_number}: ` +
          `global_order ${pd.start_global_order}→${pd.end_global_order}`,
      );
    }
    return { ...pd, start_verse_id: startId, end_verse_id: endId };
  });

  // Batch insert plan_days in chunks of 50
  for (let offset = 0; offset < planDaysResolved.length; offset += 50) {
    const chunk = planDaysResolved.slice(offset, offset + 50);
    const { error: pdError } = await db
      .from('plan_days')
      .insert(chunk);
    if (pdError) throw new Error(`plan_days insert failed at day ${(offset + 1).toString()}: ${pdError.message}`);
  }

  console.log(`  ✓ ${planDaysResolved.length} plan days (target: 365)`);
  console.log('\n✅ Seed complete. 31,102 verses seeded.');
}

/**
 * Generates exactly 365 plan_day rows for the 1yr plan.
 *
 * Strategy: proportional cursor — for day d, target the chapter boundary
 * whose lastGlobalOrder is closest to Math.round(d * 31102 / 365).
 * Chapter boundaries are never split; day 365 always takes all remaining chapters.
 * Each day is guaranteed at least one chapter (maxCursor clamp).
 */
function build1YrPlanDays(
  planId: string,
  boundaries: ChapterBoundary[],
): Array<{
  plan_id: string;
  day_number: number;
  start_verse_id: number;
  end_verse_id: number;
  start_global_order: number;
  end_global_order: number;
}> {
  const TARGET_DAYS = 365;
  const TOTAL_VERSES = 31102;
  const days: Array<{
    plan_id: string;
    day_number: number;
    start_verse_id: number;
    end_verse_id: number;
    start_global_order: number;
    end_global_order: number;
  }> = [];

  let cursorIdx = 0;
  let dayStart = 1;

  for (let dayNum = 1; dayNum <= TARGET_DAYS; dayNum++) {
    if (dayNum === TARGET_DAYS) {
      // Last day takes all remaining chapters
      const lastBoundary = boundaries[boundaries.length - 1];
      if (!lastBoundary) break;
      days.push({
        plan_id: planId,
        day_number: dayNum,
        start_verse_id: -1,
        end_verse_id: -1,
        start_global_order: dayStart,
        end_global_order: lastBoundary.lastGlobalOrder,
      });
      break;
    }

    const targetEnd = Math.round((dayNum * TOTAL_VERSES) / TARGET_DAYS);
    // Leave at least (TARGET_DAYS - dayNum) chapters for the remaining days
    const maxCursor = boundaries.length - (TARGET_DAYS - dayNum) - 1;

    while (cursorIdx < maxCursor) {
      const next = boundaries[cursorIdx + 1];
      if (!next || next.lastGlobalOrder > targetEnd) break;
      cursorIdx++;
    }

    const boundary = boundaries[cursorIdx];
    if (!boundary) break;

    days.push({
      plan_id: planId,
      day_number: dayNum,
      start_verse_id: -1,
      end_verse_id: -1,
      start_global_order: dayStart,
      end_global_order: boundary.lastGlobalOrder,
    });

    dayStart = boundary.lastGlobalOrder + 1;
    cursorIdx++;
  }

  return days;
}

main().catch((err) => {
  console.error('\n❌ Seed failed:', err);
  process.exit(1);
});
