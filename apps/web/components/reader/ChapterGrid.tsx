/**
 * ChapterGrid.tsx
 *
 * Asymmetric bento grid of ChapterTile components.
 * 4-column base. The "upcoming reflection" card spans 2 columns and
 * creates intentional visual asymmetry in the grid.
 */
import type { CSSProperties, ReactNode } from 'react';
import { ChapterTile, type ReadState } from './ChapterTile';

export interface ChapterGridItem {
  chapterId: number;
  chapterNumber: number;
  readState: ReadState;
}

interface ChapterGridProps {
  chapters: ChapterGridItem[];
  onTap: (item: ChapterGridItem) => void;
  onLongPress: (item: ChapterGridItem) => void;
  /** Optional label for the "upcoming" reflection card that creates the bento asymmetry */
  upcomingLabel?: string;
}

const REFLECTION_INSERT_AFTER = 7; // Insert the reflection card after tile #7 (0-indexed)

export function ChapterGrid({
  chapters,
  onTap,
  onLongPress,
  upcomingLabel,
}: ChapterGridProps) {
  const gridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 'var(--space-2)',
  };

  const reflectionCardStyle: CSSProperties = {
    gridColumn: 'span 2',
    backgroundColor: 'var(--color-primary-fixed)',
    borderRadius: 'var(--radius-md)',
    padding: 'var(--space-3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    aspectRatio: 'auto',
    minHeight: '3rem',
  };

  const items: ReactNode[] = [];

  chapters.forEach((chapter, idx) => {
    items.push(
      <ChapterTile
        key={chapter.chapterId}
        chapterNumber={chapter.chapterNumber}
        readState={chapter.readState}
        onTap={() => onTap(chapter)}
        onLongPress={() => onLongPress(chapter)}
      />,
    );

    // Insert reflection card after the designated tile
    if (idx === REFLECTION_INSERT_AFTER && upcomingLabel) {
      items.push(
        <div key="reflection" style={reflectionCardStyle} aria-label="upcoming reflection">
          <p
            style={{
              fontFamily: 'var(--font-headline)',
              fontSize: '0.75rem',
              fontWeight: 500,
              color: 'var(--color-primary)',
              textTransform: 'lowercase',
              textAlign: 'center',
              margin: 0,
            }}
          >
            {upcomingLabel}
          </p>
        </div>,
      );
    }
  });

  return (
    <div style={gridStyle} role="list" aria-label="chapters in today's reading">
      {items}
    </div>
  );
}
