/**
 * verseRange.ts — pure verse range utility functions
 *
 * No dependencies. No side effects. 100% branch coverage required.
 * All progress arithmetic flows through these functions.
 *
 * A VerseRange is always INCLUSIVE: { startVerseId: 1, endVerseId: 5 }
 * contains verseIds 1, 2, 3, 4, 5 (5 verses total).
 */

export interface VerseRange {
  startVerseId: number;
  endVerseId: number;
}

/**
 * mergeRanges
 *
 * Merges overlapping and adjacent ranges into the minimal set of
 * non-overlapping ranges. Does NOT mutate the input array.
 *
 * Adjacent = endVerseId + 1 === nextStartVerseId (treated as contiguous).
 */
export function mergeRanges(ranges: VerseRange[]): VerseRange[] {
  if (ranges.length === 0) return [];

  // Sort by start, then end (does not mutate input — spread first)
  const sorted = [...ranges].sort(
    (a, b) => a.startVerseId - b.startVerseId || a.endVerseId - b.endVerseId,
  );

  const merged: VerseRange[] = [];
  let current = { ...sorted[0]! };

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i]!;
    if (next.startVerseId <= current.endVerseId + 1) {
      // Overlapping or adjacent — extend current range
      current.endVerseId = Math.max(current.endVerseId, next.endVerseId);
    } else {
      merged.push(current);
      current = { ...next };
    }
  }

  merged.push(current);
  return merged;
}

/**
 * countVersesInRanges
 *
 * Returns the total number of distinct verse IDs covered by the given ranges.
 * Merges first to prevent double-counting overlapping ranges.
 */
export function countVersesInRanges(ranges: VerseRange[]): number {
  if (ranges.length === 0) return 0;
  return mergeRanges(ranges).reduce(
    (sum, r) => sum + (r.endVerseId - r.startVerseId + 1),
    0,
  );
}

/**
 * isVerseInRanges
 *
 * Returns true if verseId falls within any of the given ranges.
 * Uses a linear scan — for large range arrays a binary search would be faster,
 * but in practice ranges per chapter are tiny (< 10).
 */
export function isVerseInRanges(verseId: number, ranges: VerseRange[]): boolean {
  for (const range of ranges) {
    if (verseId >= range.startVerseId && verseId <= range.endVerseId) {
      return true;
    }
  }
  return false;
}

/**
 * firstUnreadInRange
 *
 * Returns the verse ID of the first unread verse within [range.startVerseId, range.endVerseId].
 * Returns null if all verses in the range are read.
 */
export function firstUnreadInRange(
  readVerseIds: Set<number>,
  range: VerseRange,
): number | null {
  for (let v = range.startVerseId; v <= range.endVerseId; v++) {
    if (!readVerseIds.has(v)) {
      return v;
    }
  }
  return null;
}

/**
 * rangeCompletionRatio
 *
 * Returns a value between 0 and 1 representing what fraction of the range
 * has been read. Returns 0 for zero-length or invalid ranges — never NaN,
 * never throws.
 */
export function rangeCompletionRatio(
  readVerseIds: Set<number>,
  range: VerseRange,
): number {
  const totalVerses = range.endVerseId - range.startVerseId + 1;
  if (totalVerses <= 0) return 0;

  let readCount = 0;
  for (let v = range.startVerseId; v <= range.endVerseId; v++) {
    if (readVerseIds.has(v)) readCount++;
  }

  return readCount / totalVerses;
}

/**
 * subtractRanges
 *
 * Returns the portions of `target` that are NOT covered by any range in `subtracted`.
 * Used to find unread segments within a plan day range.
 *
 * Example:
 *   target = {1, 10}, subtracted = [{3, 5}]
 *   result  = [{1, 2}, {6, 10}]
 */
export function subtractRanges(
  target: VerseRange,
  subtracted: VerseRange[],
): VerseRange[] {
  if (subtracted.length === 0) return [{ ...target }];

  // Merge the subtracted ranges to simplify the algorithm
  const merged = mergeRanges(subtracted);

  const result: VerseRange[] = [];
  let cursor = target.startVerseId;

  for (const sub of merged) {
    // No overlap — this subtracted range starts after the target
    if (sub.startVerseId > target.endVerseId) break;
    // This subtracted range ends before our cursor — skip it
    if (sub.endVerseId < cursor) continue;

    // Gap before this subtracted range
    const gapEnd = sub.startVerseId - 1;
    if (cursor <= gapEnd && cursor <= target.endVerseId) {
      result.push({
        startVerseId: cursor,
        endVerseId: Math.min(gapEnd, target.endVerseId),
      });
    }

    cursor = sub.endVerseId + 1;
  }

  // Remaining tail after all subtracted ranges
  if (cursor <= target.endVerseId) {
    result.push({ startVerseId: cursor, endVerseId: target.endVerseId });
  }

  return result;
}
