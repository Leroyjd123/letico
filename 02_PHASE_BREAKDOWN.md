# lectio — phase breakdown & delivery plan

**Version:** 1.0  
**Status:** Draft  
**Last Updated:** 2026-03-28

---

## overview

Lectio is delivered in 7 strictly incremental phases. No phase begins until the previous phase passes its exit criteria. Each phase produces working, tested, deployable software — not stubs.

---

## phase map

```
Phase 1 — Foundation          ████████░░░░░░░░░░░░░░░░░░░░
Phase 2 — Reading & Progress  ░░░░░░░░████████░░░░░░░░░░░░
Phase 3 — Plan & Continue     ░░░░░░░░░░░░░░░░████░░░░░░░░
Phase 4 — Guest & Offline     ░░░░░░░░░░░░░░░░░░░░████░░░░
Phase 5 — Auth & Migration    ░░░░░░░░░░░░░░░░░░░░░░░░████
Phase 6 — Analytics           ░░░░░░░░░░░░░░░░░░░░░░░░░░░░ (post-auth)
Phase 7 — Polish & Hardening  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░ (final)
```

---

## phase 1 — foundation

**goal:** The monorepo runs. The schema is migrated. Bible data is seeded. The API serves books/chapters/verses. The frontend renders with correct fonts and tokens.

**deliverables:**

| # | deliverable | owner |
|---|---|---|
| 1.1 | Turborepo + pnpm monorepo scaffold | Engineering |
| 1.2 | packages/types: shared interfaces + design tokens | Engineering |
| 1.3 | packages/tsconfig: base + nextjs configs | Engineering |
| 1.4 | Supabase migration 001_initial_schema.sql | Engineering |
| 1.5 | Bible seed script: 66 books, all chapters, all verses (KJV, global_order) | Engineering |
| 1.6 | NestJS BibleModule: service, controller, types, unit tests | Engineering |
| 1.7 | NestJS AppModule, main.ts, SupabaseProvider | Engineering |
| 1.8 | Next.js root layout, globals.css, tokens injection | Engineering |
| 1.9 | UI primitives: Text, Button (Storybook stories for both) | Engineering |
| 1.10 | verseRange utility + 22 unit tests | Engineering |
| 1.11 | Frontend API client (lib/api.ts), React Query client config | Engineering |
| 1.12 | .env.example with all required variables documented | Engineering |

**exit criteria:**

- [ ] `pnpm dev` starts both apps without errors
- [ ] `GET /api/bible/books` returns 66 books in canonical order
- [ ] `GET /api/bible/chapters/1/verses` returns verses with text
- [ ] Verse count in seed = 31,102 (assertion in seed script)
- [ ] `http://localhost:3000` renders "lectio" in Manrope with correct background colour (#faf9f6)
- [ ] All unit tests pass (`pnpm test`)
- [ ] Token smoke-test swatches visible on home page

**estimated effort:** 5–7 days

---

## phase 2 — reading & progress

**goal:** A user can see today's passage, open it in jw.org, mark it read (chapter tap, verse long-press, or mark-day-complete), and see progress update on screen.

**deliverables:**

| # | deliverable | owner |
|---|---|---|
| 2.1 | NestJS PlanModule: GET /plan/today, GET /plan/:planId/day/:dayNumber | Engineering |
| 2.2 | Plan seed: 365-day sequential plan (Genesis → Revelation) | Engineering |
| 2.3 | NestJS ProgressModule: POST /progress/verses (batch upsert) | Engineering |
| 2.4 | Home screen page (/read) | Engineering |
| 2.5 | TodayCard component: passage ref, progress bar, mark-day-complete, success state | Engineering |
| 2.6 | ChapterGrid component: read / partial / unread tile states | Engineering |
| 2.7 | ChapterTile: tap → mark chapter, long-press → open verse selector | Engineering |
| 2.8 | VerseSelectorModal: range slider, verse dot grid, mark full / save range | Engineering |
| 2.9 | OpenInJWButton: constructs jw.org deep-link, opens external browser | Engineering |
| 2.10 | ContinuePill: floating pill, navigates to continue position | Engineering |
| 2.11 | useVerseRead hook: optimistic update, React Query mutation | Engineering |
| 2.12 | ProgressBar component (Storybook story) | Engineering |
| 2.13 | Long-press handler: CSS user-select: none, touch-action: manipulation | Engineering |

**exit criteria:**

- [ ] Today's passage shows correct book/chapter for day 1
- [ ] Tapping a chapter tile marks it read (all verses inserted in verse_reads)
- [ ] Long-pressing a chapter tile (≥600ms) opens verse selector modal
- [ ] Verse selector "save range" inserts correct verse range in verse_reads
- [ ] "Mark day complete" button inserts all verses for today's plan_day range
- [ ] Success state appears after mark-day-complete
- [ ] "Open in jw.org" opens correct URL in external browser
- [ ] Progress bar reflects verse_reads count vs. total for the day
- [ ] Continue pill shows next unread verse
- [ ] No duplicate rows in verse_reads (upsert test)
- [ ] Long-press does not trigger text selection on mobile browsers

**estimated effort:** 8–10 days

---

## phase 3 — plan view & continue reading

**goal:** Users can scroll across all plan days (past and future), tap any day, and continue reading from their exact position.

**deliverables:**

| # | deliverable | owner |
|---|---|---|
| 3.1 | NestJS ProgressModule: GET /progress/continue | Engineering |
| 3.2 | Plan view screen (/plan): scrollable day list | Engineering |
| 3.3 | PlanDayRow component: day number, passage ref, completion % bar | Engineering |
| 3.4 | Past and future days fully navigable — no restrictions | Engineering |
| 3.5 | Tapping a plan day row opens that day's chapter grid | Engineering |
| 3.6 | Per-day completion % computed from verse_reads at query time | Engineering |

**exit criteria:**

- [ ] Plan view shows all 365 days
- [ ] Past days show correct completion state
- [ ] Future days are tappable and open their chapter grid
- [ ] GET /progress/continue returns the correct next unread verse
- [ ] Tapping a future day's tile marks it read (read-ahead works)
- [ ] Backfill: marking a past day's chapter updates that day's completion % in plan view

**estimated effort:** 4–5 days

---

## phase 4 — guest mode & offline

**goal:** The app works fully without a login. Progress is preserved locally and syncs when possible.

**deliverables:**

| # | deliverable | owner |
|---|---|---|
| 4.1 | NestJS AuthModule: POST /auth/guest | Engineering |
| 4.2 | Guest token generation + localStorage storage on first visit | Engineering |
| 4.3 | Guest user row created in users table | Engineering |
| 4.4 | All progress endpoints work for guest users | Engineering |
| 4.5 | useOfflineQueue hook: write to IndexedDB, flush on reconnect | Engineering |
| 4.6 | Optimistic UI: tile updates immediately regardless of network state | Engineering |
| 4.7 | Batch flush: POST /progress/verses in chunks of ≤ 500 verse IDs | Engineering |
| 4.8 | Online/offline detection using navigator.onLine + window events | Engineering |
| 4.9 | Queue bounds: hard cap of 10,000 items; permanently-failed banner after max retries | Engineering |
| 4.10 | Guest backup nudge: after ≥ 10 chapters read, show one-per-session inline sign-in prompt | Engineering |

**exit criteria:**

- [ ] First visit creates guest_token in localStorage and guest user row in Supabase
- [ ] Marking chapters read while offline writes to IndexedDB
- [ ] On reconnect, all queued reads are flushed to Supabase
- [ ] Flushed reads appear correctly in verse_reads
- [ ] Progress UI reflects offline reads immediately (optimistic)
- [ ] Queue handles 500+ items without error (batch test)
- [ ] Queue hard-cap test: 10,001st write is dropped and banner appears
- [ ] Guest backup nudge appears after 10th chapter marked read (once per session only)

**phase 4 testing note:** The full offline → online → sync E2E flow can only be validated against a real Supabase project with a guest user. Unit tests cover queue logic in isolation. The sync-to-DB assertion (`verse_reads` appear after flush) requires a test Supabase instance configured with `SUPABASE_TEST_URL` and a seeded guest user. This test setup must be documented and working before Phase 4 exit criteria can be signed off.

**estimated effort:** 5–6 days

---

## phase 5 — auth & migration

**goal:** Users can sign in with email OTP, and their guest progress migrates to their account.

**deliverables:**

| # | deliverable | owner |
|---|---|---|
| 5.1 | NestJS AuthModule: POST /auth/otp/send, POST /auth/otp/verify | Engineering |
| 5.2 | NestJS AuthModule: POST /auth/migrate | Engineering |
| 5.3 | Login screen: email input → OTP input → verify → session | Engineering |
| 5.4 | AuthGuard: protect all user-scoped endpoints | Engineering |
| 5.5 | Supabase Realtime: subscribe to verse_reads on sign-in | Engineering |
| 5.6 | Settings: sign in/out, display signed-in email | Engineering |
| 5.7 | Guest token invalidation after migration | Engineering |
| 5.8 | Cross-device sync test: mark on device A, verify on device B | Engineering |

**exit criteria:**

- [ ] OTP email is sent on POST /auth/otp/send
- [ ] Valid OTP returns session token
- [ ] Expired OTP returns 401 with clear error
- [ ] POST /auth/migrate transfers all verse_reads from guest to authenticated user
- [ ] Guest user row soft-deleted after migration
- [ ] Supabase Realtime fires on verse_reads insert from second device
- [ ] Sign out clears session and returns to guest mode

**estimated effort:** 6–8 days

---

## phase 6 — analytics

**goal:** Users see calm, honest stats about their reading. No gamification, no pressure.

**deliverables:**

| # | deliverable | owner |
|---|---|---|
| 6.1 | NestJS AnalyticsModule: GET /progress/summary | Engineering |
| 6.2 | Analytics screen (/analytics) | Engineering |
| 6.3 | StatusCard: ahead/behind sentence, neutral language | Engineering |
| 6.4 | StatCard: completion %, streak days | Engineering |
| 6.5 | ProgressGraph: 7-day SVG line chart (verses/day) | Engineering |
| 6.6 | Streak calculation: server-side, UTC calendar days | Engineering |
| 6.7 | Ahead/behind calculation: plan range vs. verse_reads | Engineering |

**exit criteria:**

- [ ] GET /progress/summary returns correct values for a test user with known verse_reads
- [ ] Completion % matches manual calculation (versesRead / 31102 × 100)
- [ ] Streak = 0 if no reads today or yesterday; streak = N if N consecutive days with reads
- [ ] Ahead/behind = 0 if exactly on plan; positive if ahead; negative if behind
- [ ] Analytics screen renders correctly with no reads (empty state)
- [ ] No gamification language anywhere on the analytics screen

**estimated effort:** 5–6 days

---

## phase 7 — polish & hardening

**goal:** The product is accessible, documented, and robust enough for production use.

**deliverables:**

| # | deliverable | owner |
|---|---|---|
| 7.1 | Storybook: stories for all components | Engineering |
| 7.2 | Accessibility audit: aria-labels, focus rings, keyboard nav | Engineering |
| 7.3 | jw.org deep-link: verified URL format locked as `https://www.jw.org/finder?wtlocale=E&bible={BB}{CCC}&pub=nwt` (BB = 2-digit book sort_order, CCC = 3-digit chapter). Verified example: `01001` = Genesis 1. Single config constant — never inlined. | Engineering |
| 7.4 | Settings: plan selection (1yr, 2yr, chronological) | Engineering |
| 7.5 | Settings: theme toggle (light / dark / sepia) with localStorage persistence | Engineering |
| 7.6 | Settings: reset progress, export data (JSON/CSV) | Engineering |
| 7.7 | Error states: network banner, empty states, retry buttons | Engineering |
| 7.8 | E2E tests: Playwright — key user journeys | Engineering |
| 7.9 | Performance audit: Lighthouse ≥ 90 on mobile | Engineering |

**exit criteria:**

- [ ] All components have Storybook stories
- [ ] Lighthouse accessibility score ≥ 90
- [ ] All keyboard-navigable paths work without a mouse
- [ ] E2E: guest mark-chapter flow passes
- [ ] E2E: OTP sign-in + migration flow passes
- [ ] E2E: offline queue flush flow passes
- [ ] Reset progress soft-deletes verse_reads and resets UI
- [ ] Export produces valid JSON with all verse_reads for the user

**estimated effort:** 6–8 days

---

## total estimated effort

| phase | days |
|---|---|
| Phase 1 | 5–7 |
| Phase 2 | 8–10 |
| Phase 3 | 4–5 |
| Phase 4 | 5–6 |
| Phase 5 | 6–8 |
| Phase 6 | 5–6 |
| Phase 7 | 6–8 |
| **total** | **39–50 days** |

---

## version history

| version | date | notes |
|---|---|---|
| 1.0 | 2026-03-28 | Initial draft |
