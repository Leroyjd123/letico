import type { PlanDayView } from '@lectio/types';
import {
  applyToDay,
  chapterReadState,
  dayCompletionPct,
  dayUnreadVerseIds,
  firstUnfinishedChapter,
} from '../lib/planDay';

const day: PlanDayView = {
  planId: 'p', dayNumber: 1, totalDays: 365, label: 'genesis 1–2', book: 'GEN', chapter: 1,
  startVerse: 1, endVerse: 2, startVerseId: 1, endVerseId: 5, totalVerses: 5, versesRead: 1,
  isToday: true, offsetFromToday: 0,
  chapters: [
    { chapterId: 1, chapterNumber: 1, book: 'GEN', bookName: 'Genesis', verseIds: [1, 2, 3], verseNumbers: [1, 2, 3], readVerseIds: [2] },
    { chapterId: 2, chapterNumber: 2, book: 'GEN', bookName: 'Genesis', verseIds: [4, 5], verseNumbers: [1, 2], readVerseIds: [] },
  ],
};

describe('planDay helpers', () => {
  it('derives per-chapter state from that chapter only', () => {
    expect(day.chapters.map(chapterReadState)).toEqual(['partial', 'unread']);
  });

  it('lists only unread verses of the day', () => {
    expect(dayUnreadVerseIds(day)).toEqual([1, 3, 4, 5]);
  });

  it('computes completion from verses, not verse ids arithmetic', () => {
    expect(dayCompletionPct(day)).toBe(20);
  });

  it('applies marks and unmarks without mutating the input', () => {
    const marked = applyToDay(day, 'mark', [1, 3, 999]);
    expect(marked.chapters[0]!.readVerseIds).toEqual([1, 2, 3]);
    expect(chapterReadState(marked.chapters[0]!)).toBe('read');
    expect(marked.versesRead).toBe(3);
    expect(day.chapters[0]!.readVerseIds).toEqual([2]);

    const unmarked = applyToDay(marked, 'unmark', [2]);
    expect(unmarked.chapters[0]!.readVerseIds).toEqual([1, 3]);
  });

  it('points jw.org at the first chapter with something left', () => {
    expect(firstUnfinishedChapter(day)!.chapterId).toBe(1);
    const firstDone = applyToDay(day, 'mark', [1, 3]);
    expect(firstUnfinishedChapter(firstDone)!.chapterId).toBe(2);
  });
});
