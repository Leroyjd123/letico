# Lectio — Comprehensive Implementation Plan

## Architectural Principles (Read Before Executing Anything)

These are load-bearing decisions that every phase depends on:

1. `verse_reads` is never bypassed. Every UI action that marks progress — tap, long-press, mark-day-complete — ultimately calls `POST /progress/verses`. There is no other write path.
2. No derived state is stored. Completion %, streak, and ahead/behind are computed at query time from `verse_reads`. Never cache them in the DB.
3. All `verse_reads` inserts use upsert with `{ onConflict: 'user_id,verse_id', ignoreDuplicates: true }`. Any insert without this is a bug.
4. `global_order` never appears in an API response. It is an internal implementation detail used only for range arithmetic inside services.
5. CSS tokens only. No hardcoded hex values, no Tailwind. Every colour, spacing, radius, and shadow references a CSS custom property.
6. Controllers are routing-only. Zero business logic may live in a NestJS controller.
7. React Query for all server state. No raw `fetch` inside hooks or components.

---

## Phase 1 — Foundation (5–7 days)

### Goal
A runnable monorepo with a migrated database, seeded Bible data, functional API endpoints for Bible content, and a frontend that renders with the correct design system.

### Task Sequence

#### Task 1.1 — Monorepo Scaffold
**Files to create:**
- `/lectio/package.json` — pnpm workspaces root with `workspaces: ["apps/*", "packages/*"]`, scripts: `dev`, `build`, `test`, `lint`
- `/lectio/turbo.json` — pipeline: `build` depends on `^build`; `dev` has no cache; `test` and `lint` are independent
- `/lectio/pnpm-workspace.yaml` — lists `apps/*` and `packages/*`
- `/lectio/.gitignore` — includes `.env`, `.env.local`, `node_modules`, `.next`, `dist`
- `/lectio/.env.example` — documents all 7 env vars with placeholder values and a comment for each

**Dependencies:** None. This is the first task.

**Validation:** `pnpm install` completes without error. `pnpm -r ls` lists all workspaces.

---

#### Task 1.2 — Shared tsconfig Package
**Files to create:**
- `/lectio/packages/tsconfig/package.json` — `name: "@lectio/tsconfig"`, no main, just files
- `/lectio/packages/tsconfig/base.json` — `strict: true`, `noImplicitAny: true`, `exactOptionalPropertyTypes: true`, `noUncheckedIndexedAccess: true`, `esModuleInterop: true`
- `/lectio/packages/tsconfig/nextjs.json` — extends base, adds `jsx: "preserve"`, `lib: ["dom", "dom.iterable", "esnext"]`

**Dependencies:** Task 1.1 (workspace must exist first)

**Gotcha:** `noUncheckedIndexedAccess` will require explicit undefined checks on array access everywhere. This is intentional and catches real bugs — do not disable it.

---

#### Task 1.3 — Shared Types Package
**Files to create:**
- `/lectio/packages/types/package.json` — `name: "@lectio/types"`, `main: "./src/index.ts"`, `types: "./src/index.ts"`
- `/lectio/packages/types/tsconfig.json` — extends `@lectio/tsconfig/base.json`
- `/lectio/packages/types/src/index.ts` — exports all domain interfaces:

```typescript
// Domain interfaces to define in this file:
interface Book { id: number; usfmCode: string; name: string; testament: 'OT' | 'NT'; chapterCount: number; }
interface Chapter { id: number; bookId: number; number: number; verseCount: number; }
interface Verse { id: number; chapterId: number; number: number; text: string; }
interface PlanDayView { dayNumber: number; label: string; book: string; chapter: number; startVerse: number; endVerse: number; startVerseId: number; endVerseId: number; isToday: boolean; offsetFromToday: number; }
interface VerseReadResult { inserted: number; alreadyRead: number; }
interface ContinuePosition { bookUsfm: string; bookName: string; chapterNumber: number; verseNumber: number; verseId: number; }
interface ProgressSummary { totalVersesRead: number; completionPct: number; streakDays: number; aheadBehindVerses: number | null; }
interface GuestUser { guestToken: string; createdAt: string; }
interface VerseRange { startVerseId: number; endVerseId: number; }
```

- `/lectio/packages/types/src/tokens.ts` — design token constants + `buildCssTokenString()` function that returns a string of CSS custom property declarations to be injected into `:root`

The token constants in `tokens.ts` must define every token as a typed object:
```typescript
// Structure to implement — values are exact from design system doc:
const COLOR_TOKENS = { bgPage: '#faf9f6', bgSurface: '#f4f3f0', bgElevated: '#ffffff', primary: '#4d614f', ... } as const;
const SPACE_TOKENS = { space1: '0.25rem', space2: '0.5rem', ... space16: '4rem' } as const;
const RADIUS_TOKENS = { sm: '4px', md: '8px', lg: '12px', xl: '16px', full: '9999px' } as const;
const FONT_TOKENS = { headline: 'Manrope, sans-serif', body: 'Inter, sans-serif' } as const;
// buildCssTokenString() iterates all tokens and produces:
// "--color-bg-page: #faf9f6; --color-bg-surface: #f4f3f0; ..."
```

**Dependencies:** Task 1.2

**Gotcha:** The `buildCssTokenString()` function is what gets injected into the root layout's `<style>` tag. It must produce valid CSS custom property syntax. Test this function manually before wiring it to the layout.

---

#### Task 1.4 — NestJS App Scaffold
**Files to create:**
- `/lectio/apps/api/package.json` — NestJS dependencies: `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`, `@nestjs/cache-manager`, `@supabase/supabase-js`, `class-validator`, `class-transformer`, `reflect-metadata`
- `/lectio/apps/api/tsconfig.json` — extends `@lectio/tsconfig/base.json`, adds `experimentalDecorators: true`, `emitDecoratorMetadata: true`
- `/lectio/apps/api/src/main.ts` — bootstrap NestJS, enable `ValidationPipe` globally, set CORS with `FRONTEND_URL` from env, listen on `PORT` env var defaulting to `4000`
- `/lectio/apps/api/src/app.module.ts` — imports `CacheModule.register({ ttl: 86400 })`, `BibleModule`, and later modules
- `/lectio/apps/api/src/supabase/supabase.provider.ts` — `@Injectable()` provider that creates a Supabase client using `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from `process.env`
- `/lectio/apps/api/src/supabase/supabase.module.ts` — exports `SupabaseProvider`
- `/lectio/apps/api/src/supabase/inject-supabase.decorator.ts` — `@InjectSupabase()` decorator that resolves the provider token

**Dependencies:** Tasks 1.2, 1.3

**Gotcha:** `emitDecoratorMetadata: true` requires the `reflect-metadata` import at the very top of `main.ts` before any NestJS imports. Missing this causes cryptic DI errors.

---

#### Task 1.5 — Database Migration
**Files to create:**
- `/lectio/apps/api/supabase/migrations/001_initial_schema.sql`

This single migration must contain in this exact order:
1. `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`
2. Table DDL for `books`, `chapters`, `verses` (with `global_order BIGINT NOT NULL UNIQUE`)
3. `CREATE INDEX verses_global_order_idx ON public.verses (global_order);`
4. Table DDL for `plans`, `plan_days`
5. Table DDL for `users` (with `guest_token TEXT UNIQUE`, `archived_at TIMESTAMPTZ`)
6. Table DDL for `verse_reads` (with `UNIQUE(user_id, verse_id)`)
7. Three indexes on `verse_reads`: `user_id`, `(user_id, read_at)`, `verse_id`
8. Table DDL for `archived_verse_reads`
9. `CREATE INDEX plan_days_plan_id_idx ON public.plan_days (plan_id);`
10. The `count_verses_read_in_range` SQL function (exactly as specified in `04_DATABASE_SCHEMA.md`)
11. All RLS `ENABLE ROW LEVEL SECURITY` statements
12. All RLS policies (publicly readable for bible tables; own-row-only for users and verse_reads)

**Dependencies:** Task 1.1

**Gotcha:** The RLS policy for `verse_reads` INSERT uses `WITH CHECK (auth.uid() = user_id)`. Guest users do not go through Supabase Auth, so the backend service role key must be used for all guest write operations — the service role key bypasses RLS. This means the NestJS API must never use the anon key for write operations.

---

#### Task 1.6 — Bible Seed Script
**Files to create:**
- `/lectio/apps/api/src/bible/seed/kjv-data.json` — the raw KJV Bible JSON. Structure: `{ books: [{ usfmCode, name, testament, chapters: [{ number, verses: [{ number, text }] }] }] }`
- `/lectio/apps/api/src/bible/seed/seed.ts` — seed script (runnable as `ts-node`)

The seed script must:
1. Connect to Supabase using service role key from env
2. Insert 66 books in canonical order (sort_order 1–66)
3. For each book, insert chapters
4. For each chapter, insert verses, computing `global_order` as a single incrementing counter starting at 1 across the entire Bible (Genesis 1:1 = 1, Genesis 1:2 = 2, ... Revelation 22:21 = 31102)
5. Insert 3 plan rows (1yr, 2yr, chronological)
6. Insert 365 plan_day rows for the 1yr plan by dividing 31,102 verses into approximately equal daily ranges
7. Assert: `SELECT COUNT(*) FROM verses` must equal 31,102. If not, throw and exit non-zero.
8. Print: "31,102 verses seeded" on success

- `/lectio/apps/api/package.json` — add scripts: `db:migrate`, `db:seed`, `db:verify`

**Dependencies:** Tasks 1.4, 1.5

**Gotcha for plan_day generation:** The 1yr plan has 365 days and 31,102 verses, which is 85.2 verses/day average. Do not create exactly equal splits — chapters must not be split mid-chapter. Each plan_day boundary must fall on a chapter end. Precompute chapter boundaries by global_order, then greedily assign chapters to days targeting ~85 verses per day.

**Gotcha for global_order:** The global_order counter must be strictly sequential with no gaps. Any gap will break `firstUnreadInRange` and `continue reading` logic. Validate during seed by checking that `MAX(global_order) = COUNT(*)`.

---

#### Task 1.7 — BibleModule (API)
**Files to create:**
- `/lectio/apps/api/src/bible/bible.types.ts` — internal types: `BookRow`, `ChapterRow`, `VerseRow` (database shapes); `BookDto`, `ChapterDto`, `VerseDto` (API response shapes without `global_order`)
- `/lectio/apps/api/src/bible/bible.service.ts` — implements:
  - `getAllBooks(): Promise<BookDto[]>` — queries `books` ordered by `sort_order`
  - `getBookByUsfm(usfmCode: string): Promise<BookDto>` — normalizes to uppercase, throws `NotFoundException` with code `BOOK_NOT_FOUND` if missing
  - `getChaptersByBook(usfmCode: string): Promise<ChapterDto[]>` — joins through books, orders by `number`
  - `getVersesByChapter(chapterId: number): Promise<VerseDto[]>` — selects all columns except `global_order`, throws `NotFoundException` with code `CHAPTER_NOT_FOUND` if chapter doesn't exist
  - Private mapper functions: `toBookDto(row: BookRow): BookDto`, `toChapterDto(row: ChapterRow): ChapterDto`, `toVerseDto(row: VerseRow): VerseDto`
- `/lectio/apps/api/src/bible/bible.controller.ts` — four routes, routing only, no logic, applies `@UseInterceptors(CacheInterceptor)` with appropriate TTL overrides
- `/lectio/apps/api/src/bible/bible.module.ts` — registers controller and service, imports `SupabaseModule`
- `/lectio/apps/api/src/bible/bible.service.spec.ts` — unit tests (see test section below)

**Dependencies:** Tasks 1.4, 1.5, 1.6

**Gotcha:** `global_order` must be selected in the DB query (needed for internal sorting) but stripped before returning the DTO. Never select `*` and return it directly — always map through `toVerseDto` which explicitly omits `global_order`.

---

#### Task 1.8 — verseRange Utility (Frontend)
**Files to create:**
- `/lectio/apps/web/lib/verseRange.ts` — pure utility functions with no dependencies:
  - `interface VerseRange { startVerseId: number; endVerseId: number; }` (local to this file, no import needed if `@lectio/types` exports it)
  - `mergeRanges(ranges: VerseRange[]): VerseRange[]` — sort by startVerseId, merge overlapping/adjacent
  - `countVersesInRanges(ranges: VerseRange[]): number` — sum of (end - start + 1) after merging
  - `isVerseInRanges(verseId: number, ranges: VerseRange[]): boolean` — binary search for efficiency
  - `firstUnreadInRange(readVerseIds: Set<number>, range: VerseRange): number | null`
  - `rangeCompletionRatio(readVerseIds: Set<number>, range: VerseRange): number` — 0 to 1, handles zero-length range (returns 0, no divide-by-zero)
  - `subtractRanges(target: VerseRange, subtracted: VerseRange[]): VerseRange[]` — returns portions of `target` not covered by any range in `subtracted`

- `/lectio/apps/web/__tests__/verseRange.test.ts` — 22+ unit tests covering every case in `08_TESTING_GUIDELINES.md` Section 4

**Dependencies:** Task 1.1

**Critical invariant:** `rangeCompletionRatio` must return `0` when range has 0 verses (startVerseId === endVerseId edge case or empty range), never `NaN` or throw.

**Test writing point:** Write the tests FIRST (TDD) for `verseRange.ts`. The spec table in `08_TESTING_GUIDELINES.md` §4 is complete. All 22+ cases must be written before implementing the functions. This ensures 100% branch coverage is achieved by design.

---

#### Task 1.9 — jwLink Utility (Frontend)
**Files to create:**
- `/lectio/apps/web/lib/jwLink.ts`:
  - `const JW_LINK_BASE_URL = 'https://www.jw.org/finder' as const;` — one named constant, never hardcoded elsewhere
  - `buildJwLink(usfmCode: string, chapterNumber: number): string` — constructs `https://www.jw.org/finder?wtlocale=E&bible={BOOK_NUM}{CHAPTER_PADDED}&pub=nwt` where `BOOK_NUM` is the canonical Bible book number (1=GEN, 2=EXO...66=REV) and `CHAPTER_PADDED` is the chapter zero-padded to 3 digits (e.g. chapter 12 → "012")
  - `const USFM_TO_BOOK_NUM: Record<string, number>` — mapping of all 66 USFM codes to their canonical numbers

- `/lectio/apps/web/__tests__/jwLink.test.ts` — 100% branch coverage:
  - Genesis 1 → correct URL
  - Revelation 22 → correct URL
  - Chapter number padding (single digit, double digit, triple digit)
  - Unknown USFM code → throws with descriptive error (never silently produces a broken link)

**Dependencies:** Task 1.1

**Gotcha:** The jw.org URL format from the PRD is `?wtlocale=E&bible={BOOK}{CHAPTER}&pub=nwt`. The book number is the canonical Bible order number (GEN=1), not the USFM code itself. The chapter must be zero-padded to 3 digits. Verify the exact format in `01_PRD.md` assumption A4 before implementing.

---

#### Task 1.10 — Next.js App Scaffold
**Files to create:**
- `/lectio/apps/web/package.json` — Next.js 14, React 18, `@tanstack/react-query`, `@supabase/supabase-js`, `@supabase/ssr`, `idb` (IndexedDB wrapper)
- `/lectio/apps/web/tsconfig.json` — extends `@lectio/tsconfig/nextjs.json`
- `/lectio/apps/web/next.config.ts` — minimal config, no special options needed in Phase 1
- `/lectio/apps/web/app/layout.tsx` — root layout:
  - Server Component
  - Loads Manrope and Inter via `next/font/google` with `variable` config
  - Injects `buildCssTokenString()` result from `@lectio/types` into a `<style>` tag on `:root`
  - Sets `<html lang="en">` and applies both font CSS variables to `<body>`
  - Sets `background-color: var(--color-bg-page)` on body
- `/lectio/apps/web/app/globals.css` — CSS reset:
  - `*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }`
  - `body { font-family: var(--font-body); color: var(--color-text-primary); }`
  - Focus-visible ring: `outline: 2px solid var(--color-primary); outline-offset: 2px`
  - Removes default outline, restores only on `:focus-visible`
- `/lectio/apps/web/app/page.tsx` — temporary home (redirects to `/read` or shows token smoke-test swatches)
- `/lectio/apps/web/lib/queryClient.ts` — `QueryClient` instance with stale times: `defaultOptions: { queries: { staleTime: 30_000 } }`
- `/lectio/apps/web/components/providers/QueryProvider.tsx` — `'use client'`, wraps children in `QueryClientProvider`

**Dependencies:** Tasks 1.2, 1.3

---

#### Task 1.11 — UI Primitives: Text and Button
**Files to create:**
- `/lectio/apps/web/components/ui/Text.tsx`:
  - `'use client'` only if needed; can likely be a Server Component
  - Props: `variant`, `color`, `as`, `lowercase`, `className`, `style`
  - Maps each `variant` to its type scale values via inline styles using CSS custom properties
  - `text-transform: lowercase` applied only when `lowercase !== false`
  - Uses `as` prop to render semantic HTML (default: `p` for body, `h1` for display, `span` for label/caption)
  - Must enforce weight never exceeds 500 in UI chrome — the design system explicitly forbids 700/800

- `/lectio/apps/web/components/ui/Button.tsx`:
  - `'use client'`
  - Props: `variant`, `size`, `fullWidth`, `disabled`, `onClick`, `type`, `children`
  - `primary`: gradient `linear-gradient(135deg, var(--color-primary), #657a67)`, pill-shaped (`border-radius: var(--radius-full)`), white text
  - `ghost`: transparent background, primary-coloured text/border
  - `text`: no background, no border, just text
  - Scale on active: `transform: scale(0.94)` via CSS `:active`
  - Disabled: `opacity: 0.45`, `cursor: not-allowed`
  - No hardcoded colours — note that `#657a67` needs a token in `tokens.ts` (`--color-primary-container`)

- `/lectio/apps/web/components/ui/ProgressBar.tsx`:
  - Props: `value` (0–100), `label`, `height`
  - Track: `var(--color-bg-surface)`; fill: `var(--color-primary)`
  - Smooth transition on value change: `transition: width 200ms var(--easing-standard)`

**Dependencies:** Tasks 1.3, 1.10

**Test writing point:** Write Storybook stories for Text and Button immediately after implementation. Stories serve as the visual regression baseline for Phase 7.

---

#### Task 1.12 — Frontend API Client
**Files to create:**
- `/lectio/apps/web/lib/api.ts` — typed fetch wrappers for every endpoint:
  - All functions accept an optional `headers` parameter for auth (Bearer token or X-Guest-Token)
  - Return types match the interfaces in `@lectio/types`
  - Error shape: `{ error: { code: string; message: string } }` — unwrap and throw a typed `ApiError` class
  - `class ApiError extends Error { code: string; status: number; }`
  - Functions: `getBooks()`, `getBook(usfmCode)`, `getChapters(usfmCode)`, `getVerses(chapterId)`, `getPlanToday(auth)`, `getPlanDay(planId, dayNumber, auth)`, `markVersesRead(verseIds, auth)`, `getContinuePosition(auth)`, `getProgressSummary(auth)`, `sendOtp(email)`, `verifyOtp(email, token)`, `createGuest()`, `migrateGuest(guestToken, auth)`

- `/lectio/apps/web/lib/supabase.ts` — browser Supabase client factory using `@supabase/ssr` and the `NEXT_PUBLIC_*` env vars

**Dependencies:** Tasks 1.3, 1.10

**Gotcha:** The `createGuest()` function is called with no auth. All other progress and plan endpoints require either a Bearer token or an `X-Guest-Token` header. The `api.ts` layer must handle both auth modes cleanly — consider an `AuthContext` type: `{ type: 'bearer'; token: string } | { type: 'guest'; guestToken: string }`.

---

### Phase 1 Tests to Write

| File | Tests | Coverage Target |
|---|---|---|
| `apps/web/__tests__/verseRange.test.ts` | 22+ cases per §4 of testing guide | 100% branch |
| `apps/web/__tests__/jwLink.test.ts` | 6+ cases | 100% branch |
| `apps/api/src/bible/bible.service.spec.ts` | 7 cases per §5 of testing guide | ≥90% line |

Write `verseRange` and `jwLink` tests before implementing the functions (TDD). Write `bible.service.spec.ts` after implementing the service.

---

### Phase 1 Exit Invariants to Validate

1. `pnpm dev` starts both apps without TypeScript errors or runtime crashes
2. `GET http://localhost:4000/api/bible/books` returns a JSON array of exactly 66 items in `data`
3. `GET http://localhost:4000/api/bible/chapters/1/verses` returns verses with text, no `global_order` field in response
4. `SELECT COUNT(*) FROM verses` in Supabase = 31,102
5. `SELECT MAX(global_order) FROM verses` = 31,102 (no gaps)
6. `http://localhost:3000` renders with background `#faf9f6` (inspect computed style)
7. Manrope font loaded and applied to the `lectio` wordmark
8. CSS custom properties visible in browser DevTools under `:root`
9. All unit tests pass: `pnpm test`
10. No `any` types in any TypeScript file

---

### Phase 1 Architectural Risks

- **Risk:** `global_order` gaps in seed data will cause `firstUnreadInRange` to skip verses permanently. Validate with `SELECT global_order, global_order - ROW_NUMBER() OVER (ORDER BY global_order) AS gap FROM verses HAVING gap != 0` — must return 0 rows.
- **Risk:** The 1yr plan's day boundaries crossing chapter midpoints will cause a day to show partial read state when users think they've read a whole day. Ensure every `plan_day.start_verse_id` aligns to the first verse of a chapter and every `end_verse_id` aligns to the last verse of a chapter.
- **Risk:** Missing `emitDecoratorMetadata: true` in NestJS tsconfig causes silent DI failures. Verify by running `pnpm build` in `apps/api` and checking for decorator-related errors.

---

## Phase 2 — Reading & Progress (8–10 days)

### Goal
A user can see today's passage, open it in jw.org, mark chapters read (tap or long-press), use mark-day-complete, and see the progress bar and continue pill update in real time.

### Task Sequence

#### Task 2.1 — PlanModule (API)
**Files to create:**
- `/lectio/apps/api/src/plan/plan.types.ts` — `PlanDayRow` (DB shape), `PlanDayViewDto` (API response matching `PlanDayView` interface)
- `/lectio/apps/api/src/plan/plan.service.ts`:
  - `getPlanToday(userId: string): Promise<PlanDayViewDto>` — computes `dayNumber = daysBetween(user.plan_start_date, today) + 1`, fetches `plan_days` row, joins to get verse and chapter data, returns `PlanDayViewDto`. If `plan_start_date` is null, return day 1.
  - `getPlanDay(planId: string, dayNumber: number, userId: string): Promise<PlanDayViewDto>` — same but for any day number. Throws `NotFoundException` with code `PLAN_DAY_NOT_FOUND` if day doesn't exist.
  - Private `buildLabel(startVerse, endVerse): string` — produces "genesis 12–15" style label
  - Private `computeOffsetFromToday(dayNumber, user): number` — negative for past, 0 for today, positive for future
- `/lectio/apps/api/src/plan/plan.controller.ts` — two routes: `GET /plan/today`, `GET /plan/:planId/day/:dayNumber`
- `/lectio/apps/api/src/plan/plan.module.ts`
- `/lectio/apps/api/src/plan/plan.service.spec.ts`

**Dependencies:** Tasks 1.4, 1.5, 1.6

**Gotcha:** `daysBetween` must use UTC dates, not local time. Use `Date.UTC()` for both `plan_start_date` and `now()` to avoid timezone-related off-by-one errors on the day boundary. This same rule applies to streak calculation in Phase 6.

---

#### Task 2.2 — ProgressModule: POST /progress/verses
**Files to create:**
- `/lectio/apps/api/src/progress/progress.types.ts` — `MarkVersesReadDto` (with class-validator decorators: `@IsArray()`, `@IsInt({ each: true })`, `@ArrayMinSize(1)`, `@ArrayMaxSize(500)`), `MarkVersesReadResponseDto`
- `/lectio/apps/api/src/progress/progress.service.ts`:
  - `markVersesRead(userId: string, verseIds: number[]): Promise<MarkVersesReadResponseDto>` — upserts into `verse_reads` with `{ onConflict: 'user_id,verse_id', ignoreDuplicates: true }`, sets `read_at: new Date().toISOString()` server-side (never trust client timestamp), returns `{ inserted, alreadyRead }`
  - The upsert result from Supabase with `ignoreDuplicates: true` returns the inserted rows only — use result length to compute `inserted`; `alreadyRead = verseIds.length - inserted`
- `/lectio/apps/api/src/progress/progress.controller.ts` — `POST /progress/verses` route
- `/lectio/apps/api/src/progress/progress.module.ts`
- `/lectio/apps/api/src/progress/progress.service.spec.ts`

**Dependencies:** Tasks 1.4, 1.5, 2.1 (module pattern established)

**Critical:** This is the write path for ALL progress. The upsert must use `ignoreDuplicates: true`. Any use of `.insert()` without upsert is a P0 bug. Add a comment in the service explaining why.

---

#### Task 2.3 — AuthGuard and User Resolution
**Files to create:**
- `/lectio/apps/api/src/auth/auth.guard.ts` — `@Injectable()` guard implementing `CanActivate`:
  - Checks `Authorization: Bearer <token>` header first, verifies with Supabase JWT verification
  - Falls back to `X-Guest-Token: <token>` header, looks up user by `guest_token` in users table
  - Attaches resolved `userId` to `request.user.id`
  - Throws `UnauthorizedException` with code `UNAUTHORIZED` if neither header is present or valid
- `/lectio/apps/api/src/auth/current-user.decorator.ts` — `@CurrentUser()` param decorator that extracts `request.user` from the execution context

**Dependencies:** Task 1.4, 2.2

**Gotcha:** Bearer token validation requires calling `supabase.auth.getUser(token)`. Guest token validation is a simple DB lookup. Both paths must resolve to a `userId` that is a valid UUID in the `users` table. If the guest_token is not found, return 401 (not 400 — the client should not know whether the token format was valid).

---

#### Task 2.4 — Home Screen Page (/read)
**Files to create:**
- `/lectio/apps/web/app/read/page.tsx` — Server Component:
  - Reads user context (from cookie/session)
  - Server-side fetches `GET /plan/today` for initial data
  - Passes `initialData` to `<ReadPageClient>`
- `/lectio/apps/web/app/read/ReadPageClient.tsx` — `'use client'`:
  - Wraps `TodayCard`, `ChapterGrid`, `ContinuePill`
  - Uses `useQuery` with `initialData` from server
  - Manages local state: `selectedChapterId` for the verse selector modal

**Dependencies:** Tasks 1.10, 1.12, 2.1

---

#### Task 2.5 — TodayCard Component
**Files to create:**
- `/lectio/apps/web/components/reader/TodayCard.tsx` — `'use client'`:
  - Props: `dayNumber`, `label`, `completionPct`, `onMarkDayComplete`, `isComplete`
  - Two states: initial (shows button) and success (shows check icon + "day N complete" + 100% bar)
  - Background: `var(--color-bg-surface)`; border-radius: `var(--radius-xl)`
  - "Mark day N complete" text uses the `dayNumber` prop — never hardcoded
  - On success: the button disappears; replaced by a check mark SVG icon and "day N complete" text
  - Progress bar uses `<ProgressBar>` from UI primitives
  - Success state transition: CSS `transition: opacity 200ms` — no bouncing or spring animation

**Dependencies:** Task 1.11, 2.4

---

#### Task 2.6 — useVerseRead Hook
**Files to create:**
- `/lectio/apps/web/hooks/useVerseRead.ts` — `'use client'`:
  - `markChapter(chapterId: number, verseIds: number[]): void` — gets verse IDs for chapter, writes to IndexedDB offline queue first, then calls mutation
  - `markRange(verseIds: number[]): void` — same but for a specific range
  - `markDayComplete(verseIds: number[]): void` — marks all verses in a plan day range
  - Uses `useMutation` with full optimistic update pattern (onMutate → onError rollback → onSettled invalidate)
  - Query key for optimistic cache: `['verse-reads', userId]` with a `Set<number>` as the value
  - On `onMutate`: cancels `['progress']` queries, snapshots current Set, adds new verseIds to Set
  - On `onError`: restores previous Set
  - On `onSettled`: `invalidateQueries(['progress'])` and `invalidateQueries(['plan'])`
  - Checks `navigator.onLine` before calling API; writes to IndexedDB queue if offline

**Dependencies:** Tasks 1.12, 2.2, 2.3

**Test writing point:** Write `apps/web/__tests__/hooks/useVerseRead.test.ts` with the 4 cases from testing guidelines §7 immediately after implementation.

---

#### Task 2.7 — ChapterTile Component
**Files to create:**
- `/lectio/apps/web/components/reader/ChapterTile.tsx` — `'use client'`:
  - Props: `chapterNumber`, `readState`, `onTap`, `onLongPress`
  - CSS: `user-select: none; touch-action: manipulation` — prevents text selection on mobile long-press (this is edge case E11 from PRD)
  - Long-press detection: `onPointerDown` starts a 600ms timer; if `onPointerUp` fires before 600ms → call `onTap`; if 600ms elapses before `onPointerUp` → cancel tap, call `onLongPress`
  - Use `onPointerDown`/`onPointerUp`/`onPointerLeave`/`onPointerCancel` (not `onMouseDown`/`onTouchStart`) for unified pointer handling
  - State-based visual classes applied via inline styles with CSS custom properties:
    - `read`: background `var(--color-primary)`, color `#ffffff`, check icon visible
    - `partial`: background `var(--color-bg-surface)` with a bottom-half overlay `rgba(77,97,79,0.15)`
    - `unread`: background `var(--color-bg-elevated)` with ghost border `rgba(77,97,79,0.1)`
    - `locked`: `opacity: 0.35`, `pointerEvents: none`
  - Active tap feedback: `transform: scale(0.94)` via `:active` CSS or `onPointerDown` state
  - Hover hint: "hold to select verses" fades in (opacity 0 → 1 on hover) — important for desktop usability
  - `aria-label`: "chapter N, read" / "chapter N, partially read" / "chapter N, unread"

**Dependencies:** Task 1.11, 2.6

---

#### Task 2.8 — ChapterGrid Component
**Files to create:**
- `/lectio/apps/web/components/reader/ChapterGrid.tsx` — `'use client'`:
  - Props: `chapters: ChapterGridItem[]`, `onTap`, `onLongPress`, `upcomingLabel?`
  - Asymmetric bento grid (4-column base with deliberate breaks — see design reference screenshot)
  - Renders `<ChapterTile>` for each chapter
  - The "upcoming reflection" card is a 2-column span card that appears between chapters — its position creates the intentional asymmetry
  - CSS grid: `grid-template-columns: repeat(4, 1fr)`, with the reflection card using `grid-column: span 2`

**Dependencies:** Task 2.7

---

#### Task 2.9 — VerseSelectorModal Component
**Files to create:**
- `/lectio/apps/web/components/modals/VerseSelectorModal.tsx` — `'use client'`:
  - Props: `isOpen`, `chapterName`, `totalVerses`, `readVerseIds`, `onMarkFull`, `onSaveRange`, `onClose`
  - Entry animation: slides up from `translateY(100%)` to `translateY(0)` in 280ms
  - Overlay: `rgba(27,28,26,0.25)` with `backdrop-filter: blur(2px)` — clicking overlay calls `onClose`
  - Range slider: dual-thumb (start and end verse). Use a single `<input type="range">` or build a custom dual-thumb slider. The selected range updates the verse dot grid in real time.
  - Verse dot grid: 6-column grid. Each dot represents one verse. Dots are coloured: read (filled `var(--color-primary)`), selected (filled primary at 70% opacity), unread (`var(--color-bg-surface)`)
  - "mark full chapter" button: variant `primary`, calls `onMarkFull`
  - "save selected range" button: variant `ghost`, calls `onSaveRange(startVerse, endVerse)` — note these are 1-based verse numbers, not IDs
  - The parent must convert verse numbers to verse IDs before calling `markRange`

**Dependencies:** Tasks 1.11, 2.6

**Gotcha:** Building a dual-thumb range slider with no external library requires careful DOM manipulation. Use two overlapping `<input type="range">` elements with CSS to style the track fill, or use the `appearance: none` approach. This is one of the most complex UI components. Budget 1.5–2 days.

---

#### Task 2.10 — OpenInJWButton Component
**Files to create:**
- `/lectio/apps/web/components/reader/OpenInJWButton.tsx`:
  - Props: `book` (USFM code), `chapter`, `label`
  - Calls `buildJwLink()` from `lib/jwLink.ts`
  - Renders as `<a href={url} target="_blank" rel="noopener noreferrer">` — uses native anchor for correct browser behaviour
  - Style: Button variant `ghost`
  - `aria-label`: "open {label} in jw.org (opens in new tab)"

**Dependencies:** Tasks 1.9, 1.11

---

#### Task 2.11 — ContinuePill Component
**Files to create:**
- `/lectio/apps/web/components/reader/ContinuePill.tsx` — `'use client'`:
  - Props: `position: ContinuePosition | null`, `onClick`
  - Floating pill, sticky above bottom nav
  - When `position` is not null: "continue reading → {bookName} {chapter}" with arrow icon
  - When `position` is null: "you've finished" — muted styling, no celebration
  - Background: `var(--color-primary)`, shadow: `0 8px 40px rgba(77,97,79,0.25)`
  - CSS: `position: fixed; bottom: calc(var(--bottom-nav-height) + var(--space-4))`

- `/lectio/apps/web/hooks/useContinueReading.ts`:
  - `useQuery` against `GET /progress/continue`
  - Stale time: 30 seconds

**Dependencies:** Tasks 1.11, 1.12, 2.3

---

### Phase 2 Tests to Write

| File | Tests |
|---|---|
| `apps/api/src/plan/plan.service.spec.ts` | `getPlanToday` with null start date, with past date; `getPlanDay` found/not found |
| `apps/api/src/progress/progress.service.spec.ts` | 8 cases from testing guide §5 |
| `apps/web/__tests__/hooks/useVerseRead.test.ts` | 4 cases from testing guide §7 |
| `apps/web/__tests__/components/ChapterTile.test.tsx` | 7 cases from testing guide §6 |
| `apps/web/__tests__/components/VerseSelectorModal.test.tsx` | 6 cases |
| `apps/web/__tests__/components/TodayCard.test.tsx` | 6 cases |

---

### Phase 2 Exit Invariants

1. `GET /api/plan/today` returns a valid `PlanDayView` for day 1 (Genesis passage)
2. Tapping a chapter tile causes all verses for that chapter to appear in `verse_reads` — verify with direct Supabase query
3. Long press (held 600ms+) opens the verse selector modal; short press does not
4. "Save selected range" inserts exactly the selected verse range — not the full chapter
5. "Mark day complete" inserts all verses from `plan_day.start_verse_id` to `plan_day.end_verse_id`
6. `SELECT COUNT(*) FROM verse_reads WHERE user_id = ? AND verse_id IN (day_verses)` equals the day's total verse count after mark-day-complete
7. No duplicate rows can be created (re-tapping a read chapter produces 0 new inserts — verify via `alreadyRead` count in API response)
8. The jw.org link opens the correct chapter URL (manually verify in browser)
9. Progress bar reflects the correct percentage (total read / total in day's range)
10. Long-press does NOT trigger browser text selection on mobile (test on actual device or mobile emulation)

---

### Phase 2 Architectural Risks

- **Risk:** The dual-thumb range slider for verse selection has no accessible keyboard equivalent by default. The long-press alternative must also be triggerable via keyboard (Alt+Enter per the design system doc §11). Plan keyboard interaction from the start, not as a Phase 7 afterthought.
- **Risk:** The optimistic update for `useVerseRead` depends on `queryClient.getQueryData(['verse-reads', userId])` returning a `Set<number>`. If any other query sets this key with a different shape, the cast will be wrong. Use a dedicated query key factory object to avoid key collisions.
- **Risk:** `onPointerLeave` cancelling the long-press timer means if a user presses and slowly moves their finger off the tile, the modal never opens. This is acceptable UX but must be tested explicitly on touch devices.

---

## Phase 3 — Plan View & Continue Reading (4–5 days)

### Goal
Users can scroll through all 365 plan days, tap any day (past or future), and the continue reading pill navigates to the exact next unread verse globally.

### Task Sequence

#### Task 3.1 — GET /progress/continue (API)
**Files to modify:**
- `/lectio/apps/api/src/progress/progress.service.ts` — add:
  - `getContinuePosition(userId: string): Promise<ContinuePositionDto | null>` — finds the verse with the lowest `global_order` that has no `verse_reads` row for this user. Query: join `verses` with `verse_reads` using a `LEFT JOIN ... WHERE vr.id IS NULL`, order by `global_order ASC LIMIT 1`. Returns null if all verses read.
  - `ContinuePositionDto`: `{ bookUsfm, bookName, chapterNumber, verseNumber, verseId }` — note: never exposes `global_order`

**Files to modify:**
- `/lectio/apps/api/src/progress/progress.controller.ts` — add `GET /progress/continue` route

**Dependencies:** Task 2.2

**Gotcha:** The LEFT JOIN approach (`FROM verses v LEFT JOIN verse_reads vr ON v.id = vr.verse_id AND vr.user_id = ? WHERE vr.id IS NULL`) is the correct pattern. Do not use a `NOT IN` subquery — it performs poorly on 31,102 verse rows and will fail if verse_reads grows large.

---

#### Task 3.2 — Plan View Screen (/plan)
**Files to create:**
- `/lectio/apps/web/app/plan/page.tsx` — Server Component: no initial data needed (plan list is user-specific, fetched client-side)
- `/lectio/apps/web/app/plan/PlanPageClient.tsx` — `'use client'`:
  - Uses `useQuery` to fetch plan metadata (plan_id from user settings)
  - Renders a virtualized or windowed list of 365 `<PlanDayRow>` components
  - Scrolls to "today's" day on first render using a `ref` and `scrollIntoView`
  - No restriction on which days are visible or tappable

- `/lectio/apps/web/hooks/usePlanDay.ts`:
  - `usePlanDay(planId: string, dayNumber: number)` — wraps `useQuery` for `GET /plan/:planId/day/:dayNumber`
  - Stale time: 5 minutes

**Dependencies:** Tasks 2.4, 2.1

---

#### Task 3.3 — PlanDayRow Component
**Files to create:**
- `/lectio/apps/web/components/plan/PlanDayRow.tsx` — `'use client'`:
  - Props: `dayNumber`, `label`, `completionPct`, `isToday`, `offsetFromToday`, `onClick`
  - Visual hierarchy: day number (small, muted) + passage label (subheading) + thin progress bar underneath
  - Today's row: slightly elevated background (`var(--color-bg-elevated)`)
  - Past rows: no special treatment, not dimmed (users must be able to backfill freely)
  - Future rows: no special treatment (users must be able to read ahead freely)
  - `aria-label`: "day {N}, {label}, {X}% complete"
  - Minimum touch target: 44px height

**Dependencies:** Tasks 1.11, 3.2

**Rule check:** No "locked" or "disabled" state on any plan day row. R2 (no forced reading order) means all days are freely navigable.

---

#### Task 3.4 — Per-Day Completion %
**Architecture decision:** The plan view list has 365 rows. Fetching per-day completion for all 365 at once would require 365 API calls or a special batch endpoint. The pragmatic approach:

- Add a new endpoint: `GET /plan/:planId/all-days-summary` that returns all 365 day numbers with their completion %. This calls `count_verses_read_in_range` for each day. In Postgres this can be done in a single query using a lateral join or a set-returning function call.
- Alternatively: load completion % lazily as the user scrolls (virtual list with on-demand queries per visible row). This is simpler to implement but may show flashes of 0% as rows come into view.

**Recommended approach:** Batch query. Create a single endpoint that returns `Array<{ dayNumber, completionPct }>` for the entire plan in one round trip.

**Files to create:**
- `/lectio/apps/api/src/plan/plan.service.ts` — add `getAllDaysSummary(planId, userId)` 
- `/lectio/apps/api/src/plan/plan.controller.ts` — add `GET /plan/:planId/days/summary` route

**Dependencies:** Tasks 2.2, 3.2

---

### Phase 3 Tests to Write

| File | Tests |
|---|---|
| `apps/api/src/progress/progress.service.spec.ts` | Add: `getContinuePosition` found; all read → null |
| `apps/web/__tests__/components/PlanDayRow.test.tsx` | Renders correctly, onClick fires, today highlight |

---

### Phase 3 Exit Invariants

1. Plan view renders all 365 rows without errors
2. Scrolling auto-positions to today's row on first render
3. Tapping a past day row opens that day's chapter grid and allows marking
4. Tapping a future day row opens that day's chapter grid and allows marking (no restriction)
5. `GET /api/progress/continue` returns the correct verse after marking several chapters
6. If all 31,102 verses are read, the API returns `{ data: null }` — not an error
7. After marking a past day's chapter, that day's completion % updates in the plan view
8. No "you're behind" or "you missed" language appears anywhere in the plan view

---

## Phase 4 — Guest Mode & Offline (5–6 days)

### Goal
The app works fully without login. Progress writes go to IndexedDB when offline and sync on reconnect. Guest user row created in Supabase on first visit.

### Task Sequence

#### Task 4.1 — POST /auth/guest (API)
**Files to create:**
- `/lectio/apps/api/src/auth/auth.types.ts` — `CreateGuestResponseDto`
- `/lectio/apps/api/src/auth/auth.service.ts` — `createGuest(): Promise<CreateGuestResponseDto>`:
  - Generates a UUID v4 guest token
  - Creates a row in `users` table with `{ id: uuid(), email: null, guest_token: token, plan_id: defaultPlanId, plan_start_date: today }`
  - Returns `{ guestToken, createdAt }`
- `/lectio/apps/api/src/auth/auth.controller.ts` — `POST /auth/guest` (no auth guard)
- `/lectio/apps/api/src/auth/auth.module.ts`

**Dependencies:** Tasks 1.4, 1.5, 2.3

---

#### Task 4.2 — Guest Token Initialization (Frontend)
**Files to create:**
- `/lectio/apps/web/hooks/useAuth.ts` — `'use client'`:
  - On first mount, checks `localStorage.getItem('lectio_guest_token')`
  - If missing: calls `POST /auth/guest`, stores returned token in localStorage as `lectio_guest_token`
  - Exposes `{ userId, guestToken, isGuest, isAuthenticated }`
  - This is the single source of auth state for the frontend

- `/lectio/apps/web/components/providers/AuthProvider.tsx` — `'use client'`:
  - Wraps the app, calls `useAuth`, stores auth state in React context
  - All API calls retrieve auth context from here

**Dependencies:** Tasks 1.12, 4.1

**Gotcha:** Edge case E7: if `localStorage` is cleared, the guest token is gone. The app must silently generate a new guest token and create a new user row. This is expected behaviour — old progress is unrecoverable. No error should be shown to the user.

---

#### Task 4.3 — IndexedDB Offline Queue
**Files to create:**
- `/lectio/apps/web/lib/offlineQueue.ts` — wraps the `idb` library:
  - Database name: `lectio-offline`
  - Object store: `pending-reads` with keyPath `id` (auto-increment)
  - Schema: `{ id: number; verseIds: number[]; queuedAt: string; synced: boolean }`
  - Functions: `enqueueVerseReads(verseIds: number[]): Promise<void>`, `getPendingReads(): Promise<PendingRead[]>`, `markSynced(ids: number[]): Promise<void>`, `clearSynced(): Promise<void>`

- `/lectio/apps/web/hooks/useOfflineQueue.ts` — `'use client'`:
  - Listens to `window` events: `'online'` and `'offline'`
  - `isOnline` state: initialized from `navigator.onLine`
  - On `'online'` event: flush all `getPendingReads()` where `synced: false`, chunk into batches of ≤ 500 verse IDs, call `POST /progress/verses` for each batch, call `markSynced` on success, retry up to 3 times with exponential backoff on failure
  - After all batches: `queryClient.invalidateQueries(['progress'])`

**Dependencies:** Tasks 1.12, 4.2

**Test writing point:** Write `apps/web/__tests__/hooks/useOfflineQueue.test.ts` with all 5 cases from testing guidelines §7. Use `jest.spyOn(window, 'addEventListener')` to simulate online/offline events and mock `idb`.

---

#### Task 4.4 — Integrate Offline Queue into useVerseRead
**Files to modify:**
- `/lectio/apps/web/hooks/useVerseRead.ts` — update the mutation flow:
  1. Always enqueue to IndexedDB first (regardless of online state) — this ensures no reads are lost even if the API call fails mid-flight
  2. If `navigator.onLine === true`: proceed with API call immediately
  3. If `navigator.onLine === false`: skip API call (queue will flush on reconnect)
  4. On API success: `markSynced` the corresponding IndexedDB items
  5. On API failure (network error, 5xx): leave IndexedDB items unsynced (they'll flush on reconnect)

**Dependencies:** Task 4.3, 2.6

**Invariant:** The optimistic UI update (tile turns read) must happen immediately regardless of network state. The user must never wait for a network round-trip to see progress feedback.

---

### Phase 4 Tests to Write

| File | Tests |
|---|---|
| `apps/api/src/auth/auth.service.spec.ts` | `createGuest` creates user row, returns token |
| `apps/web/__tests__/hooks/useOfflineQueue.test.ts` | 5 cases from testing guide §7 |

---

### Phase 4 Exit Invariants

1. First visit with empty localStorage: guest token is generated and stored
2. A corresponding `users` row exists in Supabase with that guest token and `email = null`
3. All progress endpoints work correctly when called with `X-Guest-Token` header
4. Tapping a chapter tile while offline: tile turns read immediately (optimistic)
5. `getPendingReads()` contains the unsynced verse read after step 4
6. Restoring network connection: queue flushes, verse_reads appear in Supabase
7. Queuing 600 verse IDs offline: flush sends exactly 2 batches (500 + 100), not 1
8. All batches succeed: every IndexedDB item has `synced: true`

---

## Phase 5 — Auth & Migration (6–8 days)

### Goal
Email OTP sign-in works. Guest progress migrates atomically to the authenticated account. Cross-device sync via Supabase Realtime.

### Task Sequence

#### Task 5.1 — OTP Auth Endpoints (API)
**Files to modify:**
- `/lectio/apps/api/src/auth/auth.service.ts` — add:
  - `sendOtp(email: string): Promise<{ sent: true }>` — validates email format (throws `BadRequestException` with code `INVALID_EMAIL` if invalid), calls `supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })`, returns `{ sent: true }`
  - `verifyOtp(email: string, token: string): Promise<OtpVerifyDto>` — calls `supabase.auth.verifyOtp({ email, token, type: 'email' })`. On success: creates or upserts a row in `users` table with the auth.user.id and email. Returns `{ accessToken, user }`. On failure: throws `UnauthorizedException` with code `INVALID_OTP`.
  
- `/lectio/apps/api/src/auth/auth.controller.ts` — add `POST /auth/otp/send` and `POST /auth/otp/verify` routes (no auth guard)

**Dependencies:** Task 4.1

**Gotcha:** When `verifyOtp` succeeds, the user might already have a `users` row (if they've signed in before on another device) or might not (new authenticated user). Use upsert on the `users` table keyed by `id`. Do not insert if already exists — that would fail the UNIQUE constraint.

---

#### Task 5.2 — Guest Migration Endpoint (API)
**Files to modify:**
- `/lectio/apps/api/src/auth/auth.service.ts` — add:
  - `migrateGuest(authenticatedUserId: string, guestToken: string): Promise<{ migratedReads: number }>`:
    1. Look up guest user row by `guest_token` — throw `BadRequestException` with code `INVALID_GUEST_TOKEN` if not found or already archived
    2. Count existing `verse_reads` for guest user
    3. `UPDATE verse_reads SET user_id = authenticatedUserId WHERE user_id = guestUserId` — this transfers all reads
    4. Handle the case where the authenticated user already has some of the same verse reads: the `UNIQUE(user_id, verse_id)` constraint will conflict. Use `INSERT INTO verse_reads SELECT authenticatedUserId, verse_id, read_at FROM verse_reads WHERE user_id = guestUserId ON CONFLICT (user_id, verse_id) DO NOTHING` instead of a direct UPDATE to handle overlaps
    5. `UPDATE users SET archived_at = now(), guest_token = null WHERE id = guestUserId` — soft delete
    6. Return `{ migratedReads: count }`

- `/lectio/apps/api/src/auth/auth.controller.ts` — add `POST /auth/migrate` (requires auth guard)

**Dependencies:** Tasks 2.3, 5.1

**Gotcha:** The naive `UPDATE verse_reads SET user_id = X WHERE user_id = Y` will fail with a unique constraint violation if the authenticated user has already read some of the same verses as the guest. The safe approach is the insert-from-select pattern with `ON CONFLICT DO NOTHING`, then delete the guest's reads.

---

#### Task 5.3 — Login Screen (/login)
**Files to create:**
- `/lectio/apps/web/app/(auth)/login/page.tsx` — Client Component:
  - Step 1: Email input + "send code" button → calls `sendOtp(email)` → shows success hint
  - Step 2: OTP input (6-digit) + "verify" button → calls `verifyOtp(email, token)` → on success, stores session
  - "Back" link on step 2 returns to step 1
  - Error states: "invalid email", "code expired — request a new one" (not "wrong code" — per R4, no pressure language)
  - After verify: if `localStorage` has a `lectio_guest_token`, immediately call `POST /auth/migrate` with that token
  - After migration: clear `lectio_guest_token` from localStorage, navigate to `/read`

**Dependencies:** Tasks 1.10, 4.2, 5.1, 5.2

---

#### Task 5.4 — Settings Screen (/settings) — Auth Section
**Files to create:**
- `/lectio/apps/web/app/settings/page.tsx` — Server Component (shell)
- `/lectio/apps/web/app/settings/SettingsPageClient.tsx` — `'use client'`:
  - Shows signed-in email if authenticated, or "sign in" link if guest
  - "sign out" button: clears Supabase session, regenerates guest token, navigates to `/read`
  - Phase 7 will add plan selection, theme toggle, and reset progress to this screen

**Dependencies:** Tasks 1.10, 4.2, 5.3

---

#### Task 5.5 — Supabase Realtime Subscription
**Files to create:**
- `/lectio/apps/web/hooks/useRealtimeSync.ts` — `'use client'`:
  - Only activates for authenticated users (not guests)
  - On mount: `supabase.channel('verse-reads').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'verse_reads', filter: `user_id=eq.${userId}` }, payload => { ... }).subscribe()`
  - On INSERT event: adds the new `verse_id` to the local `['verse-reads', userId]` React Query cache Set
  - Calls `queryClient.invalidateQueries(['progress'])` on any INSERT from a different device
  - On unmount: `channel.unsubscribe()`
  - Wire this hook into `AuthProvider` so it starts automatically on sign-in

**Dependencies:** Tasks 1.12, 4.2, 5.1

---

### Phase 5 Tests to Write

| File | Tests |
|---|---|
| `apps/api/src/auth/auth.service.spec.ts` | Add: `sendOtp` valid/invalid email; `verifyOtp` success/expired; `migrateGuest` valid/invalid/already-migrated |
| `apps/web/__tests__/hooks/useRealtimeSync.test.ts` | Subscription fires; cache updates on INSERT |

---

### Phase 5 Exit Invariants

1. `POST /api/auth/otp/send` with valid email returns `{ data: { sent: true } }`
2. `POST /api/auth/otp/verify` with correct OTP returns `{ data: { accessToken, user } }`
3. `POST /api/auth/otp/verify` with expired OTP returns `{ error: { code: 'INVALID_OTP' } }`
4. After OTP verify, a row exists in `users` table with the correct `id` and `email`
5. `POST /api/auth/migrate` with valid guest token: all guest verse_reads now have `user_id = authenticatedUserId`
6. After migration: guest user row has `archived_at` set and `guest_token = null`
7. `localStorage.getItem('lectio_guest_token')` is null after successful migration
8. After sign-in on device A, marking a chapter on device A updates the UI on device B within 5 seconds (Realtime test)
9. Sign-out: session cleared, app returns to guest mode, new guest token generated

---

## Phase 6 — Analytics (5–6 days)

### Goal
A calm, non-judgmental stats screen with completion %, streak, ahead/behind, and a 7-day reading graph. No gamification language.

### Task Sequence

#### Task 6.1 — GET /progress/summary (API)
**Files to modify:**
- `/lectio/apps/api/src/progress/progress.service.ts` — add `getProgressSummary(userId: string, planId?: string): Promise<ProgressSummaryDto>`:

  **totalVersesRead:** `SELECT COUNT(*) FROM verse_reads WHERE user_id = ?`

  **completionPct:** `(totalVersesRead / 31102) * 100`, rounded to 2 decimal places. The constant 31,102 must be a named constant `TOTAL_BIBLE_VERSES = 31102` — never a magic number.

  **streakDays:** 
  - Query: `SELECT DISTINCT DATE(read_at AT TIME ZONE 'UTC') as read_date FROM verse_reads WHERE user_id = ? ORDER BY read_date DESC`
  - Walk the dates from today backwards: count consecutive days. If today is not in the list, streak = 0. If yesterday is not in the list after today, streak stops.
  - Streak resets if any calendar day (UTC) has no reads between the last streak day and today.

  **aheadBehindVerses:**
  - If user has no plan: return `null`
  - Compute `expectedDayNumber = daysBetween(plan_start_date, today) + 1`
  - Query the cumulative plan range up to today: sum of verses from day 1 to day `expectedDayNumber` (join `plan_days`, sum `(end_verse.global_order - start_verse.global_order + 1)`)
  - Query verses actually read that fall within that cumulative range: use `count_verses_read_in_range(userId, planDay1StartVerseId, todayEndVerseId)`
  - `aheadBehindVerses = versesReadInPlanRange - expectedVerseCount` — positive = ahead, negative = behind

- Add `GET /progress/daily-counts?days=7` endpoint returning `Array<{ date: string; count: number }>` for the last 7 UTC days

**Dependencies:** Tasks 2.2, 3.1

---

#### Task 6.2 — Analytics Screen (/analytics)
**Files to create:**
- `/lectio/apps/web/app/analytics/page.tsx` — Server Component shell
- `/lectio/apps/web/app/analytics/AnalyticsPageClient.tsx` — `'use client'`:
  - Heading: "your journey" (Manrope, 32px, weight 300, lowercase)
  - Sub-label: "a quiet reflection on your progress" (Inter, caption, muted)
  - Uses `useQuery` for `GET /progress/summary` (stale time: 30s)
  - Uses `useQuery` for `GET /progress/daily-counts?days=7` (stale time: 30s)
  - Renders: `<StatusCard>`, two `<StatCard>` (completion %, streak), `<ProgressGraph>`
  - Empty state: if no reads yet, show completion at 0%, streak at 0 — never hide the screen

**Dependencies:** Tasks 1.10, 1.12, 6.1

---

#### Task 6.3 — StatusCard Component
**Files to create:**
- `/lectio/apps/web/components/analytics/StatusCard.tsx`:
  - Props: `aheadBehindVerses: number | null`
  - Language rules (enforced in this component — never in the service):
    - `> 0`: "currently X days ahead of your reading intention"
    - `< 0`: "currently X days behind your reading intention" — explicitly NOT "you're behind" or "you missed"
    - `=== 0`: "you're right on track with your reading intention"
    - `null`: shows only completion %, no ahead/behind sentence
  - To convert `aheadBehindVerses` to days: divide by average verses/day for the plan (1yr = ~85)
  - `aria-label`: same text as displayed
  - Background: `rgba(227,226,223,0.35)` — but this must be a token, add `--color-stat-card-bg` to `tokens.ts`

**Critical rule check:** The word "behind" may appear only in the phrase "behind your reading intention" — never as an accusatory phrase. The phrase "you missed" must never appear anywhere in this component or any analytics component.

---

#### Task 6.4 — StatCard Component
**Files to create:**
- `/lectio/apps/web/components/analytics/StatCard.tsx`:
  - Props: `label: string`, `value: string`
  - Label: 10px, `letter-spacing: 0.18em`, muted colour, uppercase (this is one of the rare exceptions to the lowercase rule — the label category name reads better in small-caps/uppercase)
  - Value: Manrope, 40px, weight 300 — never bold, never a bright colour
  - No border (no-line rule applies)
  - Background: `var(--color-stat-card-bg)` (the rgba token defined above)

---

#### Task 6.5 — ProgressGraph Component
**Files to create:**
- `/lectio/apps/web/components/analytics/ProgressGraph.tsx`:
  - Props: `data: Array<{ date: string; count: number }>`
  - Pure SVG — no chart library. This keeps the bundle lean and gives full control over styling.
  - 100% width, 100px height viewBox
  - Line connecting the 7 data points. Dots at each point.
  - Line colour: `var(--color-primary)` at 50% opacity
  - Dot colour: `var(--color-primary)`
  - X-axis labels: day abbreviations (mon, tue, wed...) below the chart
  - Y-axis: implicit (no gridlines — the design system prohibits structural borders)
  - If count is 0 for a day, dot sits at the baseline — not omitted
  - Handles variable max count (scale dynamically)

---

### Phase 6 Tests to Write

| File | Tests |
|---|---|
| `apps/api/src/progress/progress.service.spec.ts` | Add: 8 cases for `getProgressSummary` including all streak edge cases from testing guide §5 |
| `apps/web/__tests__/components/StatusCard.test.tsx` | Tests for ahead/behind/on-track language; verify forbidden words never appear |

For `StatusCard`, add a test that explicitly checks the rendered text does NOT contain "you're behind", "you missed", "you're late", or any urgency language.

---

### Phase 6 Exit Invariants

1. `GET /api/progress/summary` for a user with known reads returns mathematically correct values (verify manually)
2. Completion % for 31,102 reads = 100.00; for 15,551 reads = 50.00
3. Streak = 0 if no reads today or yesterday; streak = N for N consecutive UTC days with reads
4. `aheadBehindVerses` = 0 if user has read exactly the plan amount for today
5. Analytics screen renders with 0 reads (empty state) — no crash, no undefined errors
6. The word "missed", "behind" (standalone), "late", "urgent", or "you need to" does not appear anywhere on the analytics screen — search the rendered HTML
7. ProgressGraph renders 7 data points as SVG elements

---

## Phase 7 — Polish & Hardening (6–8 days)

### Goal
The app is accessible, tested end-to-end, Lighthouse ≥ 90, and the settings screen is complete. Storybook documents all components.

### Task Sequence

#### Task 7.1 — Storybook Setup and All Stories
**Files to create:**
- `/lectio/apps/web/.storybook/main.ts` — configure Storybook 8 with Next.js framework
- `/lectio/apps/web/.storybook/preview.ts` — inject CSS token string into Storybook's root (same mechanism as root layout)

**Stories to create** (one `.stories.tsx` file per component):
- `Text.stories.tsx` — stories: Display, Heading, Subheading, Body, Verse, Label, Caption, AllVariants, ColorVariations (9 stories)
- `Button.stories.tsx` — Primary, Ghost, TextVariant, Sizes, Disabled (5 stories)
- `ProgressBar.stories.tsx` — Empty, Half, Full, WithLabel, Small (5 stories)
- `ChapterTile.stories.tsx` — Read, Partial, Unread, Locked, InteractionTest (5 stories)
- `VerseSelectorModal.stories.tsx` — Open, WithReadVerses, AllRead (3 stories)
- `TodayCard.stories.tsx` — Initial, Success, PartialProgress (3 stories)
- `StatCard.stories.tsx` — Default, LargeNumber (2 stories)
- `ProgressGraph.stories.tsx` — TypicalData, ZeroData, SpikeData (3 stories)
- `StatusCard.stories.tsx` — Ahead, Behind, OnTrack, NoPlan (4 stories)
- `ContinuePill.stories.tsx` — WithPosition, NoPosition (2 stories)
- `PlanDayRow.stories.tsx` — Today, Past, Future (3 stories)

**Dependencies:** All Phase 1–6 components

---

#### Task 7.2 — Accessibility Audit and Fixes
**Files to modify:** Any component missing `aria-label`, `role`, or keyboard navigation.

Checklist to enforce across all interactive elements:
- `ChapterTile`: must be `<button>` element (not `<div>`), has `aria-label`, responds to `Enter` and `Space` for tap, `Alt+Enter` for long-press
- `VerseSelectorModal`: focus trap when open (Tab cycles only within modal), `Escape` closes, role `dialog` with `aria-labelledby` pointing to the chapter name
- `BottomNav`: `<nav>` element, each item has `aria-current="page"` when active
- `ContinuePill`: `<button>` element, descriptive `aria-label`
- All form inputs in login screen: `<label>` elements properly associated via `htmlFor`
- Focus-visible ring: verify it appears on all interactive elements when navigating by keyboard

---

#### Task 7.3 — E2E Test Suite (Playwright)
**Files to create:**
- `/lectio/apps/web/e2e/` directory
- `/lectio/apps/web/playwright.config.ts` — baseURL `http://localhost:3000`, 2 workers, retries: 2 on CI
- `/lectio/apps/web/e2e/journey1-guest-reading.spec.ts` — Journey 1 (guest mark-chapter flow)
- `/lectio/apps/web/e2e/journey2-verse-selector.spec.ts` — Journey 2 (long-press verse selection)
- `/lectio/apps/web/e2e/journey3-mark-day-complete.spec.ts` — Journey 3 (mark day complete)
- `/lectio/apps/web/e2e/journey4-offline-queue.spec.ts` — Journey 4 (offline queue flush — uses Playwright `page.context().setOffline(true/false)`)
- `/lectio/apps/web/e2e/journey5-otp-migration.spec.ts` — Journey 5 (OTP sign-in + migration — uses Supabase test project with mock OTP)
- `/lectio/apps/web/e2e/journey6-read-ahead-backfill.spec.ts` — Journey 6 (read ahead and backfill)

Each spec file must include a `beforeEach` that resets the test user's `verse_reads` in the test Supabase project using the service role key.

**Dependencies:** All phases

---

#### Task 7.4 — Settings Screen: Full Implementation
**Files to modify:**
- `/lectio/apps/web/app/settings/SettingsPageClient.tsx` — add:
  - Plan selection: three options (1yr, 2yr, chronological) displayed as cards with the design from `plan_selection/screen.png`. Active plan has `2px solid` accent border (the only permitted use of a solid border). Changing plan calls `PATCH /users/me` (new endpoint needed).
  - Plan start date picker: `<input type="date">` styled with tokens
  - Theme toggle: three buttons (light / dark / sepia). Selecting a theme writes to `localStorage` and applies `data-theme` attribute to `<html>` element. Components auto-update via CSS custom property re-definitions.
  - Reset progress: `<Button variant="text">` with destructive styling. Opens a confirmation modal. On confirm: calls `POST /progress/reset` (new endpoint needed). After reset: all verse_reads are moved to `archived_verse_reads`, UI resets to 0%.
  - Export data: calls `GET /progress/export` (new endpoint) returning JSON blob. Browser downloads the file.
  - Sign in / Sign out.

**New API endpoints needed in Phase 7:**
- `PATCH /users/me` — update `plan_id` and `plan_start_date`
- `POST /progress/reset` — moves all verse_reads to archived_verse_reads
- `GET /progress/export` — returns all verse_reads as JSON

---

#### Task 7.5 — Theme System
**Files to modify:**
- `/lectio/packages/types/src/tokens.ts` — add dark and sepia theme token objects with all the same token names but different hex values (from design system doc §12)
- `/lectio/apps/web/app/globals.css` — add:
  ```css
  :root[data-theme="dark"] { /* dark token overrides */ }
  :root[data-theme="sepia"] { /* sepia token overrides */ }
  ```
  The token values themselves should come from `buildCssTokenString()` variants — or inject them via a `<style>` tag per theme.

- `/lectio/apps/web/hooks/useTheme.ts` — reads `localStorage.getItem('lectio_theme')`, applies `document.documentElement.setAttribute('data-theme', theme)` on mount and on change

---

#### Task 7.6 — Error States
**Files to create:**
- `/lectio/apps/web/components/ui/NetworkBanner.tsx` — shows when `navigator.onLine === false`. Fixed at the top. "you're offline — your reads are saved locally". No urgency language.
- `/lectio/apps/web/components/ui/EmptyState.tsx` — generic empty state component for plan view (before user has started a plan) and analytics (no reads yet)
- `/lectio/apps/web/components/ui/RetryButton.tsx` — wraps `<Button variant="text">` with "try again" label. Shown below any error state.

**Error state placements:**
- Home screen: if `GET /plan/today` fails → show "unable to load today's passage" + retry
- Plan view: if plan list fails → show empty state + retry
- Analytics: if summary fails → show "couldn't load your progress" + retry
- All errors: network banner at top when offline

---

#### Task 7.7 — Lighthouse Performance Audit
**What to check and fix:**
- Images: none in the app currently (good), but check for any SVG icons being loaded via `<img>` instead of inline SVG
- Fonts: ensure Manrope and Inter are loaded with `display: swap` to avoid FOUT blocking render
- React Query initial data: verify server-side prefetch for home screen so the first paint is not a loading skeleton
- Bundle size: run `next build --profile` and check the bundle report. If `@supabase/supabase-js` is large, ensure it's only imported in client components
- Cumulative Layout Shift: the ContinuePill animating in should use CSS `transform` (no layout shift), not `height` or `top` transitions

---

### Phase 7 Tests to Write

| File | Tests |
|---|---|
| `apps/web/e2e/journey1-guest-reading.spec.ts` | Full E2E journey 1 |
| `apps/web/e2e/journey2-verse-selector.spec.ts` | Full E2E journey 2 |
| `apps/web/e2e/journey3-mark-day-complete.spec.ts` | Full E2E journey 3 |
| `apps/web/e2e/journey4-offline-queue.spec.ts` | Full E2E journey 4 |
| `apps/web/e2e/journey5-otp-migration.spec.ts` | Full E2E journey 5 |
| `apps/web/e2e/journey6-read-ahead-backfill.spec.ts` | Full E2E journey 6 |

---

### Phase 7 Exit Invariants

1. `pnpm storybook` builds without errors; all stories render correctly
2. Lighthouse mobile audit: Performance ≥ 90, Accessibility ≥ 90
3. All 6 Playwright E2E journeys pass on CI
4. Keyboard-only navigation: user can mark a chapter read, open the verse selector, and sign out without touching the mouse
5. Escape key closes the verse selector modal
6. Tab key cycles through all interactive elements in a logical order (no focus traps outside the modal)
7. Reset progress: after confirmation, `SELECT COUNT(*) FROM verse_reads WHERE user_id = ?` = 0
8. Reset progress: the same count appears in `archived_verse_reads`
9. Export: downloaded JSON contains all verse_reads with `verseId` and `readAt` fields
10. Theme toggle: switching to dark mode applies correct dark token values — verify in DevTools computed styles
11. All component Storybook stories render without console errors

---

## Cross-Phase Invariants (Validate at Every Phase)

These checks must never regress across phases:

| Invariant | How to Verify |
|---|---|
| No `any` types in TypeScript | `tsc --noEmit` in both apps — zero errors |
| No hardcoded hex values in `.tsx` or `.css` component files | Grep for `#[0-9a-fA-F]{3,6}` in `components/` — must be empty |
| No Tailwind classes | Grep for `className=".*\b(bg-|text-|p-|m-|flex|grid)\b` in component files |
| No gamification language | Grep for "streak" (in UI text only — not logic), "badge", "fire", "celebrate", "congrats" |
| No pressure language | Grep for "missed", "behind" as standalone (not "behind your reading intention"), "late", "overdue" |
| `verse_reads` inserts always use upsert | Grep for `.insert(` in `progress.service.ts` — must be empty |
| Controllers have no business logic | Grep for `supabase` or `db` in `.controller.ts` files — must be empty |
| `global_order` not in API responses | Grep for `globalOrder` or `global_order` in test response fixtures |

---

## Global Dependency Graph (Phase Ordering)

```
1.1 Monorepo
  └── 1.2 tsconfig
        └── 1.3 types + tokens
              ├── 1.4 NestJS scaffold
              │     ├── 1.5 Migration
              │     │     └── 1.6 Seed
              │     │           └── 1.7 BibleModule
              │     └── 2.1 PlanModule
              │           └── 2.2 ProgressModule
              │                 ├── 2.3 AuthGuard
              │                 ├── 3.1 /progress/continue
              │                 ├── 6.1 /progress/summary
              │                 ├── 4.1 /auth/guest
              │                 └── 5.1 OTP endpoints
              │                       └── 5.2 Migration endpoint
              └── 1.10 Next.js scaffold
                    ├── 1.11 UI Primitives (Text, Button, ProgressBar)
                    │     ├── 2.5 TodayCard
                    │     ├── 2.7 ChapterTile
                    │     │     └── 2.8 ChapterGrid
                    │     ├── 2.9 VerseSelectorModal
                    │     ├── 2.10 OpenInJWButton
                    │     ├── 2.11 ContinuePill
                    │     ├── 3.3 PlanDayRow
                    │     ├── 6.3 StatusCard
                    │     ├── 6.4 StatCard
                    │     └── 6.5 ProgressGraph
                    ├── 1.8 verseRange utility (pure — no deps)
                    ├── 1.9 jwLink utility (pure — no deps)
                    ├── 1.12 API client
                    │     └── 2.6 useVerseRead hook
                    │           └── 4.4 Offline queue integration
                    ├── 4.2 Guest token init
                    │     └── 4.3 IndexedDB queue
                    └── 5.5 Realtime subscription
```

---

## Top Architectural Risks and Mitigations

**Risk 1: global_order gaps in the seed invalidate continue reading forever**
A single gap in `global_order` means `firstUnreadInRange` may never find a verse in that gap. Mitigation: the seed script must assert `MAX(global_order) = COUNT(*)` AND verify no gaps with `SELECT COUNT(*) FROM (SELECT global_order - LAG(global_order) OVER (ORDER BY global_order) AS diff FROM verses) sub WHERE diff != 1`. Run this assertion in the seed and in `db:verify`.

**Risk 2: plan_day boundaries splitting chapters mid-chapter**
If day 1 ends at Genesis 1:15 instead of Genesis 1:31, the user's reading experience is confusing and the progress bar will show partial progress even after reading full chapters. Mitigation: The seed script must build plan_day ranges that always start on the first verse of a chapter and end on the last verse of a chapter. This is enforced by building the plan from chapter boundaries, not verse counts.

**Risk 3: Optimistic updates diverging from server state**
The local `Set<number>` of read verse IDs is used for all UI decisions. If this cache gets corrupted (e.g., a failed rollback, or Realtime event received while mutation is in-flight), the UI shows wrong read states. Mitigation: `onSettled` always calls `invalidateQueries(['verse-reads', userId])` which re-fetches the ground truth from the server. The stale time is 30 seconds, so stale reads are short-lived.

**Risk 4: Guest token lost = progress lost**
A user who clears localStorage loses all their guest progress permanently. This is documented expected behaviour (edge case E7). Mitigation: On the settings screen, prominently show a "sign in to save your progress across devices" prompt — but never as pressure. Show it as a feature, not a warning.

**Risk 5: Streak calculated in local timezone instead of UTC**
If the server uses `DATE(read_at)` without explicit UTC timezone, users in UTC-offset timezones will see wrong streak counts. Mitigation: Always use `DATE(read_at AT TIME ZONE 'UTC')` in the streak query. Never use `DATE(read_at)` alone in Postgres.

**Risk 6: VerseSelectorModal dual-thumb slider accessibility**
The custom dual-thumb slider for verse selection has no native ARIA equivalent. Mitigation: Mark each thumb with `role="slider"`, `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, `aria-label="start verse"` / `"end verse"`. This must be done in Phase 2, not deferred to Phase 7.

**Risk 7: Long-press vs. browser context menu on Android**
Android Chrome shows a context menu on long-press by default. `touch-action: manipulation` prevents double-tap zoom but does not suppress the context menu. Mitigation: Also handle `onContextMenu={(e) => e.preventDefault()}` on the `ChapterTile` component. This is edge case E11 from the PRD.

---

### Critical Files for Implementation

- `/lectio/packages/types/src/tokens.ts` — the design token constants and `buildCssTokenString()` that the entire frontend CSS system depends on; getting this wrong propagates across every component
- `/lectio/apps/api/supabase/migrations/001_initial_schema.sql` — the database schema including the `verse_reads` UNIQUE constraint and all RLS policies; any error here requires a new migration and data re-seed
- `/lectio/apps/web/lib/verseRange.ts` — the pure utility that all progress calculations (plan completion %, continue reading, ahead/behind) derive from; requires 100% branch coverage before any dependent code is written
- `/lectio/apps/api/src/progress/progress.service.ts` — the source of truth for all write and read operations on `verse_reads`; must enforce upsert semantics and never store derived state
- `/lectio/apps/web/hooks/useVerseRead.ts` — the client-side write path that bridges the optimistic UI, IndexedDB offline queue, and API; the most complex hook in the codebase and the most likely source of data consistency bugs