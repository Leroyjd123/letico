/**
 * jwLink.test.ts — 100% branch coverage for jwLink.ts
 *
 * Written FIRST (TDD). Verified example: Genesis 1 → bible=01001.
 * Run: pnpm test apps/web/__tests__/jwLink.test.ts
 */

import { buildJwLink, buildJwVerseLink } from '../lib/jwLink';

describe('buildJwLink', () => {
  it('builds the correct URL for Genesis chapter 1 (verified example: 01001)', () => {
    const url = buildJwLink('GEN', 1);
    expect(url).toBe('https://www.jw.org/finder?wtlocale=E&bible=01001&pub=nwt');
  });

  it('builds the correct URL for Revelation chapter 22 (last book, last chapter)', () => {
    const url = buildJwLink('REV', 22);
    expect(url).toBe('https://www.jw.org/finder?wtlocale=E&bible=66022&pub=nwt');
  });

  it('pads single-digit chapter numbers to 3 digits', () => {
    const url = buildJwLink('MAT', 5);
    expect(url).toBe('https://www.jw.org/finder?wtlocale=E&bible=40005&pub=nwt');
  });

  it('handles double-digit chapter numbers correctly', () => {
    const url = buildJwLink('GEN', 12);
    expect(url).toBe('https://www.jw.org/finder?wtlocale=E&bible=01012&pub=nwt');
  });

  it('handles triple-digit chapter numbers correctly (Psalms 119)', () => {
    const url = buildJwLink('PSA', 119);
    expect(url).toBe('https://www.jw.org/finder?wtlocale=E&bible=19119&pub=nwt');
  });

  it('accepts lowercase USFM code (normalises to uppercase)', () => {
    const url = buildJwLink('gen', 1);
    expect(url).toBe('https://www.jw.org/finder?wtlocale=E&bible=01001&pub=nwt');
  });

  it('throws a descriptive error for unknown USFM codes (never silently produces broken link)', () => {
    expect(() => buildJwLink('XYZ', 1)).toThrow(/unknown.*usfm/i);
  });
});

describe('buildJwVerseLink', () => {
  it('builds verse-level URL with 8-digit bible param (01001001 for Gen 1:1)', () => {
    const url = buildJwVerseLink('GEN', 1, 1);
    expect(url).toBe('https://www.jw.org/finder?wtlocale=E&bible=01001001&pub=nwt');
  });

  it('pads verse number to 3 digits', () => {
    const url = buildJwVerseLink('GEN', 1, 31);
    expect(url).toBe('https://www.jw.org/finder?wtlocale=E&bible=01001031&pub=nwt');
  });

  it('throws for unknown USFM code', () => {
    expect(() => buildJwVerseLink('XYZ', 1, 1)).toThrow(/unknown.*usfm/i);
  });
});
