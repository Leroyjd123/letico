import { resolveTimeZone, localDate, daysBetween, todayDayNumber } from './time-zone';

describe('time-zone helpers', () => {
  it('accepts valid IANA zones and falls back to UTC otherwise', () => {
    expect(resolveTimeZone('Asia/Kolkata')).toBe('Asia/Kolkata');
    expect(resolveTimeZone('Not/AZone')).toBe('UTC');
    expect(resolveTimeZone(undefined)).toBe('UTC');
    expect(resolveTimeZone(['Asia/Kolkata'])).toBe('UTC');
  });

  it('computes the local calendar date, not the UTC one', () => {
    const at = new Date('2026-03-01T20:00:00Z'); // 01:30 on Mar 2 in India, noon Mar 1 in LA
    expect(localDate('UTC', at)).toBe('2026-03-01');
    expect(localDate('Asia/Kolkata', at)).toBe('2026-03-02');
    expect(localDate('America/Los_Angeles', at)).toBe('2026-03-01');
  });

  it('counts whole days between dates', () => {
    expect(daysBetween('2026-01-01', '2026-01-01')).toBe(0);
    expect(daysBetween('2026-01-01', '2026-03-01')).toBe(59);
  });

  it('computes today day number in the reader zone and clamps to plan length', () => {
    const at = new Date('2026-01-01T20:00:00Z');
    expect(todayDayNumber(null, 'UTC', 365, at)).toBe(1);
    expect(todayDayNumber('2026-01-01', 'UTC', 365, at)).toBe(1);
    expect(todayDayNumber('2026-01-01', 'Asia/Kolkata', 365, at)).toBe(2);
    expect(todayDayNumber('2027-06-01', 'UTC', 365, at)).toBe(1);      // future start
    expect(todayDayNumber('2020-01-01', 'UTC', 730, at)).toBe(730);   // past the end of a 730-day plan
  });
});
