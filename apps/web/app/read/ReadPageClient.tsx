'use client';
/**
 * ReadPageClient.tsx
 *
 * Client shell for the /read page.
 *
 * Data flow:
 *   1. useAuthContext() → { auth, isProvisioning } (auto-provisions guest on first visit)
 *   2. useOfflineQueue(auth) → flush pending reads + show failure banner
 *   3. useQuery ['plan','today'] → PlanDayView
 *   4. useQuery ['bible','chapters', book] → Chapter[]
 *   5. useQuery ['progress','reads'] → number[] (read verse IDs in today's range)
 *   6. useContinueReading → ContinuePosition | null
 *
 * Guest backup nudge: shown once per session after ≥ 10 chapters are marked read.
 *
 * Architectural invariants:
 *   - All writes go through useVerseRead → POST /progress/verses (or offline queue)
 *   - Never renders Bible text inline (R7)
 *   - No gamification, no pressure language (R3, R4)
 */
import { useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { PlanDayView, Chapter, MeResult } from '@lectio/types';
import { getPlanToday, getChapters, getMe } from '../../lib/api';
import { logger } from '../../lib/logger';
import type { AuthContext } from '../../lib/api';
import { useAuthContext } from '../../components/providers/AuthProvider';
import { useVerseRead } from '../../hooks/useVerseRead';
import { useOfflineQueue } from '../../hooks/useOfflineQueue';
import { useContinueReading } from '../../hooks/useContinueReading';
import { TodayCard } from '../../components/reader/TodayCard';
import { ChapterGrid, type ChapterGridItem } from '../../components/reader/ChapterGrid';
import { VerseSelectorModal } from '../../components/modals/VerseSelectorModal';
import { OpenInJWButton } from '../../components/reader/OpenInJWButton';
import { ContinuePill } from '../../components/reader/ContinuePill';
import { GuestBackupNudge, shouldShowNudge } from '../../components/reader/GuestBackupNudge';
import type { ReadState } from '../../components/reader/ChapterTile';

const BASE_URL =
  (typeof process !== 'undefined' ? process.env['NEXT_PUBLIC_API_BASE_URL'] : undefined) ??
  'http://localhost:4000/api';

async function fetchReadVerseIds(
  startVerseId: number,
  endVerseId: number,
  auth: AuthContext,
): Promise<number[]> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth.type === 'bearer') headers['Authorization'] = `Bearer ${auth.token}`;
  else headers['X-Guest-Token'] = auth.guestToken;

  const res = await fetch(
    `${BASE_URL}/progress/reads?startVerseId=${startVerseId}&endVerseId=${endVerseId}`,
    { headers },
  );
  if (!res.ok) return [];
  const json = (await res.json()) as { data: number[] };
  return json.data;
}

async function fetchVerseIds(chapterId: number): Promise<Array<{ id: number; number: number }>> {
  const res = await fetch(`${BASE_URL}/bible/chapters/${chapterId}/verses`);
  if (!res.ok) return [];
  const json = (await res.json()) as { data: Array<{ id: number; number: number }> };
  return json.data;
}

function authKey(auth: AuthContext | null): string {
  if (!auth) return 'anon';
  return auth.type === 'bearer' ? `b:${auth.token.slice(-8)}` : `g:${auth.guestToken.slice(-8)}`;
}

const NUDGE_CHAPTER_THRESHOLD = 10;

export function ReadPageClient() {
  const { auth, isProvisioning } = useAuthContext();
  const { hasPermanentFailure } = useOfflineQueue(auth);
  const { markChapter, markDayComplete } = useVerseRead(auth);
  const continuePosition = useContinueReading(auth);

  const [modalState, setModalState] = useState<{
    chapterItem: ChapterGridItem;
    chapter: Chapter;
    isOpen: boolean;
  } | null>(null);

  // ── Guest backup nudge ────────────────────────────────────────────────────
  const sessionChaptersRead = useRef(0);
  const [showNudge, setShowNudge] = useState(false);

  function incrementChapterCount() {
    sessionChaptersRead.current += 1;
    if (
      auth?.type === 'guest' &&
      sessionChaptersRead.current >= NUDGE_CHAPTER_THRESHOLD &&
      shouldShowNudge() &&
      !showNudge
    ) {
      setShowNudge(true);
    }
  }

  // ── User profile (to detect missing start date) ───────────────────────────
  const { data: me } = useQuery<MeResult | null>({
    queryKey: ['me', authKey(auth)],
    queryFn: async () => {
      if (!auth) return null;

      try {
        return await getMe(auth);
      } catch (err) {
        logger.info('read:me-query-unavailable', { authType: auth.type, err });
        return null;
      }
    },
    enabled: auth !== null,
    staleTime: 300_000,
    retry: false,
  });

  // ── Plan day ──────────────────────────────────────────────────────────────
  const { data: planDay, isLoading: planLoading } = useQuery<PlanDayView>({
    queryKey: ['plan', 'today', authKey(auth)],
    queryFn: () => {
      if (!auth) return Promise.reject(new Error('no auth'));
      return getPlanToday(auth);
    },
    enabled: auth !== null,
    staleTime: 60_000,
  });

  // ── Chapters for today's book ─────────────────────────────────────────────
  const { data: allChapters } = useQuery<Chapter[]>({
    queryKey: ['bible', 'chapters', planDay?.book],
    queryFn: () => getChapters(planDay!.book),
    enabled: !!planDay?.book,
    staleTime: Infinity,
  });

  // ── Read verse IDs in today's range ──────────────────────────────────────
  const { data: readVerseIds } = useQuery<number[]>({
    queryKey: ['progress', 'reads', planDay?.startVerseId, planDay?.endVerseId, authKey(auth)],
    queryFn: () =>
      auth && planDay
        ? fetchReadVerseIds(planDay.startVerseId, planDay.endVerseId, auth)
        : Promise.resolve([]),
    enabled: auth !== null && !!planDay,
    staleTime: 30_000,
  });

  const readVerseIdSet = useMemo(() => new Set(readVerseIds ?? []), [readVerseIds]);

  // ── Modal verse data ──────────────────────────────────────────────────────
  const { data: modalVerses } = useQuery({
    queryKey: ['bible', 'verses', modalState?.chapter.id],
    queryFn: () => fetchVerseIds(modalState!.chapter.id),
    enabled: modalState !== null,
    staleTime: Infinity,
  });

  // ── Chapter grid items ────────────────────────────────────────────────────
  const chapterItems = useMemo((): ChapterGridItem[] => {
    if (!planDay || !allChapters) return [];

    const relevantChapters = allChapters.filter(
      (c) => c.number >= planDay.chapter && c.number <= planDay.chapter + 8,
    );

    const totalInRange = planDay.endVerse - planDay.startVerse + 1;

    return relevantChapters.map((chapter): ChapterGridItem => {
      let readState: ReadState = 'unread';
      const readCount = readVerseIdSet.size;
      if (chapter.number === planDay.chapter) {
        if (readCount === 0) readState = 'unread';
        else if (readCount >= totalInRange) readState = 'read';
        else readState = 'partial';
      }
      return { chapterId: chapter.id, chapterNumber: chapter.number, readState };
    });
  }, [planDay, allChapters, readVerseIdSet]);

  // ── Completion % ─────────────────────────────────────────────────────────
  // Use verse IDs (not verse numbers) — verse numbers reset per chapter so
  // endVerse - startVerse is wrong for multi-chapter days.
  const totalVersesInRange = planDay ? planDay.endVerseId - planDay.startVerseId + 1 : 1;
  const completionPct = planDay
    ? Math.min(100, Math.round((readVerseIdSet.size / Math.max(totalVersesInRange, 1)) * 100))
    : 0;
  const isComplete = completionPct >= 100;

  // ── Handlers ─────────────────────────────────────────────────────────────
  function handleTap(item: ChapterGridItem) {
    void (async () => {
      logger.action('chapter:tap', { chapterId: item.chapterId, chapterNumber: item.chapterNumber });
      const verses = await fetchVerseIds(item.chapterId);
      logger.info('chapter:tap:verses-fetched', { count: verses.length });
      markChapter(verses.map((v) => v.id));
      incrementChapterCount();
    })();
  }

  function handleLongPress(item: ChapterGridItem) {
    const chapter = allChapters?.find((c) => c.id === item.chapterId);
    if (!chapter) return;
    setModalState({ chapterItem: item, chapter, isOpen: true });
  }

  function closeModal() {
    setModalState((current) => (current ? { ...current, isOpen: false } : null));
  }

  function handleMarkFull() {
    if (!modalState || !modalVerses) return;
    markChapter((modalVerses as Array<{ id: number }>).map((v) => v.id));
    incrementChapterCount();
    closeModal();
  }

  function handleSaveRange(startVerse: number, endVerse: number) {
    if (!modalState || !modalVerses) return;
    const ids = (modalVerses as Array<{ id: number; number: number }>)
      .filter((v) => v.number >= startVerse && v.number <= endVerse)
      .map((v) => v.id);
    markChapter(ids);
    closeModal();
  }

  function handleMarkDayComplete() {
    void (async () => {
      if (!planDay || !allChapters) return;
      logger.action('day:complete:start', { day: planDay.dayNumber, label: planDay.label });
      const chaptersInRange = allChapters.filter(
        (c) => c.number >= planDay.chapter && c.number <= planDay.chapter + 8,
      );
      logger.info('day:complete:chapters', { count: chaptersInRange.length });
      const versesPerChapter = await Promise.all(chaptersInRange.map((ch) => fetchVerseIds(ch.id)));
      const allIds = versesPerChapter.flat().map((v) => v.id);
      logger.info('day:complete:verse-ids', { count: allIds.length });
      markDayComplete(allIds);
    })();
  }

  // ── Loading states ────────────────────────────────────────────────────────
  if (auth === null) {
    return (
      <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
        <p
          style={{
            fontFamily: 'var(--font-headline)',
            color: 'var(--color-text-muted)',
            fontSize: '0.9375rem',
            textTransform: 'lowercase',
          }}
        >
          {isProvisioning ? 'setting up your reading…' : 'loading…'}
        </p>
      </div>
    );
  }

  if (planLoading || !planDay) {
    return (
      <div
        style={{
          padding: 'var(--space-8) var(--space-6)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
        }}
      >
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
        {[140, 200].map((h, i) => (
          <div
            key={i}
            style={{
              height: h,
              borderRadius: 'var(--radius-xl)',
              backgroundColor: 'var(--color-bg-surface)',
              animation: 'pulse 1.4s ease-in-out infinite',
            }}
          />
        ))}
      </div>
    );
  }

  const modalReadNums =
    modalState && modalVerses
      ? new Set(
          (modalVerses as Array<{ id: number; number: number }>)
            .filter((v) => readVerseIdSet.has(v.id))
            .map((v) => v.number),
        )
      : new Set<number>();

  return (
    <>
      {/* Permanent sync failure banner */}
      {hasPermanentFailure && (
        <div
          role="alert"
          style={{
            padding: 'var(--space-3) var(--space-6)',
            backgroundColor: 'var(--color-bg-surface)',
            borderBottom: '1px solid var(--color-outline)',
            fontFamily: 'var(--font-body)',
            fontSize: '0.8125rem',
            color: 'var(--color-text-muted)',
            textAlign: 'center',
          }}
        >
          some reading couldn&apos;t sync — it&apos;s saved locally and will retry automatically
        </div>
      )}

      <div
        style={{
          maxWidth: '36rem',
          margin: '0 auto',
          padding: 'var(--space-6)',
          paddingBottom: 'calc(var(--space-6) + 5rem)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-8)',
        }}
      >
        {/* Hero header */}
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-headline)',
              fontSize: '2.25rem',
              fontWeight: 500,
              color: 'var(--color-text-primary)',
              textTransform: 'lowercase',
              margin: 0,
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
            }}
          >
            lectio
          </h1>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '0.875rem',
              color: 'var(--color-text-muted)',
              textTransform: 'lowercase',
              marginTop: 'var(--space-2)',
              letterSpacing: '0.02em',
            }}
          >
            your sanctuary of slow reflection.
          </p>
        </div>

        {/* Guest backup nudge — one per session, after 10 chapters */}
        {showNudge && (
          <GuestBackupNudge
            onDismiss={() => setShowNudge(false)}
            onSignIn={() => {
              setShowNudge(false);
              window.location.href = '/login';
            }}
          />
        )}

        <TodayCard
          dayNumber={planDay.dayNumber}
          label={planDay.label}
          completionPct={completionPct}
          isComplete={isComplete}
          onMarkDayComplete={handleMarkDayComplete}
        />

        {/* Start date nudge — shown until user sets plan_start_date in settings */}
        {me?.planStartDate === null && (
          <a
            href="/settings"
            style={{
              display: 'block',
              padding: 'var(--space-3) var(--space-4)',
              backgroundColor: 'var(--color-bg-surface)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-outline)',
              fontFamily: 'var(--font-headline)',
              fontSize: '0.8125rem',
              color: 'var(--color-text-secondary)',
              textTransform: 'lowercase',
              textDecoration: 'none',
            }}
          >
            set your reading start date in settings to track your plan progress
            <span style={{ color: 'var(--color-primary)', marginLeft: 'var(--space-2)' }}>
              go to settings
            </span>
          </a>
        )}

        <OpenInJWButton book={planDay.book} chapter={planDay.chapter} label={planDay.label} />

        {chapterItems.length > 0 && (
          <section>
            <p
              style={{
                fontFamily: 'var(--font-headline)',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: 'var(--color-text-secondary)',
                textTransform: 'lowercase',
                letterSpacing: '0.06em',
                marginBottom: 'var(--space-4)',
              }}
            >
              chapters
            </p>
            <ChapterGrid
              chapters={chapterItems}
              onTap={handleTap}
              onLongPress={handleLongPress}
            />
          </section>
        )}
      </div>

      <ContinuePill position={continuePosition} onClick={() => {}} />

      {modalState && (
        <VerseSelectorModal
          isOpen={modalState.isOpen}
          chapterName={`${planDay.label.split(' ')[0] ?? ''} ${modalState.chapter.number}`}
          totalVerses={modalState.chapter.verseCount}
          readVerseNumbers={modalReadNums}
          onMarkFull={handleMarkFull}
          onSaveRange={handleSaveRange}
          onClose={closeModal}
          onExited={() => setModalState(null)}
        />
      )}
    </>
  );
}
