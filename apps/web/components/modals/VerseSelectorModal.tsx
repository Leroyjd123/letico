'use client';
/**
 * VerseSelectorModal.tsx
 *
 * Centered modal for selecting a verse range within a chapter.
 * Two inputs (one hidden beneath the other) provide dual-thumb behaviour.
 * A verse bubble row (≤30 verses) or dot grid (>30 verses) visualises state.
 *
 * Entry: opacity 0 + scale(0.96) → opacity 1 + scale(1), 280ms.
 * Exit: opacity 1 → opacity 0, 200ms.
 * Overlay: rgba(250,249,246,0.85) with backdrop-filter blur(12px).
 */
import {
  useState,
  useEffect,
  useRef,
  type CSSProperties,
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent,
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
  onExited: () => void;
}

const EXIT_TRANSITION_MS = 200;

export function VerseSelectorModal({
  isOpen,
  chapterName,
  totalVerses,
  readVerseNumbers,
  onMarkFull,
  onSaveRange,
  onClose,
  onExited,
}: VerseSelectorModalProps) {
  const [startVerse, setStartVerse] = useState(1);
  const [endVerse, setEndVerse] = useState(totalVerses);
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [visible, setVisible] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Escape key to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Reset range when modal opens for a new chapter
  useEffect(() => {
    let focusTimeout: ReturnType<typeof setTimeout> | null = null;

    if (isOpen) {
      setShouldRender(true);
      setStartVerse(1);
      setEndVerse(totalVerses);
      setVisible(true);
      // Focus the sheet on next tick so screen readers announce the dialog
      focusTimeout = setTimeout(() => sheetRef.current?.focus(), 50);
    } else {
      setVisible(false);
    }

    return () => {
      if (focusTimeout !== null) clearTimeout(focusTimeout);
    };
  }, [isOpen, totalVerses]);

  useEffect(() => {
    if (isOpen) return;
    if (!shouldRender) return;

    const timeout = setTimeout(() => {
      setShouldRender(false);
      onExited();
    }, EXIT_TRANSITION_MS);

    return () => clearTimeout(timeout);
  }, [isOpen, shouldRender, onExited]);

  function handleSheetKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Tab') return;
    const focusable = sheetRef.current?.querySelectorAll<HTMLElement>(
      'button, input, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable || focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  function handleStartChange(e: ChangeEvent<HTMLInputElement>) {
    const val = Number(e.target.value);
    setStartVerse(Math.min(val, endVerse));
  }

  function handleEndChange(e: ChangeEvent<HTMLInputElement>) {
    const val = Number(e.target.value);
    setEndVerse(Math.max(val, startVerse));
  }

  function handleOverlayClick(e: MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) onClose();
  }

  // Tapping a verse bubble/dot selects it directly; shift-tap extends the
  // current selection into a range. Complements the slider for precise picks.
  function handleVerseClick(verseNum: number, shiftKey: boolean) {
    if (shiftKey) {
      setStartVerse(Math.min(startVerse, verseNum));
      setEndVerse(Math.max(endVerse, verseNum));
    } else {
      setStartVerse(verseNum);
      setEndVerse(verseNum);
    }
  }

  function handleSave() {
    onSaveRange(startVerse, endVerse);
  }

  function handleMarkFull() {
    onMarkFull();
  }

  if (!shouldRender) return null;

  const overlayStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 50,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'var(--space-4)',
  };

  const sheetStyle: CSSProperties = {
    width: '100%',
    backgroundColor: 'var(--color-bg-elevated)',
    borderRadius: 'var(--radius-xl)',
    padding: 'var(--space-8)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-6)',
    opacity: visible ? 1 : 0,
    transform: visible ? 'scale(1)' : 'scale(0.96)',
    transition: `opacity ${visible ? '280ms' : '200ms'} var(--easing-standard), transform ${visible ? '280ms' : '200ms'} var(--easing-standard)`,
    maxHeight: '90vh',
    overflowY: 'auto',
    boxShadow: 'var(--shadow-floating)',
  };

  const rangeWrapStyle: CSSProperties = {
    position: 'relative',
    height: '2rem',
    display: 'flex',
    alignItems: 'center',
  };

  const rangeInputBase: CSSProperties = {
    position: 'absolute',
    top: 0,
    width: '100%',
    height: '100%',
    appearance: 'none' as const,
    WebkitAppearance: 'none' as const,
    background: 'transparent',
    outline: 'none',
    pointerEvents: 'none',
    cursor: 'pointer',
    touchAction: 'none',
  };

  const selectedCount = endVerse - startVerse + 1;
  const showBubbles = totalVerses <= 30;

  return (
    <>
      {/* Range input styles live in globals.css */}

      <div
        ref={overlayRef}
        style={overlayStyle}
        onClick={handleOverlayClick}
        role="dialog"
        aria-modal="true"
        aria-labelledby="verse-selector-heading"
        aria-describedby="verse-selector-preview"
        className="verse-selector-overlay"
      >
        <div
          ref={sheetRef}
          style={sheetStyle}
          tabIndex={-1}
          onKeyDown={handleSheetKeyDown}
          className="verse-selector-sheet"
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2
                id="verse-selector-heading"
                style={{
                  fontFamily: 'var(--font-headline)',
                  fontSize: '1.5rem',
                  fontWeight: 300,
                  color: 'var(--color-primary)',
                  textTransform: 'lowercase',
                  margin: 0,
                  letterSpacing: '-0.01em',
                }}
              >
                verse selector
              </h2>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.8125rem',
                  color: 'var(--color-text-muted)',
                  textTransform: 'lowercase',
                  marginTop: 'var(--space-1)',
                  letterSpacing: '0.02em',
                }}
              >
                the tactile pause · selecting focus
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="close"
              style={{
                background: 'var(--color-bg-surface)',
                border: 'none',
                cursor: 'pointer',
                padding: 'var(--space-2)',
                color: 'var(--color-text-muted)',
                fontSize: '1rem',
                lineHeight: 1,
                borderRadius: 'var(--radius-full)',
                width: '2rem',
                height: '2rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'background-color var(--duration-base)',
              }}
            >
              ✕
            </button>
          </div>

          {/* Info grid — chapter name + selected range */}
          <div
            style={{}}
            className="verse-selector-meta-grid"
          >
            <div>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.6875rem',
                  fontWeight: 500,
                  color: 'var(--color-text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  marginBottom: 'var(--space-1)',
                }}
              >
                current chapter
              </p>
              <p
                style={{
                  fontFamily: 'var(--font-headline)',
                  fontSize: '1.875rem',
                  fontWeight: 300,
                  color: 'var(--color-text-primary)',
                  textTransform: 'lowercase',
                  lineHeight: 1.1,
                }}
              >
                {chapterName}
              </p>
            </div>
            <div>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.6875rem',
                  fontWeight: 500,
                  color: 'var(--color-text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  marginBottom: 'var(--space-1)',
                }}
              >
                selected range
              </p>
              <p
                style={{
                  fontFamily: 'var(--font-headline)',
                  fontSize: '1.875rem',
                  fontWeight: 300,
                  color: 'var(--color-text-primary)',
                  textTransform: 'lowercase',
                  lineHeight: 1.1,
                }}
              >
                v. {startVerse} — {endVerse}
              </p>
            </div>
          </div>

          {/* Range container */}
          <div
            style={{
              backgroundColor: 'var(--color-bg-surface)',
              borderRadius: 'var(--radius-xl)',
              padding: 'var(--space-6)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-4)',
            }}
          >
            {/* Labels row */}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.6875rem',
                  fontWeight: 500,
                  color: 'var(--color-text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                }}
              >
                start verse
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.6875rem',
                  fontWeight: 500,
                  color: 'var(--color-text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                }}
              >
                end verse
              </span>
            </div>

            {/* Dual-thumb range slider */}
            <div>
              <div
                style={{
                  height: '4px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--color-bg-elevated)',
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

            {/* Verse bubbles or dot grid */}
            {showBubbles ? (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 'var(--space-2)',
                }}
                aria-label="verse grid"
                role="img"
              >
                {Array.from({ length: totalVerses }, (_, i) => {
                  const verseNum = i + 1;
                  const isRead = readVerseNumbers.has(verseNum);
                  const isSelected = verseNum >= startVerse && verseNum <= endVerse;

                  const bg = isRead
                    ? 'var(--color-primary)'
                    : isSelected
                    ? 'rgba(77,97,79,0.35)'
                    : 'var(--color-bg-elevated)';

                  const color = isRead
                    ? 'var(--color-on-primary)'
                    : isSelected
                    ? 'var(--color-primary)'
                    : 'var(--color-text-muted)';

                  return (
                    <button
                      key={verseNum}
                      type="button"
                      onClick={(e) => handleVerseClick(verseNum, e.shiftKey)}
                      title={`verse ${verseNum}`}
                      aria-label={`verse ${verseNum}${isRead ? ', read' : ''}${isSelected ? ', selected' : ''}`}
                      aria-pressed={isSelected}
                      style={{
                        width: '2.5rem',
                        height: '2.5rem',
                        borderRadius: 'var(--radius-full)',
                        backgroundColor: bg,
                        color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: 'var(--font-headline)',
                        fontSize: '0.75rem',
                        fontWeight: isRead ? 600 : 400,
                        cursor: 'pointer',
                        padding: 0,
                        transition: `background-color var(--duration-fast) var(--easing-standard), color var(--duration-fast) var(--easing-standard)`,
                        border: isRead || isSelected ? 'none' : '1px solid var(--color-outline)',
                      }}
                    >
                      {verseNum}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(6, 1fr)',
                  gap: 'var(--space-1)',
                }}
                aria-label="verse grid"
                role="img"
              >
                {Array.from({ length: totalVerses }, (_, i) => {
                  const verseNum = i + 1;
                  const isRead = readVerseNumbers.has(verseNum);
                  const isSelected = verseNum >= startVerse && verseNum <= endVerse;

                  const dotColor = isRead
                    ? 'var(--color-primary)'
                    : isSelected
                    ? 'rgba(77,97,79,0.45)'
                    : 'var(--color-bg-elevated)';

                  return (
                    <button
                      key={verseNum}
                      type="button"
                      onClick={(e) => handleVerseClick(verseNum, e.shiftKey)}
                      title={`verse ${verseNum}`}
                      aria-label={`verse ${verseNum}${isRead ? ', read' : ''}${isSelected ? ', selected' : ''}`}
                      aria-pressed={isSelected}
                      style={{
                        aspectRatio: '1',
                        minHeight: '1.75rem',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: dotColor,
                        color: isRead ? 'var(--color-on-primary)' : 'var(--color-text-muted)',
                        fontFamily: 'var(--font-body)',
                        fontSize: '0.625rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        padding: 0,
                        transition: `background-color var(--duration-fast) var(--easing-standard)`,
                        border: isRead || isSelected ? 'none' : '1px solid var(--color-outline)',
                      }}
                    >
                      {verseNum}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Total selection count */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.8125rem',
                  color: 'var(--color-text-secondary)',
                  textTransform: 'lowercase',
                }}
              >
                total selection: <strong style={{ color: 'var(--color-text-primary)' }}>{selectedCount}</strong> {selectedCount === 1 ? 'verse' : 'verses'}
              </span>
            </div>
          </div>

          {/* Preview section */}
          <div
            style={{
              borderTop: '1px solid var(--color-outline)',
              paddingTop: 'var(--space-4)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              {/* Book icon SVG */}
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.25" fill="none"/>
                <line x1="4" y1="4" x2="10" y2="4" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                <line x1="4" y1="6.5" x2="10" y2="6.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                <line x1="4" y1="9" x2="7" y2="9" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
              </svg>
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.6875rem',
                  fontWeight: 500,
                  color: 'var(--color-text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                }}
              >
                preview
              </span>
            </div>
            <p
              id="verse-selector-preview"
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '0.875rem',
                fontStyle: 'italic',
                color: 'var(--color-text-muted)',
                textTransform: 'lowercase',
                lineHeight: 1.6,
              }}
            >
              {chapterName} · verses {startVerse}–{endVerse} · select verses to mark your reading progress.
            </p>
          </div>

          {/* Action buttons */}
          <div
            style={{}}
            className="verse-selector-actions"
          >
            {/* Mark full chapter — left side */}
            <button
              onClick={handleMarkFull}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                fontFamily: 'var(--font-headline)',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: 'var(--color-primary)',
                textTransform: 'lowercase',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-full)',
                transition: 'background-color var(--duration-base)',
              }}
            >
              {/* done_all icon — double check SVG */}
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M1 8l3.5 3.5L11 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M5 8l3.5 3.5L15 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              mark full chapter
            </button>

            {/* Cancel + Save — right side */}
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <Button variant="ghost" size="md" onClick={onClose}>
                cancel
              </Button>
              <Button variant="primary" size="md" onClick={handleSave}>
                save selection
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
