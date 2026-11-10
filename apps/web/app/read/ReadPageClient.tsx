'use client';

/**
 * ReadPageClient.tsx — the reading screen for one plan day.
 *
 * Which day: `?day=N` (from the plan list or prev/next), otherwise today.
 *
 * Data flow:
 *   1. useAuthContext()            → auth + stable userKey (guest auto-provisioned)
 *   2. GET /auth/me                → planId + planStartDate
 *   3. GET /plan/today | /plan/:planId/day/:N
 *                                  → the day's exact chapters (across books),
 *                                    their verse ids and which are read
 *   4. useContinueReading          → first unread verse in the whole plan
 *
 * Every chapter tile, the progress bar and "mark day complete" are derived
 * from that one plan-day response, which useVerseRead updates optimistically.
 * Because verse ids are part of the response, marking works offline.
 *
 * Architectural invariants:
 *   - All writes go through useVerseRead (→ offline queue → API)
 *   - Never renders Bible text inline (R7)
 *   - No gamification, no pressure language (R3, R4)
 */
import { useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { PlanDayChapter, PlanDayView, MeResult } from '@lectio/types';
import { getPlanToday, getPlanDay, getMe, updateUser } from '../../lib/api';
import { queryKeys } from '../../lib/queryKeys';
import { localDateString } from '../../lib/dates';
import {
  chapterReadState,
  dayCompletionPct,
  dayUnreadVerseIds,
  firstUnfinishedChapter,
  unreadVerseIds,
} from '../../lib/planDay';
import { logger } from '../../lib/logger';
import { useAuthContext, useSync } from '../../components/providers/AuthProvider';
import { useVerseRead } from '../../hooks/useVerseRead';
import { useContinueReading } from '../../hooks/useContinueReading';
import { TodayCard } from '../../components/reader/TodayCard';
import { ChapterGrid, type ChapterGridItem } from '../../components/reader/ChapterGrid';
import { VerseSelectorModal } from '../../components/modals/VerseSelectorModal';
import { OpenInJWButton } from '../../components/reader/OpenInJWButton';
import { ContinuePill } from '../../components/reader/ContinuePill';
import { GuestBackupNudge, shouldShowNudge } from '../../components/reader/GuestBackupNudge';
import { Button } from '../../components/ui/Button';

const NUDGE_CHAPTER_THRESHOLD = 10;

function parseDay(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

const mutedText: React.CSSProperties = {
  fontFamily: 'var(--font-headline)',
  color: 'var(--color-text-muted)',
  fontSize: '0.9375rem',
  textTransform: 'lowercase',
};

const softCard: React.CSSProperties = {
  padding: 'var(--space-4) var(--space-5)',
  backgroundColor: 'var(--color-bg-surface)',
  borderRadius: 'var(--radius-lg)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-3)',
};

export function ReadPageClient() {
  const { auth, userKey, isProvisioning, provisionFailed, retryProvision } = useAuthContext();
  const { hasPermanentFailure } = useSync();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const requestedDay = parseDay(searchParams?.get('day') ?? null);

  // ── User profile (plan + start date) ──────────────────────────────────────
  const { data: me } = useQuery<MeResult>({
    queryKey: queryKeys.me(userKey),
    queryFn: () => getMe(auth!),
    enabled: auth !== null,
    staleTime: 5 * 60_000,
  });

  // ── The plan day being shown ──────────────────────────────────────────────
  const dayKey = queryKeys.planDay(userKey, requestedDay ?? 'today');
  const {
    data: planDay,
    isLoading: planLoading,
    isError: planError,
    refetch: refetchPlan,
  } = useQuery<PlanDayView>({
    queryKey: dayKey,
    queryFn: () =>
      requestedDay !== null ? getPlanDay(me!.planId!, requestedDay, auth!) : getPlanToday(auth!),
    enabled: auth !== null && (requestedDay === null || !!me?.planId),
    staleTime: 60_000,
  });

  const { markRead, markUnread } = useVerseRead(dayKey);
  const continueReading = useContinueReading(auth, userKey);

  // ── Start date (onboarding) ───────────────────────────────────────────────
  const startToday = useMutation({
    mutationFn: () => updateUser({ planStartDate: localDateString() }, auth!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['me'] });
      void queryClient.invalidateQueries({ queryKey: ['plan'] });
      void queryClient.invalidateQueries({ queryKey: ['progress'] });
    },
  });

  // ── Guest backup nudge ────────────────────────────────────────────────────
  const sessionChaptersRead = useRef(0);
  const [showNudge, setShowNudge] = useState(false);
  function countChapters(n: number) {
    sessionChaptersRead.current += n;
    if (
      auth?.type === 'guest' &&
      sessionChaptersRead.current >= NUDGE_CHAPTER_THRESHOLD &&
      shouldShowNudge()
    ) {
      setShowNudge(true);
    }
  }

  // ── Verse selector modal ──────────────────────────────────────────────────
  const [modal, setModal] = useState<{ chapterId: number; isOpen: boolean } | null>(null);
  const modalChapter: PlanDayChapter | undefined = planDay?.chapters.find(
    (c) => c.chapterId === modal?.chapterId,
  );

  // ── Derived view state ────────────────────────────────────────────────────
  const chapterItems = useMemo(
    (): ChapterGridItem[] =>
      (planDay?.chapters ?? []).map((c) => ({
        chapterId: c.chapterId,
        chapterNumber: c.chapterNumber,
        book: c.book,
        bookName: c.bookName,
        readState: chapterReadState(c),
      })),
    [planDay],
  );
  const completionPct = planDay ? dayCompletionPct(planDay) : 0;
  const isComplete = !!planDay && planDay.chapters.length > 0 && completionPct >= 100;
  const jwChapter = planDay ? firstUnfinishedChapter(planDay) : undefined;

  // ── Handlers ──────────────────────────────────────────────────────────────
  function findChapter(chapterId: number) {
    return planDay?.chapters.find((c) => c.chapterId === chapterId);
  }

  function handleTap(item: ChapterGridItem) {
    const chapter = findChapter(item.chapterId);
    if (!chapter) return;
    logger.action('chapter:tap', { chapterId: chapter.chapterId, state: item.readState });
    if (item.readState === 'read') {
      markUnread(chapter.verseIds); // tapping a read chapter undoes it
    } else {
      markRead(unreadVerseIds(chapter));
      countChapters(1);
    }
  }

  function handleLongPress(item: ChapterGridItem) {
    setModal({ chapterId: item.chapterId, isOpen: true });
  }

  function closeModal() {
    setModal((m) => (m ? { ...m, isOpen: false } : null));
  }

  function handleMarkFull() {
    if (!modalChapter) return;
    markRead(unreadVerseIds(modalChapter));
    countChapters(1);
    closeModal();
  }

  /** Marks the selected verse range read (earlier reads are kept). */
  function handleSaveRange(startVerse: number, endVerse: number) {
    if (!modalChapter) return;
    const read = new Set(modalChapter.readVerseIds);
    const ids = modalChapter.verseIds.filter((id, i) => {
      const num = modalChapter.verseNumbers[i]!;
      return num >= startVerse && num <= endVerse && !read.has(id);
    });
    markRead(ids);
    closeModal();
  }

  function handleMarkDayComplete() {
    if (!planDay) return;
    const ids = dayUnreadVerseIds(planDay);
    logger.action('day:complete', { day: planDay.dayNumber, verses: ids.length });
    markRead(ids);
    countChapters(planDay.chapters.filter((c) => chapterReadState(c) !== 'read').length);
  }

  // ── Loading / error states ────────────────────────────────────────────────
  if (auth === null) {
    return (
      <div style={{ padding: 'var(--space-8)', textAlign: 'center', display: 'grid', gap: 'var(--space-4)', justifyItems: 'center' }}>
        {provisionFailed ? (
          <>
            <p style={mutedText}>we couldn&apos;t reach lectio just now</p>
            <Button variant="ghost" size="md" onClick={retryProvision}>
              try again
            </Button>
          </>
        ) : (
          <p style={mutedText}>{isProvisioning ? 'setting up your reading…' : 'loading…'}</p>
        )}
      </div>
    );
  }

  if (planError && !planDay) {
    return (
      <div style={{ padding: 'var(--space-8)', textAlign: 'center', display: 'grid', gap: 'var(--space-4)', justifyItems: 'center' }}>
        <p style={mutedText}>this reading couldn&apos;t load</p>
        <Button variant="ghost" size="md" onClick={() => void refetchPlan()}>
          try again
        </Button>
      </div>
    );
  }

  if (planLoading || !planDay) {
    return (
      <div style={{ padding: 'var(--space-8) var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }} aria-busy="true">
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

  const modalReadNums = new Set(
    (modalChapter?.verseNumbers ?? []).filter((_, i) =>
      modalChapter!.readVerseIds.includes(modalChapter!.verseIds[i]!),
    ),
  );

  return (
    <>
      {hasPermanentFailure && (
        <div
          role="status"
          style={{
            padding: 'var(--space-3) var(--space-6)',
            backgroundColor: 'var(--color-bg-surface)',
            fontFamily: 'var(--font-body)',
            fontSize: '0.8125rem',
            color: 'var(--color-text-muted)',
            textAlign: 'center',
          }}
        >
          some reading hasn&apos;t synced yet — it&apos;s saved on this device and will retry automatically
        </div>
      )}

      <div
        style={{
          maxWidth: '36rem',
          margin: '0 auto',
          padding: 'var(--space-6)',
          // leave room for the continue pill above the bottom nav
          paddingBottom: 'calc(var(--space-6) + 4rem)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-8)',
        }}
      >
        <header>
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
        </header>

        {showNudge && (
          <GuestBackupNudge
            onDismiss={() => setShowNudge(false)}
            onSignIn={() => {
              setShowNudge(false);
              window.location.href = '/login';
            }}
          />
        )}

        {me?.planStartDate === null && (
          <div style={softCard}>
            <p style={{ ...mutedText, color: 'var(--color-text-secondary)', margin: 0 }}>
              when would you like day 1 to be? lectio uses it to show today&apos;s reading.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
              <Button
                variant="primary"
                size="md"
                onClick={() => startToday.mutate()}
                disabled={startToday.isPending}
              >
                {startToday.isPending ? 'saving…' : 'start today'}
              </Button>
              <Link href="/settings" style={{ ...mutedText, fontSize: '0.875rem', color: 'var(--color-primary)' }}>
                pick another date
              </Link>
            </div>
            {startToday.isError && (
              <p style={{ ...mutedText, fontSize: '0.8125rem', margin: 0 }}>
                that didn&apos;t save — try again in a moment
              </p>
            )}
          </div>
        )}

        <TodayCard
          dayNumber={planDay.dayNumber}
          totalDays={planDay.totalDays}
          label={planDay.label}
          completionPct={completionPct}
          isComplete={isComplete}
          isToday={planDay.isToday}
          dayHref={(n) => `/read?day=${n}`}
          todayHref="/read"
          onMarkDayComplete={handleMarkDayComplete}
        />

        {jwChapter && (
          <OpenInJWButton
            book={jwChapter.book}
            chapter={jwChapter.chapterNumber}
            label={`${jwChapter.bookName.toLowerCase()} ${jwChapter.chapterNumber}`}
          />
        )}

        {chapterItems.length > 0 && (
          <section aria-labelledby="chapters-heading">
            <p
              id="chapters-heading"
              style={{
                fontFamily: 'var(--font-headline)',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: 'var(--color-text-secondary)',
                textTransform: 'lowercase',
                letterSpacing: '0.06em',
                marginBottom: 'var(--space-1)',
              }}
            >
              chapters
            </p>
            <p style={{ ...mutedText, fontSize: '0.75rem', marginBottom: 'var(--space-4)' }}>
              tap to mark read · tap again to undo · hold to choose verses
            </p>
            <ChapterGrid chapters={chapterItems} onTap={handleTap} onLongPress={handleLongPress} />
          </section>
        )}
      </div>

      <ContinuePill
        position={continueReading.position}
        isLoading={continueReading.isLoading}
        isError={continueReading.isError}
      />

      {modal && modalChapter && (
        <VerseSelectorModal
          isOpen={modal.isOpen}
          chapterName={`${modalChapter.bookName.toLowerCase()} ${modalChapter.chapterNumber}`}
          totalVerses={modalChapter.verseNumbers[modalChapter.verseNumbers.length - 1] ?? modalChapter.verseIds.length}
          readVerseNumbers={modalReadNums}
          onMarkFull={handleMarkFull}
          onSaveRange={handleSaveRange}
          onClose={closeModal}
          onExited={() => setModal(null)}
        />
      )}
    </>
  );
}
