/**
 * planDay.ts — pure helpers over the PlanDayView returned by the API.
 * All chapter/day read state is derived here so it can be unit-tested.
 */
import type { PlanDayChapter, PlanDayView } from '@lectio/types';

export type ChapterReadState = 'read' | 'partial' | 'unread';

export function chapterReadState(chapter: PlanDayChapter): ChapterReadState {
  const read = chapter.readVerseIds.length;
  if (read === 0) return 'unread';
  return read >= chapter.verseIds.length ? 'read' : 'partial';
}

export function unreadVerseIds(chapter: PlanDayChapter): number[] {
  const read = new Set(chapter.readVerseIds);
  return chapter.verseIds.filter((id) => !read.has(id));
}

export function dayUnreadVerseIds(day: PlanDayView): number[] {
  return day.chapters.flatMap(unreadVerseIds);
}

export function dayCompletionPct(day: PlanDayView): number {
  const total = day.chapters.reduce((n, c) => n + c.verseIds.length, 0);
  const read = day.chapters.reduce((n, c) => n + c.readVerseIds.length, 0);
  return total > 0 ? Math.min(100, Math.round((read / total) * 100)) : 0;
}

/** First chapter of the day with something left to read (or the first chapter). */
export function firstUnfinishedChapter(day: PlanDayView): PlanDayChapter | undefined {
  return day.chapters.find((c) => chapterReadState(c) !== 'read') ?? day.chapters[0];
}

/**
 * Returns a copy of the day with the given verses marked read or unread.
 * Used for optimistic updates — verses outside the day are ignored.
 */
export function applyToDay(day: PlanDayView, op: 'mark' | 'unmark', verseIds: number[]): PlanDayView {
  const changed = new Set(verseIds);
  const chapters = day.chapters.map((c) => {
    if (!c.verseIds.some((id) => changed.has(id))) return c;
    const read = new Set(c.readVerseIds);
    for (const id of c.verseIds) {
      if (!changed.has(id)) continue;
      if (op === 'mark') read.add(id);
      else read.delete(id);
    }
    return { ...c, readVerseIds: c.verseIds.filter((id) => read.has(id)) };
  });
  return {
    ...day,
    chapters,
    versesRead: chapters.reduce((n, c) => n + c.readVerseIds.length, 0),
  };
}
