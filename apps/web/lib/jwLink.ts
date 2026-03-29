/**
 * jwLink.ts — jw.org deep-link builder
 *
 * The URL pattern lives here as a single named constant.
 * Never construct jw.org URLs inline in any component.
 *
 * Verified example: Genesis 1 → bible=01001
 * URL format: https://www.jw.org/finder?wtlocale=E&bible={BB}{CCC}&pub=nwt
 *   BB  = book sort_order zero-padded to 2 digits (GEN = 01, REV = 66)
 *   CCC = chapter number zero-padded to 3 digits
 *   VVV = verse number zero-padded to 3 digits (verse-level links only)
 */

const JW_LINK_BASE_URL = 'https://www.jw.org/finder' as const;
const JW_LINK_PARAMS_PREFIX = '?wtlocale=E&bible=' as const;
const JW_LINK_PARAMS_SUFFIX = '&pub=nwt' as const;

/**
 * USFM code → canonical Bible book number (sort_order, 1–66).
 *
 * This mapping is the authoritative source for the {BB} segment of the jw.org URL.
 * It mirrors the sort_order column in the books table.
 * Never use the database sort_order at runtime — use this constant.
 */
export const USFM_TO_BOOK_NUM: Record<string, number> = {
  GEN: 1,  EXO: 2,  LEV: 3,  NUM: 4,  DEU: 5,
  JOS: 6,  JDG: 7,  RUT: 8,  '1SA': 9, '2SA': 10,
  '1KI': 11, '2KI': 12, '1CH': 13, '2CH': 14, EZR: 15,
  NEH: 16, EST: 17, JOB: 18, PSA: 19, PRO: 20,
  ECC: 21, SNG: 22, ISA: 23, JER: 24, LAM: 25,
  EZK: 26, DAN: 27, HOS: 28, JOL: 29, AMO: 30,
  OBA: 31, JON: 32, MIC: 33, NAM: 34, HAB: 35,
  ZEP: 36, HAG: 37, ZEC: 38, MAL: 39,
  MAT: 40, MRK: 41, LUK: 42, JHN: 43, ACT: 44,
  ROM: 45, '1CO': 46, '2CO': 47, GAL: 48, EPH: 49,
  PHP: 50, COL: 51, '1TH': 52, '2TH': 53, '1TI': 54,
  '2TI': 55, TIT: 56, PHM: 57, HEB: 58, JAS: 59,
  '1PE': 60, '2PE': 61, '1JN': 62, '2JN': 63, '3JN': 64,
  JUD: 65, REV: 66,
};

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function pad3(n: number): string {
  return n.toString().padStart(3, '0');
}

function resolveBookNum(usfmCode: string): number {
  const normalised = usfmCode.toUpperCase();
  const bookNum = USFM_TO_BOOK_NUM[normalised];
  if (bookNum === undefined) {
    throw new Error(
      `Unknown USFM code: "${usfmCode}". Cannot build jw.org link. Check USFM_TO_BOOK_NUM in jwLink.ts.`,
    );
  }
  return bookNum;
}

/**
 * buildJwLink
 *
 * Builds a chapter-level jw.org deep-link.
 * Format: https://www.jw.org/finder?wtlocale=E&bible={BB}{CCC}&pub=nwt
 *
 * @param usfmCode - USFM book code (case-insensitive, e.g. "GEN" or "gen")
 * @param chapterNumber - Chapter number (1-based)
 * @returns Full jw.org URL
 * @throws Error if USFM code is unrecognised
 */
export function buildJwLink(usfmCode: string, chapterNumber: number): string {
  const bookNum = resolveBookNum(usfmCode);
  const bible = `${pad2(bookNum)}${pad3(chapterNumber)}`;
  return `${JW_LINK_BASE_URL}${JW_LINK_PARAMS_PREFIX}${bible}${JW_LINK_PARAMS_SUFFIX}`;
}

/**
 * buildJwVerseLink
 *
 * Builds a verse-level jw.org deep-link (for continue reading).
 * Format: https://www.jw.org/finder?wtlocale=E&bible={BB}{CCC}{VVV}&pub=nwt
 *
 * @param usfmCode - USFM book code (case-insensitive)
 * @param chapterNumber - Chapter number (1-based)
 * @param verseNumber - Verse number (1-based)
 * @returns Full jw.org URL
 * @throws Error if USFM code is unrecognised
 */
export function buildJwVerseLink(
  usfmCode: string,
  chapterNumber: number,
  verseNumber: number,
): string {
  const bookNum = resolveBookNum(usfmCode);
  const bible = `${pad2(bookNum)}${pad3(chapterNumber)}${pad3(verseNumber)}`;
  return `${JW_LINK_BASE_URL}${JW_LINK_PARAMS_PREFIX}${bible}${JW_LINK_PARAMS_SUFFIX}`;
}
