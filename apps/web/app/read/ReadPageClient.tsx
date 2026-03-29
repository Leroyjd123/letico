'use client';
/**
 * ReadPageClient.tsx
 *
 * Client shell for the /read page.
 *
 * Data flow:
 *   1. useAuthContext() → AuthContext (bearer JWT or guest token from localStorage)
 *   2. If no auth → provision a guest via POST /auth/guest
 *   3. useQuery ['plan','today'] → PlanDayView
 *   4. useQuery ['bible','chapters', book] → Chapter[]
 *   5. useQuery ['progress','reads'] → number[] (read verse IDs in today's range)
 *   6. useContinueReading → ContinuePosition | null
 *
 * Architectural invariant: all writes go through useVerseRead → POST /progress/verses.
 * No other write path exists.
 */
import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { PlanDayView, Chapter } from '@lectio/types';
import { getPlanToday, getChapters, createGuest } from '../../lib/api';
import type { AuthContext } from '../../lib/api';
import { useAuthContext, storeGuestToken } from '../../lib/useAuthContext';
import { useVerseRead } from '../../hooks/useVerseRead';
import { useContinueReading } from '../../hooks/useContinueReading';
import { TodayCard } from '../../components/reader/TodayCard';
import { ChapterGrid, type ChapterGridItem } from '../../components/reader/ChapterGrid';
import { VerseSelectorModal } from '../../components/modals/VerseSelectorModal';
import { OpenInJWButton } from '../../components/reader/OpenInJWButton';
import { ContinuePill } from '../../components/reader/ContinuePill';
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

export function ReadPageClient() {
  const auth = useAuthContext();
  const queryClient = useQueryClient();
  const { markChapter, markDayComplete } = useVerseRead(auth);
  const continuePosition = useContinueReading(auth);

  const [provisioning, setProvisioning] = useState(false);
  const [modalState, setModalState] = useState<{
    chapterItem: ChapterGridItem;
    chapter: Chapter;
  } | null>(null);

  // ── Guest provisioning ────────────────────────────────────────────────────
  async function ensureAuth(): Promise<void> {
    if (auth !== null || provisioning) return;
    setProvisioning(true);
    try {
      const guest = await createGuest();
      storeGuestToken(guest.guestToken);
      // Invalidate to trigger re-auth detection
      await queryClient.invalidateQueries({ queryKey: ['plan'] });
    } finally {
      setProvisioning(false);
    }
  }

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

    // Chapters in today's range: from planDay.chapter up to a reasonable window
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
  const totalVersesInRange = planDay ? planDay.endVerse - planDay.startVerse + 1 : 1;
  const completionPct = planDay
    ? Math.min(100, Math.round((readVerseIdSet.size / Math.max(totalVersesInRange, 1)) * 100))
    : 0;
  const isComplete = completionPct >= 100;

  // ── Handlers ─────────────────────────────────────────────────────────────
  function handleTap(item: ChapterGridItem) {
    void (async () => {
      const verses = await fetchVerseIds(item.chapterId);
      markChapter(verses.map((v) => v.id));
    })();
  }

  function handleLongPress(item: ChapterGridItem) {
    const chapter = allChapters?.find((c) => c.id === item.chapterId);
    if (!chapter) return;
    setModalState({ chapterItem: item, chapter });
  }

  function handleMarkFull() {
    if (!modalState || !modalVerses) return;
    markChapter((modalVerses as Array<{ id: number }>).map((v) => v.id));
  }

  function handleSaveRange(startVerse: number, endVerse: number) {
    if (!modalState || !modalVerses) return;
    const ids = (modalVerses as Array<{ id: number; number: number }>)
      .filter((v) => v.number >= startVerse && v.number <= endVerse)
      .map((v) => v.id);
    markChapter(ids);
  }

  function handleMarkDayComplete() {
    void ensureAuth();
    void (async () => {
      if (!planDay || !allChapters) return;
      const chaptersInRange = allChapters.filter(
        (c) => c.number >= planDay.chapter && c.number <= planDay.chapter + 10,
      );
      const allIds: number[] = [];
      for (const ch of chaptersInRange) {
        const vv = await fetchVerseIds(ch.id);
        allIds.push(...vv.map((v) => v.id));
      }
      markDayComplete(allIds);
    })();
  }

  // ── Auth / loading states ─────────────────────────────────────────────────
  if (auth === null) {
    return (
      <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
        <p
          style={{
            fontFamily: 'var(--font-headline)',
            color: 'var(--color-text-muted)',
            fontSize: '0.9375rem',
            textTransform: 'lowercase',
            marginBottom: 'var(--space-4)',
          }}
        >
          {provisioning ? 'setting up your reading…' : 'welcome to lectio'}
        </p>
        {!provisioning && (
          <button
            onClick={() => void ensureAuth()}
            style={{
              fontFamily: 'var(--font-headline)',
              fontSize: '1rem',
              color: 'var(--color-primary)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              textDecoration: 'underline',
              textTransform: 'lowercase',
              padding: 'var(--space-2) var(--space-4)',
            }}
          >
            start reading
          </button>
        )}
      </div>
    );
  }

  if (planLoading || !planDay) {
    return (
      <div style={{ padding: 'var(--space-8) var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
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
      <div
        style={{
          maxWidth: '36rem',
          margin: '0 auto',
          padding: 'var(--space-6)',
          paddingBottom: 'calc(var(--space-6) + 5rem)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-6)',
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-headline)',
            fontSize: '1.75rem',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            textTransform: 'lowercase',
            margin: 0,
          }}
        >
          lectio
        </h1>

        <TodayCard
          dayNumber={planDay.dayNumber}
          label={planDay.label}
          completionPct={completionPct}
          isComplete={isComplete}
          onMarkDayComplete={handleMarkDayComplete}
        />

        <OpenInJWButton book={planDay.book} chapter={planDay.chapter} label={planDay.label} />

        {chapterItems.length > 0 && (
          <section>
            <p
              style={{
                fontFamily: 'var(--font-headline)',
                fontSize: '0.8125rem',
                fontWeight: 500,
                color: 'var(--color-text-muted)',
                textTransform: 'lowercase',
                marginBottom: 'var(--space-3)',
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
          isOpen={true}
          chapterName={`${planDay.label.split(' ')[0] ?? ''} ${modalState.chapter.number}`}
          totalVerses={modalState.chapter.verseCount}
          readVerseNumbers={modalReadNums}
          onMarkFull={handleMarkFull}
          onSaveRange={handleSaveRange}
          onClose={() => setModalState(null)}
        />
      )}
    </>
  );
}
