'use client';
/**
 * VerseSelectorModal.tsx
 *
 * Slide-up modal for selecting a verse range within a chapter.
 * Two inputs (one hidden beneath the other) provide dual-thumb behaviour.
 * A 6-column verse dot grid visualises read/selected/unread state in real time.
 *
 * Entry: translateY(100%) → translateY(0), 280ms.
 * Exit: translateY(0) → translateY(100%), 200ms.
 * Overlay: rgba(27,28,26,0.25) with backdrop-filter blur(2px).
 */
import {
  useState,
  useEffect,
  useRef,
  type CSSProperties,
  type ChangeEvent,
} from 'react';
import { Button } from '../ui/Button';

interface VerseSelectorModalProps {
  isOpen: boolean;
  chapterName: string;
  totalVerses: number;
  readVerseNumbers: Set<number>; // 1-based verse numbers already read
  onMarkFull: () => void;
  onSaveRange: (startVerse: number, endVerse: number) => void;
  onClose: () => void;
}

export function VerseSelectorModal({
  isOpen,
  chapterName,
  totalVerses,
  readVerseNumbers,
  onMarkFull,
  onSaveRange,
  onClose,
}: VerseSelectorModalProps) {
  const [startVerse, setStartVerse] = useState(1);
  const [endVerse, setEndVerse] = useState(totalVerses);
  const [visible, setVisible] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Reset range when modal opens for a new chapter
  useEffect(() => {
    if (isOpen) {
      setStartVerse(1);
      setEndVerse(totalVerses);
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [isOpen, totalVerses]);

  function handleStartChange(e: ChangeEvent<HTMLInputElement>) {
    const val = Number(e.target.value);
    setStartVerse(Math.min(val, endVerse));
  }

  function handleEndChange(e: ChangeEvent<HTMLInputElement>) {
    const val = Number(e.target.value);
    setEndVerse(Math.max(val, startVerse));
  }

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) onClose();
  }

  function handleSave() {
    onSaveRange(startVerse, endVerse);
    onClose();
  }

  function handleMarkFull() {
    onMarkFull();
    onClose();
  }

  if (!isOpen && !visible) return null;

  const overlayStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(27,28,26,0.25)',
    backdropFilter: 'blur(2px)',
    WebkitBackdropFilter: 'blur(2px)',
    zIndex: 50,
    display: 'flex',
    alignItems: 'flex-end',
  };

  const sheetStyle: CSSProperties = {
    width: '100%',
    backgroundColor: 'var(--color-bg-elevated)',
    borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
    padding: 'var(--space-6)',
    paddingBottom: 'max(var(--space-8), env(safe-area-inset-bottom, 0px))',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-5)',
    transform: visible ? 'translateY(0)' : 'translateY(100%)',
    transition: `transform ${visible ? '280ms' : '200ms'} var(--easing-standard)`,
    maxHeight: '85vh',
    overflowY: 'auto',
  };

  const dotGridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 1fr)',
    gap: 'var(--space-1)',
  };

  const rangeWrapStyle: CSSProperties = {
    position: 'relative',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
  };

  const rangeInputBase: CSSProperties = {
    position: 'absolute',
    width: '100%',
    height: '4px',
    appearance: 'none' as const,
    WebkitAppearance: 'none' as const,
    background: 'transparent',
    outline: 'none',
    pointerEvents: 'none',
  };

  return (
    <>
      {/* Inject range input styles once */}
      <style>{`
        .verse-range-input::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: var(--color-primary);
          cursor: pointer;
          pointer-events: all;
          border: 2px solid white;
          box-shadow: 0 1px 4px rgba(0,0,0,0.18);
        }
        .verse-range-input::-moz-range-thumb {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: var(--color-primary);
          cursor: pointer;
          pointer-events: all;
          border: 2px solid white;
          box-shadow: 0 1px 4px rgba(0,0,0,0.18);
        }
      `}</style>

      <div
        ref={overlayRef}
        style={overlayStyle}
        onClick={handleOverlayClick}
        role="dialog"
        aria-modal="true"
        aria-label={`select verses in ${chapterName}`}
      >
        <div style={sheetStyle}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3
              style={{
                fontFamily: 'var(--font-headline)',
                fontSize: '1.125rem',
                fontWeight: 600,
                color: 'var(--color-text-primary)',
                textTransform: 'lowercase',
                margin: 0,
              }}
            >
              {chapterName}
            </h3>
            <button
              onClick={onClose}
              aria-label="close"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 'var(--space-1)',
                color: 'var(--color-text-muted)',
                fontSize: '1.25rem',
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>

          {/* Range label */}
          <p
            style={{
              fontFamily: 'var(--font-headline)',
              fontSize: '0.875rem',
              color: 'var(--color-text-secondary)',
              textTransform: 'lowercase',
              margin: 0,
            }}
          >
            verses {startVerse}–{endVerse}
          </p>

          {/* Dual-thumb range slider */}
          <div>
            <div
              style={{
                height: '4px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--color-bg-surface)',
                marginBottom: 'var(--space-3)',
                position: 'relative',
              }}
            >
              {/* Filled track between thumbs */}
              <div
                style={{
                  position: 'absolute',
                  height: '100%',
                  backgroundColor: 'var(--color-primary)',
                  borderRadius: 'var(--radius-full)',
                  left: `${((startVerse - 1) / Math.max(totalVerses - 1, 1)) * 100}%`,
                  right: `${((totalVerses - endVerse) / Math.max(totalVerses - 1, 1)) * 100}%`,
                }}
              />
            </div>
            <div style={rangeWrapStyle}>
              <input
                type="range"
                min={1}
                max={totalVerses}
                value={startVerse}
                onChange={handleStartChange}
                className="verse-range-input"
                style={{ ...rangeInputBase, zIndex: startVerse > totalVerses / 2 ? 5 : 3 }}
                aria-label="start verse"
              />
              <input
                type="range"
                min={1}
                max={totalVerses}
                value={endVerse}
                onChange={handleEndChange}
                className="verse-range-input"
                style={{ ...rangeInputBase, zIndex: startVerse > totalVerses / 2 ? 3 : 5 }}
                aria-label="end verse"
              />
            </div>
          </div>

          {/* Verse dot grid */}
          <div style={dotGridStyle} aria-label="verse grid" role="img">
            {Array.from({ length: totalVerses }, (_, i) => {
              const verseNum = i + 1;
              const isRead = readVerseNumbers.has(verseNum);
              const isSelected = verseNum >= startVerse && verseNum <= endVerse;

              const dotColor = isRead
                ? 'var(--color-primary)'
                : isSelected
                ? 'rgba(77,97,79,0.45)'
                : 'var(--color-bg-surface)';

              return (
                <div
                  key={verseNum}
                  title={`verse ${verseNum}`}
                  style={{
                    aspectRatio: '1',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: dotColor,
                    transition: `background-color var(--duration-fast) var(--easing-standard)`,
                    border: isRead || isSelected ? 'none' : '1px solid var(--color-outline)',
                  }}
                />
              );
            })}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <Button variant="primary" size="lg" fullWidth onClick={handleMarkFull}>
              mark full chapter
            </Button>
            <Button variant="ghost" size="lg" fullWidth onClick={handleSave}>
              save selected range (v{startVerse}–{endVerse})
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
