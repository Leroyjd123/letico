# lectio — Project Progress Log

**Version:** 1.2
**Last Updated:** 2026-03-30

---

> ## STANDING INSTRUCTION — READ THIS FIRST
>
> **Every agent (human or AI) who makes changes to this project MUST:**
>
> 1. Read this file at the start of work to understand current state.
> 2. Add an entry to the relevant phase section below when a task is completed.
> 3. Update the **Current Status** block at the top of this file.
> 4. Mark the "Next Step" when handing off or pausing work.
> 5. Record your agent name clearly in each entry.
>
> Format for completed entries:
>
> ```text
> - [x] Task description — Agent: <AgentName>, Date: YYYY-MM-DD
> ```
>
> Format for in-progress tasks:
>
> ```text
> - [ ] Task description — Agent: <AgentName>, Date started: YYYY-MM-DD
> ```

---

## Current Status

| Field | Value |
| --- | --- |
| **Active Phase** | Phase 5 — Auth & Migration |
| **Last Completed Phase** | Phase 4 — Guest Mode & Offline |
| **Last Updated By** | Claude Sonnet 4.6 |
| **Last Updated On** | 2026-03-30 |
| **Next Step** | Implement Phase 5: email OTP sign-in, guest migration, Supabase Realtime |

---

## Phase 1 — Foundation

**Goal:** Monorepo runs, schema migrated, Bible data seeded, API serves books/chapters/verses, frontend renders with correct tokens.

| Status | Task | Agent | Date |
| --- | --- | --- | --- |
| [x] | Turborepo + pnpm monorepo scaffold | Claude Sonnet 4.6 | 2026-03-29 |
| [x] | `packages/types`: shared interfaces + CSS design tokens | Claude Sonnet 4.6 | 2026-03-29 |
| [x] | `packages/tsconfig`: base + nextjs configs | Claude Sonnet 4.6 | 2026-03-29 |
| [x] | Supabase migration `001_initial_schema.sql` (books, chapters, verses, plans, plan_days, verse_reads, users) | Claude Sonnet 4.6 | 2026-03-29 |
| [x] | KJV Bible seed: 66 books, 1,189 chapters, 31,102 verses with `global_order` | Claude Sonnet 4.6 | 2026-03-29 |
| [x] | 3 reading plans + 365 plan_days seeded (proportional algorithm) | Claude Sonnet 4.6 | 2026-03-29 |
| [x] | NestJS `BibleModule`: service, controller, types, unit tests | Claude Sonnet 4.6 | 2026-03-29 |
| [x] | NestJS `AppModule`, `main.ts`, `SupabaseProvider` | Claude Sonnet 4.6 | 2026-03-29 |
| [x] | Next.js root layout, `globals.css`, CSS token injection via `:root` | Claude Sonnet 4.6 | 2026-03-29 |
| [x] | UI primitives: `Text`, `Button`, `ProgressBar` components | Claude Sonnet 4.6 | 2026-03-29 |
| [x] | `verseRange` utility + 22 unit tests | Claude Sonnet 4.6 | 2026-03-29 |
| [x] | `jwLink` utility + 60 unit tests | Claude Sonnet 4.6 | 2026-03-29 |
| [x] | Frontend API client (`lib/api.ts`), React Query client config | Claude Sonnet 4.6 | 2026-03-29 |
| [x] | `.env.example` with all required variables documented | Claude Sonnet 4.6 | 2026-03-29 |
| [x] | All documentation files created (00_INDEX through 11_IMPLEMENTATION_PLAN) | Claude Sonnet 4.6 | 2026-03-29 |

**Commit:** `f16c1ce` — 62 files, 14,173 insertions. 49 tests passing.

---

## Phase 2 — Reading & Progress

**Goal:** User can see today's passage, open it in jw.org, mark it read, and see progress update.

| Status | Task | Agent | Date |
| --- | --- | --- | --- |
| [x] | `AuthModule`: `AuthGuard` (Bearer JWT + X-Guest-Token), `@CurrentUser()` decorator | Claude Sonnet 4.6 | 2026-03-29 |
| [x] | `POST /auth/guest` endpoint — guest token provisioning | Claude Sonnet 4.6 | 2026-03-29 |
| [x] | `PlanModule`: `GET /plan/today`, `GET /plan/:planId/day/:dayNumber` with UTC day arithmetic | Claude Sonnet 4.6 | 2026-03-29 |
| [x] | `ProgressModule`: `POST /progress/verses` (batch upsert, `ignoreDuplicates: true`) | Claude Sonnet 4.6 | 2026-03-29 |
| [x] | `ProgressModule`: `GET /progress/continue`, `GET /progress/summary`, `GET /progress/reads` | Claude Sonnet 4.6 | 2026-03-29 |
| [x] | `ReadPageClient`: full reading screen with guest provisioning + React Query data flow | Claude Sonnet 4.6 | 2026-03-29 |
| [x] | `TodayCard`: day label, progress bar, mark-day-complete button, success state | Claude Sonnet 4.6 | 2026-03-29 |
| [x] | `ChapterGrid`: 4-column bento grid with asymmetric reflection card | Claude Sonnet 4.6 | 2026-03-29 |
| [x] | `ChapterTile`: tap/long-press (600ms), read/partial/unread/locked states | Claude Sonnet 4.6 | 2026-03-29 |
| [x] | `VerseSelectorModal`: dual-thumb range slider, 6-col verse dot grid | Claude Sonnet 4.6 | 2026-03-29 |
| [x] | `OpenInJWButton`: native anchor to jw.org deep link | Claude Sonnet 4.6 | 2026-03-29 |
| [x] | `ContinuePill`: fixed floating pill with continue position or finished state | Claude Sonnet 4.6 | 2026-03-29 |
| [x] | `useVerseRead`: optimistic mutation hook with IndexedDB offline queue | Claude Sonnet 4.6 | 2026-03-29 |
| [x] | `useContinueReading`: React Query wrapper, 30s stale time | Claude Sonnet 4.6 | 2026-03-29 |
| [x] | `useAuthContext`: resolves bearer session or localStorage guest token | Claude Sonnet 4.6 | 2026-03-29 |
| [x] | `offlineQueue`: IndexedDB-backed pending reads queue | Claude Sonnet 4.6 | 2026-03-29 |
| [x] | 20 API unit tests passing (bible, plan, progress services) | Claude Sonnet 4.6 | 2026-03-29 |
| [x] | `README.md` created | Claude Sonnet 4.6 | 2026-03-29 |

**Commit:** `84be457` — 29 files, 2,735 insertions. 20 API tests passing.

---

## Phase 3 — Plan View & Continue Reading

**Goal:** Users can scroll across all 365 plan days, tap any day, and continue reading from their exact position.

| Status | Task | Agent | Date |
| --- | --- | --- | --- |
| [x] | `GET /auth/me` — resolves userId → `{ id, planId }`, defaults to 1-year plan | Claude Sonnet 4.6 | 2026-03-29 |
| [x] | `GET /plan/:planId/days/summary` — completion % for all 365 days, 20-concurrent-call batching via `count_verses_read_in_range` RPC | Claude Sonnet 4.6 | 2026-03-29 |
| [x] | `PlanDaySummaryDto` added to `plan.types.ts` | Claude Sonnet 4.6 | 2026-03-29 |
| [x] | Route ordering fix: `days/summary` placed before `day/:dayNumber` | Claude Sonnet 4.6 | 2026-03-29 |
| [x] | `/plan` page — 365-day scrollable list, auto-scrolls to today on mount | Claude Sonnet 4.6 | 2026-03-29 |
| [x] | `PlanDayRow` component — 44px min-height, today highlight, no locked states (rule R2) | Claude Sonnet 4.6 | 2026-03-29 |
| [x] | `usePlanDay` hook — React Query wrapper for single-day fetch | Claude Sonnet 4.6 | 2026-03-29 |
| [x] | 2 new `getContinuePosition` specs; all 22 API tests passing | Claude Sonnet 4.6 | 2026-03-29 |

**Commit:** `c6c51a4` — 10 files, 612 insertions. 22 API tests passing.

---

## Phase 4 — Guest Mode & Offline

**Goal:** App works fully without login. Progress preserved locally and syncs when possible.

| Status | Task | Agent | Date |
| --- | --- | --- | --- |
| [x] | `POST /auth/guest` creates guest user row in Supabase `users` table (verified — done in Phase 2) | Claude Sonnet 4.6 | 2026-03-30 |
| [x] | `hooks/useAuth.ts` — auto-provisions guest on first mount; no button click required | Claude Sonnet 4.6 | 2026-03-30 |
| [x] | `components/providers/AuthProvider.tsx` — React context; all pages use `useAuthContext()` from here | Claude Sonnet 4.6 | 2026-03-30 |
| [x] | `app/layout.tsx` — `AuthProvider` wraps all children | Claude Sonnet 4.6 | 2026-03-30 |
| [x] | All progress endpoints confirmed working for guest users via `X-Guest-Token` header | Claude Sonnet 4.6 | 2026-03-30 |
| [x] | `lib/offlineQueue.ts` upgraded — v2 schema, `enqueueVerseReads`, `getPendingReads`, `markSynced`, `clearSynced` | Claude Sonnet 4.6 | 2026-03-30 |
| [x] | `hooks/useOfflineQueue.ts` — online/offline detection, chunked flush (≤500), 3-retry exponential backoff | Claude Sonnet 4.6 | 2026-03-30 |
| [x] | `hooks/useVerseRead.ts` — enqueue-first, API-if-online, `markSynced` on success; optimistic update always fires | Claude Sonnet 4.6 | 2026-03-30 |
| [x] | Queue hard cap: 10,000 unsynced items; permanently-failed banner in `ReadPageClient` | Claude Sonnet 4.6 | 2026-03-30 |
| [x] | `components/reader/GuestBackupNudge.tsx` — one-per-session sign-in prompt after ≥ 10 chapters | Claude Sonnet 4.6 | 2026-03-30 |
| [x] | `ReadPageClient.tsx` updated — new auth context, nudge, offline failure banner, no manual provisioning | Claude Sonnet 4.6 | 2026-03-30 |
| [x] | `PlanPageClient.tsx` updated — uses `useAuthContext()` from `AuthProvider` | Claude Sonnet 4.6 | 2026-03-30 |
| [x] | `apps/api/src/auth/auth.service.spec.ts` — 5 tests for `createGuest`; 27 API tests passing total | Claude Sonnet 4.6 | 2026-03-30 |

**Commit:** pending

---

## Phase 5 — Auth & Migration _(not started)_

**Goal:** Users sign in with email OTP; guest progress migrates to their account.

Tasks: See `02_PHASE_BREAKDOWN.md` § Phase 5.

---

## Phase 6 — Analytics _(not started)_

**Goal:** Calm, honest reading stats. No gamification.

Tasks: See `02_PHASE_BREAKDOWN.md` § Phase 6.

---

## Phase 7 — Polish & Hardening _(not started)_

**Goal:** Accessible, documented, production-ready.

Tasks: See `02_PHASE_BREAKDOWN.md` § Phase 7.

---

## Issues, Discussions & Fixes

> This section logs problems raised, decisions debated, and fixes applied — with the agent responsible.
>
> **Every agent must append here when a bug is found, a design decision is changed, or a non-obvious fix is made.**

---

### [DISCUSSION-003] Core product philosophy — no gamification, no pressure

- **Raised by:** Leroy Joice Dsouza (human, project owner)
- **Date:** 2026-03-29
- **Context:** Existing Bible reading apps either enforce day-based streaks that punish users for missing days, or have no structure at all. The project needed a clear non-negotiable stance.
- **Decision:** Seven product rules (R1–R7) written into the PRD. All future features, designs, and code are held against them. Key rules: no "mark day complete" as the only path, no forced reading order, no badges/streaks/celebration animations, no pressure language, progress is passive (surfaces data, never instructs), `verse_reads` is the only source of truth, reading always happens in jw.org.
- **Action taken by:** Claude Sonnet 4.6 — encoded rules into `01_PRD.md` and `11_IMPLEMENTATION_PLAN.md`; referenced in every component spec and test.
- **Status:** Standing policy — applies to all phases.

---

### [DISCUSSION-004] `verse_reads` as sole source of truth — no derived state in DB

- **Raised by:** Leroy Joice Dsouza (human, project owner) / Claude Sonnet 4.6
- **Date:** 2026-03-29
- **Context:** Early design considered caching completion % and streak values to avoid recomputing on every request.
- **Decision:** Never store derived state. Completion %, streak, ahead/behind, and continue position are always computed at query time from `verse_reads`. The only table that records reading activity is `verse_reads`. This also means the schema never gets into an inconsistent state (e.g. a cached "50% done" flag that doesn't match the actual rows).
- **Action taken by:** Claude Sonnet 4.6 — enforced in DB schema (`04_DATABASE_SCHEMA.md`), `progress.service.ts`, and noted as architectural principle #2 in `11_IMPLEMENTATION_PLAN.md`.
- **Status:** Invariant — never violate.

---

### [DISCUSSION-005] `global_order` kept internal — never exposed in API responses

- **Raised by:** Claude Sonnet 4.6
- **Date:** 2026-03-29
- **Context:** `global_order` is a sequential integer across all 31,102 Bible verses (Genesis 1:1 = 1, Revelation 22:21 = 31,102). It enables efficient SQL range queries like `BETWEEN x AND y` across book and chapter boundaries. However, exposing it in the API would create a leaky abstraction — callers would depend on an internal ordering detail.
- **Decision:** `global_order` is selected in DB queries where needed for sorting/range math, but always stripped in mapper functions (`toVerseDto`) before returning the response. No API endpoint ever returns `global_order`.
- **Action taken by:** Claude Sonnet 4.6 — enforced in `bible.service.ts` and noted as architectural principle #4 in `11_IMPLEMENTATION_PLAN.md`.
- **Status:** Invariant — never violate.

---

### [DISCUSSION-006] CSS custom properties only — no Tailwind, no hardcoded hex

- **Raised by:** Leroy Joice Dsouza (human, project owner)
- **Date:** 2026-03-29
- **Context:** Standard React projects lean on Tailwind or inline hex colours. For Lectio the design system needed to be consistent and theme-switchable (light/dark/sepia planned in Phase 7).
- **Decision:** All colours, spacing, typography, border radius, and shadows are defined as CSS custom properties in `packages/types/src/tokens.ts` and injected into `:root` via `buildCssTokenString()` in the root layout. No hardcoded hex anywhere in components. No Tailwind.
- **Action taken by:** Claude Sonnet 4.6 — implemented tokens in `packages/types/src/tokens.ts`, wired into `apps/web/app/layout.tsx`.
- **Status:** Standing rule — applies to all UI components.

---

### [DISCUSSION-007] `noUncheckedIndexedAccess` enabled in TypeScript config

- **Raised by:** Claude Sonnet 4.6
- **Date:** 2026-03-29
- **Context:** Array access like `arr[0]` in TypeScript normally types the result as `T`, not `T | undefined`, which can hide runtime crashes on empty arrays.
- **Decision:** Enable `noUncheckedIndexedAccess: true` in the base tsconfig. This means every array/record access returns `T | undefined` and forces explicit checks. Noted as an intentional gotcha in `11_IMPLEMENTATION_PLAN.md` — the rule must never be disabled even though it generates more verbose code.
- **Action taken by:** Claude Sonnet 4.6 — set in `packages/tsconfig/base.json`.
- **Status:** Applies to entire monorepo. Side effect: caused ISSUE-002 and ISSUE-003 below.

---

### [DISCUSSION-008] Plan seed algorithm — chapter-boundary rule for plan_day ranges

- **Raised by:** Claude Sonnet 4.6
- **Date:** 2026-03-29
- **Context:** Dividing 31,102 verses into 365 days is not a clean 85.2 verses/day. Splitting a plan_day mid-chapter would create a poor reading experience and make the continue-reading calculation ambiguous.
- **Decision:** Plan_day boundaries must always fall on chapter ends. The seed script uses a greedy algorithm: accumulate chapters day by day targeting ~85 verses per day, only advancing to the next day at a chapter boundary. This means some days are longer and some shorter, but no chapter is split across days.
- **Action taken by:** Claude Sonnet 4.6 — implemented in `apps/api/src/bible/seed/seed.ts`.
- **Status:** Applies to all plan types (1yr, 2yr, chronological).

---

### [DISCUSSION-009] LEFT JOIN pattern for continue-reading — rejected NOT IN subquery

- **Raised by:** Claude Sonnet 4.6
- **Date:** 2026-03-29
- **Context:** Finding the first unread verse requires identifying verses with no `verse_reads` row for the current user. Two approaches considered: a `NOT IN` subquery vs a `LEFT JOIN ... WHERE vr.id IS NULL`.
- **Decision:** Use LEFT JOIN. The `NOT IN` approach performs poorly on large tables and has a well-known correctness bug when the subquery returns NULLs (`NOT IN` with any NULL returns no rows). LEFT JOIN is both correct and efficient.
- **Action taken by:** Claude Sonnet 4.6 — implemented in `progress.service.ts` `getContinuePosition`.
- **Status:** Fixed pattern — do not change to NOT IN.

---

### [DISCUSSION-010] Batch endpoint for 365-day plan summary — one round-trip vs lazy loading

- **Raised by:** Claude Sonnet 4.6
- **Date:** 2026-03-29
- **Context:** The `/plan` page needs a completion percentage for each of 365 rows. Lazy loading per row would fire up to 365 API calls as the user scrolls.
- **Decision:** Build `GET /plan/:planId/days/summary` that batches `count_verses_read_in_range` RPC calls with a concurrency limit of 20 simultaneous calls. A single Postgres lateral join was considered but rejected due to complexity of parameterising 365 range pairs in one query.
- **Action taken by:** Claude Sonnet 4.6 — implemented in `plan.service.ts` `getAllDaysSummary`.
- **Status:** Done in Phase 3, commit `c6c51a4`.

---

### [DISCUSSION-011] Long-press — Pointer Events API over separate Mouse/Touch events

- **Raised by:** Claude Sonnet 4.6
- **Date:** 2026-03-29
- **Context:** Long-press (600ms hold) is required for the verse selector modal on `ChapterTile`. Using `onMouseDown`/`onTouchStart` separately would require duplicated logic and could fire both on touch devices.
- **Decision:** Use the unified Pointer Events API (`onPointerDown`, `onPointerUp`, `onPointerLeave`, `onPointerCancel`). A 600ms timer starts on `onPointerDown`; if `onPointerUp` fires before 600ms it is a tap; if the timer fires first it is a long-press. Also set `user-select: none` and `touch-action: manipulation` to prevent text selection and double-tap zoom on mobile.
- **Action taken by:** Claude Sonnet 4.6 — implemented in `ChapterTile.tsx`.
- **Status:** Done in Phase 2.

---

### [DISCUSSION-012] Guest mode before auth — no sign-up required

- **Raised by:** Leroy Joice Dsouza (human, project owner)
- **Date:** 2026-03-29
- **Context:** Requiring account creation before reading creates friction that conflicts with the "no pressure" ethos of the product.
- **Decision:** First visit auto-generates a UUID guest token via `POST /auth/guest`, creates a row in the `users` table, and stores the token in `localStorage`. All progress endpoints work for guest users via `X-Guest-Token` header. When the user optionally signs up later (Phase 5), their `verse_reads` are migrated from the guest user to the authenticated account.
- **Action taken by:** Claude Sonnet 4.6 — `POST /auth/guest` and `AuthGuard` implemented in Phase 2; guest migration scaffolded in Phase 5 spec.
- **Status:** Guest auth done (Phase 2). Migration deferred to Phase 5.

---

### [DISCUSSION-013] jw.org deep-link URL format locked as a single constant

- **Raised by:** Claude Sonnet 4.6
- **Date:** 2026-03-29
- **Context:** The jw.org URL format could be inlined in multiple places, making it hard to update if jw.org changes their URL structure.
- **Decision:** Define one constant `JW_LINK_BASE_URL` in `lib/jwLink.ts`. All link construction goes through `buildJwLink(usfmCode, chapterNumber)`. Unknown USFM codes throw a descriptive error rather than silently producing a broken URL. Format: `https://www.jw.org/finder?wtlocale=E&bible={BB}{CCC}&pub=nwt` where BB = 2-digit book sort_order, CCC = 3-digit chapter number.
- **Action taken by:** Claude Sonnet 4.6 — implemented in `apps/web/lib/jwLink.ts`, verified with 60 tests.
- **Status:** Done in Phase 1.

---

### [ISSUE-001] Route ordering conflict — `days/summary` shadowed by `day/:dayNumber`

- **Raised by:** Claude Sonnet 4.6
- **Date:** 2026-03-29
- **Phase:** 3
- **Problem:** `GET /plan/:planId/days/summary` was being matched by the `day/:dayNumber` parameterised route because NestJS resolves routes in declaration order. Requests to `/days/summary` were hitting the wrong handler with `dayNumber = "summary"`.
- **Fix:** Moved `days/summary` route registration above `day/:dayNumber` in `plan.controller.ts`.
- **File:** [apps/api/src/plan/plan.controller.ts](apps/api/src/plan/plan.controller.ts)
- **Status:** Fixed in commit `c6c51a4`

---

### [ISSUE-002] TypeScript strict cast — Supabase nested join return type

- **Raised by:** Claude Sonnet 4.6
- **Date:** 2026-03-30
- **Phase:** 3
- **Problem:** `plan.service.ts` cast a Supabase query result directly to a typed object (`data as { number: number; chapters: { ... } }`). TypeScript strict mode (`noUncheckedIndexedAccess`) rejected the direct cast because the Supabase client types the return as `unknown` for nested joins.
- **Fix:** Changed to `data as unknown as { ... }` with an ESLint suppression comment.
- **File:** [apps/api/src/plan/plan.service.ts](apps/api/src/plan/plan.service.ts) line ~213
- **Status:** Fixed locally, uncommitted

---

### [ISSUE-003] TypeScript strict cast — Supabase query chain type narrowing

- **Raised by:** Claude Sonnet 4.6
- **Date:** 2026-03-30
- **Phase:** 2
- **Problem:** `progress.service.ts` used `ReturnType<typeof db.from>` as a cast for the query chain when conditionally appending a `.not()` filter. The Supabase client's builder type narrows after each call, making that cast incorrect after chaining.
- **Fix:** Changed both casts to `query as any` with ESLint suppression comments.
- **File:** [apps/api/src/progress/progress.service.ts](apps/api/src/progress/progress.service.ts) lines ~136–140
- **Status:** Fixed locally, uncommitted

---

### [DISCUSSION-001] Progress log & agent attribution document

- **Raised by:** Leroy Joice Dsouza (human, project owner)
- **Date:** 2026-03-30
- **Context:** No single document tracked who did what, what issues were raised, or what the next step was across sessions. This made handoffs between agents/sessions unclear.
- **Decision:** Create `12_PROGRESS_LOG.md` as the canonical live changelog. Every agent must read and update it at the start and end of each work session.
- **Action taken by:** Claude Sonnet 4.6 — created this document, added it to `00_INDEX.md` and project memory.
- **Status:** Done 2026-03-30

---

### [DISCUSSION-002] README clarity — setup and run instructions insufficient

- **Raised by:** Leroy Joice Dsouza (human, project owner)
- **Date:** 2026-03-30
- **Context:** The README did not explain how to create the Supabase project, where to find credentials, how to create the required `count_verses_read_in_range` RPC, or what to expect when first running the app.
- **Decision:** Rewrite README with explicit step-by-step setup, RPC SQL block, seed verification, startup verification checklist, and troubleshooting section.
- **Action taken by:** Claude Sonnet 4.6 — rewrote `README.md`.
- **Status:** Done 2026-03-30

---

## Agent Registry

| Agent Name | Type | Notes |
| --- | --- | --- |
| Claude Sonnet 4.6 | AI (Anthropic) | Primary builder, Phases 1–3 |
| Leroy Joice Dsouza | Human | Project owner, reviewer |

_Add new agents here when they first contribute to the project._

---

## Version History

| Version | Date | Changed By | Notes |
| --- | --- | --- | --- |
| 1.0 | 2026-03-30 | Claude Sonnet 4.6 | Initial document created; Phases 1–3 backfilled |
| 1.1 | 2026-03-30 | Claude Sonnet 4.6 | Added ISSUE-001–003, DISCUSSION-001–002 |
| 1.2 | 2026-03-30 | Claude Sonnet 4.6 | Added DISCUSSION-003–013 (all March 29 architectural decisions) |
| 1.3 | 2026-03-30 | Claude Sonnet 4.6 | Phase 4 complete — guest auto-provisioning, offline queue, nudge, 27 tests passing |
