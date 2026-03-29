# lectio — testing guidelines

**Version:** 1.0  
**Last Updated:** 2026-03-28

---

## 1. testing philosophy

Tests in Lectio exist to:
1. **Protect the verse-level tracking invariant.** `verse_reads` is the source of truth. Any bug that corrupts this (double-insert, missing upsert, wrong verse range) is a P0 incident.
2. **Document expected behaviour.** A test is a specification. Reading the test file should tell you exactly what the function is supposed to do.
3. **Enable confident refactoring.** The verse range utilities and analytics calculations are complex enough to break silently. Full coverage here is non-negotiable.

---

## 2. test stack

| layer | tool | location |
|---|---|---|
| Unit (utilities) | Jest + ts-jest | `apps/web/__tests__/` |
| Unit (NestJS services) | Jest + @nestjs/testing | `apps/api/src/**/*.spec.ts` |
| Component | @testing-library/react | `apps/web/__tests__/components/` |
| Hook | @testing-library/react + renderHook | `apps/web/__tests__/hooks/` |
| E2E | Playwright | `apps/api/test/` (API) + `apps/web/e2e/` (UI) |

---

## 3. coverage targets

| layer | target |
|---|---|
| `verseRange.ts` | 100% branch coverage — no exceptions |
| `jwLink.ts` | 100% branch coverage |
| NestJS services | ≥ 90% line coverage |
| React hooks | ≥ 80% line coverage |
| React components | Key interaction paths covered (not exhaustive) |
| E2E journeys | All critical user paths (see §8) |

---

## 4. unit tests — verseRange.ts

This is the most critical utility in the codebase. All **6 functions** must have 100% branch coverage: `mergeRanges`, `countVersesInRanges`, `isVerseInRanges`, `firstUnreadInRange`, `rangeCompletionRatio`, `subtractRanges`. The P1-F10 requirement list previously named only 4 — the canonical list is the 6 listed here.

### mergeRanges

| test case | input | expected output |
|---|---|---|
| empty array | `[]` | `[]` |
| single range | `[{1,5}]` | `[{1,5}]` |
| overlapping ranges | `[{1,5},{3,8}]` | `[{1,8}]` |
| adjacent ranges | `[{1,5},{6,10}]` | `[{1,10}]` |
| non-adjacent ranges | `[{1,5},{10,15}]` | `[{1,5},{10,15}]` |
| out-of-order input | `[{10,15},{1,3},{3,12}]` | `[{1,15}]` |
| does not mutate input | verify input array unchanged | — |

### countVersesInRanges

| test case | expected |
|---|---|
| single range {1,5} | 5 |
| overlapping ranges (no double-count) | merged count |
| non-overlapping ranges | sum of individual counts |
| empty | 0 |

### isVerseInRanges

| test case | expected |
|---|---|
| verse inside range | true |
| verse at boundary (start) | true |
| verse at boundary (end) | true |
| verse between ranges (gap) | false |
| verse after last range | false |

### firstUnreadInRange

| test case | expected |
|---|---|
| nothing read | first verse in range |
| first N verses read | verse N+1 |
| all verses read | null |

### rangeCompletionRatio

| test case | expected |
|---|---|
| nothing read | 0 |
| all read | 1 |
| half read | 0.5 |
| zero-length range | 0 (no divide-by-zero) |

### subtractRanges

| test case | expected |
|---|---|
| empty read list | full target range |
| fully covered | empty array |
| middle subtracted | two segments |
| start subtracted | right segment only |
| multiple read ranges covering all | empty array |

---

## 5. unit tests — nestjs services

Each service has its own `.spec.ts` file. The Supabase client is always mocked — never a real database in unit tests.

### mock pattern

```typescript
function buildMockDb(data: unknown, error: unknown = null) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockResolvedValue({ data, error }),
    single: jest.fn().mockResolvedValue({ data, error }),
  };
  chain.order.mockResolvedValue({ data, error });
  return { from: jest.fn().mockReturnValue(chain), _chain: chain };
}
```

### BibleService tests

| test | what to verify |
|---|---|
| getAllBooks — success | Returns mapped BookDto array; DB called with order ascending |
| getAllBooks — DB error | Throws with message containing "Failed to fetch books" |
| getBookByUsfm — found | Returns correct BookDto |
| getBookByUsfm — case-insensitive | `.eq` called with uppercase code |
| getBookByUsfm — not found | Throws NotFoundException |
| getVersesByChapter — success | Returns VerseDto array; global_order not in response |
| getVersesByChapter — empty | Throws NotFoundException |

### ProgressService tests

| test | what to verify |
|---|---|
| markVersesRead — new verses | Upsert called with correct rows; returns { inserted, alreadyRead } |
| markVersesRead — all already read | Upsert still called (idempotent); returns { inserted: 0, alreadyRead: N } |
| markVersesRead — empty array | Throws BadRequestException |
| markVersesRead — exceeds 500 | Throws BadRequestException |
| getContinuePosition — unread exists | Returns correct verse with lowest global_order |
| getContinuePosition — all read | Returns null (not an error) |
| getProgressSummary — with reads | Returns correct completionPct (2dp), streakDays, aheadBehindVerses |
| getProgressSummary — no reads | Returns zeros; aheadBehindVerses: null if no plan |

### AnalyticsService — streak calculation tests

| test | expected streak |
|---|---|
| No reads ever | 0 |
| Read today only | 1 |
| Read yesterday and today | 2 |
| Read 5 consecutive days ending today | 5 |
| Read 5 days but gap 2 days ago | 2 (resets at gap) |
| Read yesterday but not today | 0 (streak broken at midnight UTC) |

### AuthService tests

| test | what to verify |
|---|---|
| createGuest | Creates user row with guest_token; returns token |
| migrateGuest — valid token | Updates all verse_reads; soft-deletes guest user; returns count |
| migrateGuest — invalid token | Throws BadRequestException with INVALID_GUEST_TOKEN code |
| migrateGuest — already migrated | Throws BadRequestException |

---

## 6. component tests

Use `@testing-library/react`. Test behaviour, not implementation.

### ChapterTile

```typescript
describe('ChapterTile', () => {
  it('renders with read state visually', () => { ... });
  it('calls onTap after short press (< 600ms)', () => { ... });
  it('calls onLongPress after 600ms hold', async () => { ... });
  it('does not trigger text selection on long-press', () => { ... });
  it('renders check icon when read', () => { ... });
  it('renders partial fill when partially read', () => { ... });
  it('is disabled (no interaction) when locked', () => { ... });
});
```

### VerseSelectorModal

```typescript
describe('VerseSelectorModal', () => {
  it('renders chapter name in header', () => { ... });
  it('updates verse-end-label as slider moves', () => { ... });
  it('calls onMarkFull when "mark full chapter" is tapped', () => { ... });
  it('calls onSaveRange with correct verseIds when "save selected range" is tapped', () => { ... });
  it('calls onClose when close button is tapped', () => { ... });
  it('calls onClose when overlay is tapped', () => { ... });
});
```

### TodayCard

```typescript
describe('TodayCard', () => {
  it('shows passage reference and day number', () => { ... });
  it('shows progress bar at correct % based on verseReads', () => { ... });
  it('shows mark-day-complete button in initial state', () => { ... });
  it('transitions to success state after mark-day-complete', () => { ... });
  it('success state shows 100% progress bar', () => { ... });
  it('does not show mark-day-complete button in success state', () => { ... });
});
```

---

## 7. hook tests

Use `renderHook` from `@testing-library/react`. Wrap in `QueryClientProvider`.

### useVerseRead

```typescript
describe('useVerseRead', () => {
  it('mutates verse_reads cache optimistically on markChapter', async () => { ... });
  it('rolls back cache on API failure', async () => { ... });
  it('writes to offline queue when navigator.onLine is false', () => { ... });
  it('invalidates progress queries on success', async () => { ... });
});
```

### useOfflineQueue

```typescript
describe('useOfflineQueue', () => {
  it('writes unsynced items to IndexedDB when offline', () => { ... });
  it('flushes all unsynced items on online event', async () => { ... });
  it('chunks batches of > 500 into multiple requests', async () => { ... });
  it('retries failed batches up to 3 times', async () => { ... });
  it('marks items synced: true after successful flush', async () => { ... });
});
```

---

## 8. e2e tests — playwright

E2E tests cover the critical user journeys end-to-end against a real (test) Supabase database.

### test environment

- Separate Supabase project for testing (`SUPABASE_TEST_URL`)
- Seed script run before each test suite: creates a test user, inserts known verse_reads, known plan
- All tests run in isolation: each test creates its own guest_token or test user session

**Phase 4 testing prerequisite:** The offline → online → sync journey (Journey 4) and the "flushed reads appear in verse_reads" Phase 4 exit criterion both require a live Supabase test instance. Unit tests cover the IndexedDB queue logic in isolation (mock network, fake Supabase calls). But the assertion that `verse_reads` rows actually exist in the DB after a flush cannot be validated without a real Supabase project. Before Phase 4 exit criteria can be signed off:

1. `SUPABASE_TEST_URL` and `SUPABASE_TEST_SERVICE_ROLE_KEY` must be set in CI
2. The test seed script must create a guest user with a known `guest_token`
3. Playwright must be able to intercept network requests to simulate offline mode (`page.route('**', route => route.abort())` then `route.continue()`)
4. The test must query Supabase directly after network restoration to assert `verse_reads` count

### journey 1 — guest reading flow

```
Given: First visit (no session)
When: App loads
Then: Guest token created, stored in localStorage

When: Home screen renders
Then: Today's passage shows day 1, Genesis 1

When: User taps chapter tile for Genesis 1
Then: Tile turns read (primary colour)
And: verse_reads rows exist for all Genesis 1 verses in test DB
And: Progress bar shows correct % for day 1

When: User taps "open in jw.org"
Then: External navigation triggered to correct jw.org URL
```

### journey 2 — long-press verse selector

```
Given: Home screen with unread chapter tile
When: User long-presses tile (600ms)
Then: Verse selector modal opens with correct chapter name

When: User adjusts slider to verse 5
And: Taps "save selected range"
Then: Modal closes
And: verse_reads rows exist for verses 1–5 of that chapter
And: Tile shows partial state
```

### journey 3 — mark day complete

```
Given: Home screen, day 1 not complete
When: User taps "mark day 1 complete"
Then: Success state shows (check icon, 100% bar)
And: verse_reads rows exist for all verses in day 1's plan range
And: Continue pill updates to day 2's first verse
```

### journey 4 — offline queue flush

```
Given: Authenticated user
When: User goes offline (network intercepted by Playwright)
And: User taps chapter tile
Then: Tile updates optimistically
And: IndexedDB contains unsynced item

When: Network restored
Then: POST /progress/verses called with queued verse IDs
And: verse_reads rows exist in database
And: IndexedDB item marked synced: true
```

### journey 5 — otp sign-in + migration

```
Given: Guest user with 50 verse_reads
When: User opens settings → sign in
And: Enters email
Then: OTP sent (mock email in test environment)

When: User enters OTP
Then: Session created
And: POST /auth/migrate called with guest_token
And: All 50 verse_reads transferred to authenticated user
And: Guest user soft-deleted
And: localStorage guest_token cleared
```

### journey 6 — read ahead and backfill

```
Given: User on day 42 of plan
When: User navigates to day 45 in plan view
And: Taps chapter tile
Then: Verse reads inserted — no error, no restriction

When: User navigates back to day 40
And: Taps chapter tile
Then: Verse reads inserted for past day — no restriction
And: Analytics "ahead" count updates
```

---

## 9. what not to test

- **Don't test NestJS controller routing** — covered by e2e
- **Don't test Supabase internals** — trust the Supabase client SDK
- **Don't test visual styling** (pixel positions, colour values) — covered by design review + Storybook
- **Don't write tests that only test the mock** — if the mock does all the work, the test has no value

---

## 10. running tests

```bash
# all unit tests
pnpm test

# watch mode
pnpm test --watch

# coverage report
pnpm test --coverage

# e2e (requires running apps + test supabase)
pnpm e2e

# single file
pnpm test apps/web/__tests__/verseRange.test.ts
```

---

## 11. version history

| version | date | notes |
|---|---|---|
| 1.0 | 2026-03-28 | Initial draft |
