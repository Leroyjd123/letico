/**
 * ChapterGrid.tsx
 *
 * Tiles for exactly the chapters in the day's reading. When a day crosses a
 * book boundary (e.g. "deuteronomy 34 · matthew 1") each book gets its own
 * small heading so the second book is visible and markable.
 */
import type { CSSProperties } from 'react';
import { ChapterTile, type ReadState } from './ChapterTile';

export interface ChapterGridItem {
  chapterId: number;
  chapterNumber: number;
  book: string;
  bookName: string;
  readState: ReadState;
}

interface ChapterGridProps {
  chapters: ChapterGridItem[];
  onTap: (item: ChapterGridItem) => void;
  onLongPress: (item: ChapterGridItem) => void;
}

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: 'var(--space-2)',
};

const bookHeadingStyle: CSSProperties = {
  fontFamily: 'var(--font-headline)',
  fontSize: '0.75rem',
  color: 'var(--color-text-muted)',
  textTransform: 'lowercase',
  letterSpacing: '0.04em',
  margin: '0 0 var(--space-2)',
};

export function ChapterGrid({ chapters, onTap, onLongPress }: ChapterGridProps) {
  const groups: Array<{ book: string; bookName: string; items: ChapterGridItem[] }> = [];
  for (const c of chapters) {
    const last = groups[groups.length - 1];
    if (last && last.book === c.book) last.items.push(c);
    else groups.push({ book: c.book, bookName: c.bookName, items: [c] });
  }
  const multiBook = groups.length > 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {groups.map((g) => (
        <div key={g.book} role="group" aria-label={`${g.bookName.toLowerCase()} chapters in this reading`}>
          {multiBook && <p style={bookHeadingStyle}>{g.bookName.toLowerCase()}</p>}
          <div style={gridStyle}>
            {g.items.map((item) => (
              <ChapterTile
                key={item.chapterId}
                chapterNumber={item.chapterNumber}
                label={`${item.bookName.toLowerCase()} ${item.chapterNumber}`}
                readState={item.readState}
                onTap={() => onTap(item)}
                onLongPress={() => onLongPress(item)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
