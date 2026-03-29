/**
 * verseRange.test.ts — 100% branch coverage for verseRange.ts
 *
 * Written FIRST (TDD). All cases sourced from 08_TESTING_GUIDELINES.md §4.
 * Run: pnpm test apps/web/__tests__/verseRange.test.ts
 */

import {
  mergeRanges,
  countVersesInRanges,
  isVerseInRanges,
  firstUnreadInRange,
  rangeCompletionRatio,
  subtractRanges,
} from '../lib/verseRange';
import type { VerseRange } from '../lib/verseRange';

// ── mergeRanges ─────────────────────────────────────────────────────────────

describe('mergeRanges', () => {
  it('returns empty array for empty input', () => {
    expect(mergeRanges([])).toEqual([]);
  });

  it('returns the same single range unchanged', () => {
    expect(mergeRanges([{ startVerseId: 1, endVerseId: 5 }])).toEqual([
      { startVerseId: 1, endVerseId: 5 },
    ]);
  });

  it('merges overlapping ranges', () => {
    const input: VerseRange[] = [
      { startVerseId: 1, endVerseId: 5 },
      { startVerseId: 3, endVerseId: 8 },
    ];
    expect(mergeRanges(input)).toEqual([{ startVerseId: 1, endVerseId: 8 }]);
  });

  it('merges adjacent ranges (end+1 = start)', () => {
    const input: VerseRange[] = [
      { startVerseId: 1, endVerseId: 5 },
      { startVerseId: 6, endVerseId: 10 },
    ];
    expect(mergeRanges(input)).toEqual([{ startVerseId: 1, endVerseId: 10 }]);
  });

  it('does NOT merge non-adjacent ranges', () => {
    const input: VerseRange[] = [
      { startVerseId: 1, endVerseId: 5 },
      { startVerseId: 10, endVerseId: 15 },
    ];
    expect(mergeRanges(input)).toEqual([
      { startVerseId: 1, endVerseId: 5 },
      { startVerseId: 10, endVerseId: 15 },
    ]);
  });

  it('handles out-of-order input', () => {
    const input: VerseRange[] = [
      { startVerseId: 10, endVerseId: 15 },
      { startVerseId: 1, endVerseId: 3 },
      { startVerseId: 3, endVerseId: 12 },
    ];
    expect(mergeRanges(input)).toEqual([{ startVerseId: 1, endVerseId: 15 }]);
  });

  it('does not mutate the input array', () => {
    const input: VerseRange[] = [
      { startVerseId: 3, endVerseId: 7 },
      { startVerseId: 1, endVerseId: 5 },
    ];
    const inputCopy = JSON.parse(JSON.stringify(input)) as VerseRange[];
    mergeRanges(input);
    expect(input).toEqual(inputCopy);
  });
});

// ── countVersesInRanges ──────────────────────────────────────────────────────

describe('countVersesInRanges', () => {
  it('counts verses in a single range {1,5} as 5', () => {
    expect(countVersesInRanges([{ startVerseId: 1, endVerseId: 5 }])).toBe(5);
  });

  it('counts overlapping ranges without double-counting', () => {
    const input: VerseRange[] = [
      { startVerseId: 1, endVerseId: 5 },
      { startVerseId: 3, endVerseId: 8 },
    ];
    // After merge: {1,8} = 8 verses
    expect(countVersesInRanges(input)).toBe(8);
  });

  it('sums non-overlapping ranges', () => {
    const input: VerseRange[] = [
      { startVerseId: 1, endVerseId: 5 },
      { startVerseId: 10, endVerseId: 14 },
    ];
    // 5 + 5 = 10
    expect(countVersesInRanges(input)).toBe(10);
  });

  it('returns 0 for empty input', () => {
    expect(countVersesInRanges([])).toBe(0);
  });
});

// ── isVerseInRanges ──────────────────────────────────────────────────────────

describe('isVerseInRanges', () => {
  const ranges: VerseRange[] = [
    { startVerseId: 1, endVerseId: 5 },
    { startVerseId: 10, endVerseId: 15 },
  ];

  it('returns true for a verse inside a range', () => {
    expect(isVerseInRanges(3, ranges)).toBe(true);
  });

  it('returns true for a verse at the start boundary', () => {
    expect(isVerseInRanges(1, ranges)).toBe(true);
  });

  it('returns true for a verse at the end boundary', () => {
    expect(isVerseInRanges(5, ranges)).toBe(true);
  });

  it('returns false for a verse in the gap between ranges', () => {
    expect(isVerseInRanges(7, ranges)).toBe(false);
  });

  it('returns false for a verse after the last range', () => {
    expect(isVerseInRanges(20, ranges)).toBe(false);
  });

  it('returns false for empty ranges', () => {
    expect(isVerseInRanges(1, [])).toBe(false);
  });
});

// ── firstUnreadInRange ───────────────────────────────────────────────────────

describe('firstUnreadInRange', () => {
  const range: VerseRange = { startVerseId: 1, endVerseId: 5 };

  it('returns the first verse in range when nothing is read', () => {
    expect(firstUnreadInRange(new Set(), range)).toBe(1);
  });

  it('returns verse N+1 when first N verses are read', () => {
    const read = new Set([1, 2, 3]);
    expect(firstUnreadInRange(read, range)).toBe(4);
  });

  it('returns null when all verses in range are read', () => {
    const allRead = new Set([1, 2, 3, 4, 5]);
    expect(firstUnreadInRange(allRead, range)).toBeNull();
  });

  it('handles a single-verse range', () => {
    const singleVerse: VerseRange = { startVerseId: 42, endVerseId: 42 };
    expect(firstUnreadInRange(new Set(), singleVerse)).toBe(42);
    expect(firstUnreadInRange(new Set([42]), singleVerse)).toBeNull();
  });
});

// ── rangeCompletionRatio ─────────────────────────────────────────────────────

describe('rangeCompletionRatio', () => {
  const range: VerseRange = { startVerseId: 1, endVerseId: 10 };

  it('returns 0 when nothing is read', () => {
    expect(rangeCompletionRatio(new Set(), range)).toBe(0);
  });

  it('returns 1 when all verses are read', () => {
    const allRead = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(rangeCompletionRatio(allRead, range)).toBe(1);
  });

  it('returns 0.5 when half the verses are read', () => {
    const halfRead = new Set([1, 2, 3, 4, 5]);
    expect(rangeCompletionRatio(halfRead, range)).toBe(0.5);
  });

  it('returns 0 for a zero-length range (no divide-by-zero)', () => {
    // startVerseId > endVerseId edge case
    const emptyRange: VerseRange = { startVerseId: 5, endVerseId: 4 };
    expect(rangeCompletionRatio(new Set([5]), emptyRange)).toBe(0);
  });

  it('returns 0 for a single-verse range when start === end (1-verse range, unread)', () => {
    const singleVerse: VerseRange = { startVerseId: 5, endVerseId: 5 };
    expect(rangeCompletionRatio(new Set(), singleVerse)).toBe(0);
  });
});

// ── subtractRanges ───────────────────────────────────────────────────────────

describe('subtractRanges', () => {
  const target: VerseRange = { startVerseId: 1, endVerseId: 10 };

  it('returns full target range when read list is empty', () => {
    expect(subtractRanges(target, [])).toEqual([{ startVerseId: 1, endVerseId: 10 }]);
  });

  it('returns empty array when target is fully covered', () => {
    const read: VerseRange[] = [{ startVerseId: 1, endVerseId: 10 }];
    expect(subtractRanges(target, read)).toEqual([]);
  });

  it('returns two segments when middle is subtracted', () => {
    const read: VerseRange[] = [{ startVerseId: 4, endVerseId: 6 }];
    expect(subtractRanges(target, read)).toEqual([
      { startVerseId: 1, endVerseId: 3 },
      { startVerseId: 7, endVerseId: 10 },
    ]);
  });

  it('returns right segment only when start is subtracted', () => {
    const read: VerseRange[] = [{ startVerseId: 1, endVerseId: 5 }];
    expect(subtractRanges(target, read)).toEqual([{ startVerseId: 6, endVerseId: 10 }]);
  });

  it('returns empty array when multiple read ranges cover the entire target', () => {
    const read: VerseRange[] = [
      { startVerseId: 1, endVerseId: 4 },
      { startVerseId: 5, endVerseId: 7 },
      { startVerseId: 8, endVerseId: 10 },
    ];
    expect(subtractRanges(target, read)).toEqual([]);
  });

  it('handles read range extending beyond target boundaries', () => {
    const read: VerseRange[] = [{ startVerseId: 0, endVerseId: 15 }];
    expect(subtractRanges(target, read)).toEqual([]);
  });
});
