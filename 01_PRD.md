# lectio — product requirements document

**Version:** 1.0  
**Status:** Draft  
**Author:** Product & Delivery  
**Last Updated:** 2026-03-28

---

## table of contents

1. [executive summary](#1-executive-summary)
2. [background & problem statement](#2-background--problem-statement)
3. [objectives](#3-objectives)
4. [success metrics](#4-success-metrics)
5. [target users](#5-target-users)
6. [product rules — non-negotiable](#6-product-rules--non-negotiable)
7. [scope](#7-scope)
8. [user flows](#8-user-flows)
9. [functional requirements by phase](#9-functional-requirements-by-phase)
10. [business rules](#10-business-rules)
11. [data model summary](#11-data-model-summary)
12. [api surface summary](#12-api-surface-summary)
13. [non-functional requirements](#13-non-functional-requirements)
14. [edge cases & risk register](#14-edge-cases--risk-register)
15. [assumptions](#15-assumptions)
16. [dependencies](#16-dependencies)
17. [out of scope](#17-out-of-scope)
18. [glossary](#18-glossary)
19. [version history](#19-version-history)

---

## 1. executive summary

Lectio is a minimal Bible reading companion designed for flexible, verse-level reading. It does not enforce schedules, celebrate streaks, or pressure users. It tracks what has been read at the verse level and surfaces the next logical passage — nothing more.

The product is built for individuals who want the structure of a reading plan without the guilt of not following it perfectly. Reading happens externally via jw.org. Lectio manages tracking, progress, and continuity.

---

## 2. background & problem statement

Existing Bible reading apps fall into two failure modes:

**Too rigid:** Day-based completion tracking, gamified streaks, push-notification pressure. Users who miss a day feel behind and disengage entirely.

**Too unstructured:** No plan, no continuity, no sense of progress. Users open the app and don't know what to read.

Lectio occupies the gap: a calm, honest tracker that never judges. A user can read three chapters today, skip tomorrow, and backfill last week — the system accepts all of this without comment.

---

## 3. objectives

| # | objective |
|---|---|
| O1 | Enable verse-level reading progress tracking without enforced order |
| O2 | Surface the user's current reading position (continue reading) at any time |
| O3 | Allow users to mark progress via tap (chapter) or long-press (verse range) |
| O4 | Open reading content in jw.org at the exact chapter, not within Lectio |
| O5 | Sync progress across devices in real time when online |
| O6 | Support offline reading activity with later sync |
| O7 | Provide calm, non-judgmental analytics (completion %, streak, ahead/behind) |
| O8 | Support guest mode with seamless migration to authenticated account |

---

## 4. success metrics

| metric | definition | target (6 months) |
|---|---|---|
| weekly retention | users who open the app in 2+ consecutive weeks | ≥ 55% |
| session depth | avg verses marked per session | ≥ 10 |
| plan adherence | users who remain within 7 days of plan by day 30 | ≥ 40% |
| offline sync success | offline queued reads that successfully sync | ≥ 99% |
| cross-device adoption | authenticated users with 2+ devices | ≥ 25% |

---

## 5. target users

**primary:** Individual Bible readers who want a personal reading plan without enforcement. Comfortable with mobile/web apps. May miss days frequently. Prefer calm, private tools.

**secondary:** Readers already using jw.org for the text, who want a separate companion for tracking and continuity.

**not targeted (v1):** Groups, churches, study leaders, shared plans.

---

## 6. product rules — non-negotiable

These rules take precedence over any other requirement, design, or implementation decision.

| rule | description |
|---|---|
| R1 | **no "mark day complete" as the sole progress mechanism** — a mark-day-complete button MAY exist as a convenience shortcut, but it must internally record verse-level reads for the day's range. It must never be the only way to mark progress. |
| R2 | **no forced reading order** — a user must always be able to read ahead or backfill without restriction |
| R3 | **no gamification** — no badges, no animations celebrating streaks, no "you're on fire" language |
| R4 | **no pressure messaging** — no "you're X days behind", no push notifications, no urgency language |
| R5 | **progress is passive** — the UI surfaces data; it never instructs the user to act on it |
| R6 | **verse-level tracking is the source of truth** — all derived metrics (completion %, ahead/behind, continue position) are computed from `verse_reads`, never from a day-completion flag |
| R7 | **reading happens in jw.org** — Lectio never renders Bible text inline. The open button deep-links to the specific chapter on jw.org |

---

## 7. scope

### in scope — mvp (phases 1–3)

- Monorepo scaffold (Turborepo, Next.js, NestJS, Supabase)
- Design token system (Manrope / Inter, earthy palette)
- Database schema: books, chapters, verses, plans, plan_days, users, verse_reads
- Bible data seed (KJV, 66 books, all verses with global_order)
- GET /bible/* endpoints
- Home screen: today's passage, chapter grid, open-in-jw.org, mark-day-complete, continue pill
- Chapter grid: tap to mark chapter read, long-press to open verse selector modal
- Verse selector modal: range slider, mark full / save range
- Progress tracking: POST /progress/verses (batch), verse_reads as source of truth
- Continue reading: GET /progress/continue → next unread verse
- Plan day view: today's passage computed from plan_start_date + day offset
- Analytics screen: completion %, streak, ahead/behind, progress graph
- Guest mode: localStorage progress, guest_token, offline queue
- Email OTP auth (Supabase): send OTP, verify OTP, create session
- Guest migration: attach guest progress to authenticated account
- Settings screen: plan selection, theme toggle, reset progress, export data, sign out
- Offline queue: IndexedDB, flush on reconnect
- Real-time sync: Supabase Realtime on verse_reads

### in scope — post-mvp (phases 4+)

- Custom reading plans
- Push notifications (opt-in only)
- Journal / reflection notes
- Meditation prompts
- Social / group plans
- Mobile app (React Native / Expo)

---

## 8. user flows

### 8.1 first launch (guest)

```
open app
  → no session detected
  → guest token generated, stored in localStorage
  → home screen: today's passage (day 1 of default plan)
  → user sees passage reference + "open in jw.org" button
  → user returns, taps chapter tile → chapter marked read
  → progress stored locally in offline queue + synced to supabase with guest user row
```

### 8.2 reading a passage

```
home screen
  → "open in jw.org → genesis 12" button tapped
  → external browser opens: jw.org/finder?bible=genesis+12
  → user reads externally
  → user returns to lectio
  → taps chapter tile (short press) → full chapter marked read
    OR
  → long-presses chapter tile → verse selector modal opens
    → adjusts range slider
    → taps "save selected range" → verses marked read
  → progress bar updates
  → continue pill updates to next unread verse
```

### 8.3 mark day complete (shortcut)

```
home screen → "mark day 42 complete" button tapped
  → system records all verses in today's plan_day range as read
    (internally: inserts verse_reads for startVerseId → endVerseId)
  → card transitions to success state (check icon + 100% bar)
  → this is equivalent to marking every chapter in the day's range via tap
```

### 8.4 read ahead

```
user navigates to any future day's passage (scroll forward in plan view)
  → taps chapter tile on a future day
  → chapter marked read immediately — no restriction, no confirmation
  → analytics: "ahead" count updates
  → home screen still shows today's unfinished passage
```

### 8.5 backfill

```
user scrolls back in plan view to a past day
  → taps chapter tile on a past day
  → verses marked read — no restriction
  → analytics recompute (streak may extend, behind count decreases)
```

### 8.6 sign up / migrate guest data

```
settings → "sign in"
  → email input
  → OTP sent via Supabase Auth
  → user enters OTP
  → session created
  → POST /auth/migrate { guest_token }
    → all verse_reads from guest user row transferred to authenticated user
  → guest_token invalidated
  → user now has cross-device sync via Supabase Realtime
```

### 8.7 offline reading

```
user goes offline
  → taps chapter tile
  → verse_reads written to IndexedDB offline queue (synced: false)
  → UI updates optimistically
  → user comes online
  → queue flushed: POST /progress/verses in batches of ≤ 500
  → verse_reads inserted/upserted in Supabase
  → IndexedDB items marked synced: true
```

---

## 9. functional requirements by phase

### phase 1 — foundation

| id | requirement |
|---|---|
| P1-F1 | Turborepo monorepo with apps/web, apps/api, packages/types, packages/tsconfig |
| P1-F2 | Design token file (tokens.ts) — all colors, fonts, spacing, radius, shadow, animation |
| P1-F3 | Supabase migration: all tables, indexes, RLS policies, helper functions |
| P1-F4 | Bible seed data: 66 books, all chapters, all verses with sequential global_order |
| P1-F5 | GET /bible/books — returns all books in canonical order |
| P1-F6 | GET /bible/books/:usfmCode/chapters — returns chapters for a book |
| P1-F7 | GET /bible/chapters/:chapterId/verses — returns verses with text |
| P1-F8 | Next.js root layout: Manrope + Inter fonts, CSS token injection, globals.css reset |
| P1-F9 | Text and Button primitive components (token-enforced, Storybook stories) |
| P1-F10 | verseRange utility: mergeRanges, subtractRanges, firstUnreadInRange, countVersesInRanges, isVerseInRanges, rangeCompletionRatio |

### phase 2 — reading & progress

| id | requirement |
|---|---|
| P2-F1 | Home screen: today's passage card, chapter grid, open-in-jw.org button, continue pill |
| P2-F2 | Chapter grid tile: short tap → mark full chapter read (all verses in chapter) |
| P2-F3 | Chapter grid tile: long-press (≥ 600ms) → open verse selector modal |
| P2-F4 | Verse selector modal: chapter label, range slider, verse dot grid, mark full / save range buttons |
| P2-F5 | Mark day complete button: records all verses in today's plan_day range |
| P2-F6 | Success state on today card after mark-day-complete |
| P2-F7 | POST /progress/verses: batch upsert verse_reads, idempotent |
| P2-F8 | GET /plan/today: returns today's PlanDayView (book, chapter, verse range, day number) |
| P2-F9 | Continue reading pill: always visible on home screen, navigates to next unread verse |
| P2-F10 | Progress bar on today card: % of today's verses marked read |
| P2-F11 | Chapter tile visual states: read (filled primary), partial (half-fill), unread (ghost border) |

### phase 3 — plan view & continue reading

| id | requirement |
|---|---|
| P3-F1 | Plan view screen: scrollable list of all plan days, each showing book/chapter, read status |
| P3-F2 | Scroll freely across past and future days — no restriction |
| P3-F3 | GET /progress/continue: returns next unread verse across entire Bible |
| P3-F4 | GET /plan/:planId/day/:dayNumber: returns PlanDayView for any day |
| P3-F5 | Each plan day row shows per-day completion % (derived from verse_reads) |
| P3-F6 | Tapping a past or future plan day opens that day's chapter grid |

### phase 4 — guest mode & offline

| id | requirement |
|---|---|
| P4-F1 | Guest mode: generate guest_token on first visit, store in localStorage |
| P4-F2 | Guest user row created in users table with guest_token, no email |
| P4-F3 | All progress operations work identically for guest users |
| P4-F4 | Offline queue: write verse reads to IndexedDB when offline |
| P4-F5 | Online detection: flush queue on reconnect in batches of ≤ 500 verse IDs |
| P4-F6 | Optimistic UI: chapter tile updates immediately, regardless of network state |
| P4-F7 | Conflict resolution: upsert semantics — first read_at wins on conflict |

### phase 5 — auth & migration

| id | requirement |
|---|---|
| P5-F1 | POST /auth/otp/send: accepts email, sends OTP via Supabase Auth |
| P5-F2 | POST /auth/otp/verify: accepts email + token, returns session |
| P5-F3 | POST /auth/guest: creates guest user, returns guest_token |
| P5-F4 | POST /auth/migrate: transfers all verse_reads from guest user to authenticated user |
| P5-F5 | Guest token invalidated after successful migration |
| P5-F6 | Login screen: email input, OTP input, submit, back |
| P5-F7 | Settings screen: displays signed-in email, sign out button |
| P5-F8 | Supabase Realtime: subscribe to verse_reads for current user on sign-in |

### phase 6 — analytics

| id | requirement |
|---|---|
| P6-F1 | Analytics screen: "your journey" heading, status card, completion %, streak, graph |
| P6-F2 | GET /progress/summary: returns totalVersesRead, completionPct, streakDays, aheadBehindVerses |
| P6-F3 | Streak = calendar days with ≥ 1 verse read (UTC). Resets at midnight UTC if no reads that day |
| P6-F4 | Completion % = totalVersesRead / totalBibleVerses × 100, 2 decimal places |
| P6-F5 | Ahead/behind = (verse_reads in plan_days 1–N) − (total verses in plan_days 1–N), where N = today's plan day number. Positive = ahead; negative = behind; 0 = on plan. |
| P6-F6 | Progress graph: daily verse count for last 7 days, SVG line chart |
| P6-F7 | Status card: "currently X days ahead/behind of your reading intention" — neutral language |
| P6-F8 | Threshold configurable in settings: minimum 1 verse to count as a read day |

### phase 7 — polish & hardening

| id | requirement |
|---|---|
| P7-F1 | Storybook: stories for all components (Text, Button, ChapterTile, VerseSelector, ProgressBar, StatCard) |
| P7-F2 | Accessibility: all interactive elements have aria-labels, focus-visible rings, keyboard navigation |
| P7-F3 | jw.org deep-link: construct URL as `https://www.jw.org/finder?wtlocale=E&bible={BB}{CCC}&pub=nwt` where `{BB}` = 2-digit zero-padded book sort_order and `{CCC}` = 3-digit zero-padded chapter number. For verse-level links append `{VVV}` (3-digit verse). Verified example: Genesis 1 = `01001`, Genesis 1:3 = `01001003`. Wrap in a single config constant — never inline the URL pattern. |
| P7-F4 | Settings: plan selection (1yr, 2yr, chronological), plan_start_date picker |
| P7-F5 | Settings: theme toggle (light / dark / sepia) |
| P7-F6 | Settings: reset progress (archives verse_reads, soft delete), export data (JSON/CSV) |
| P7-F7 | Error states: network failure banner, empty state on plan view, retry on API failure |

---

## 10. business rules

| id | rule |
|---|---|
| BR1 | A chapter is considered "read" when all verses in that chapter have a corresponding verse_read row for the user |
| BR2 | A chapter is "partial" when at least 1 but not all verses have a verse_read row |
| BR3 | "Mark day complete" inserts verse_reads for every verse from plan_day.start_verse_id to plan_day.end_verse_id (inclusive, by global_order) |
| BR4 | "Mark chapter read" inserts verse_reads for every verse in that chapter |
| BR5 | Verse selector "save range" inserts verse_reads for the selected start–end range (inclusive) |
| BR6 | All verse_read inserts are upserts — UNIQUE(user_id, verse_id) constraint, first read_at preserved |
| BR7 | Continue reading = the lowest global_order verse that has no verse_read for the current user |
| BR8 | Streak increments when at least 1 verse_read row is created with read_at on a calendar day (UTC) different from the current streak's last day |
| BR9 | Streak resets if no verse_read exists for a calendar day (UTC) between the last streak day and today |
| BR10 | Guest users are identified by guest_token in localStorage; their user row has no email |
| BR11 | After auth migration, the authenticated user row inherits all verse_reads from the guest user row; the guest row is soft-deleted |
| BR12 | Plan days do not store completion state — completion is always derived from verse_reads at query time |
| BR13 | Reading ahead is permitted without restriction — no plan day boundary checks on progress writes |
| BR14 | The jw.org deep-link must resolve to the specific chapter, not the book or homepage. Format: `bible={BB}{CCC}` (5-digit string). For continue-reading verse-level links: `bible={BB}{CCC}{VVV}` (8-digit string). All three segments must be zero-padded. |

---

## 11. data model summary

See `04_DATABASE_SCHEMA.md` for full DDL. Summary:

| table | purpose |
|---|---|
| books | static — 66 Bible books |
| chapters | static — all chapters per book |
| verses | static — all verses with text and global_order |
| plans | reading plan definitions |
| plan_days | day → verse range mapping |
| users | app-level user (mirrors Supabase auth.users.id) |
| verse_reads | **source of truth** — one row per user per verse read |

---

## 12. api surface summary

See `05_API_CONTRACTS.md` for full contracts.

| method | path | description |
|---|---|---|
| GET | /bible/books | all books |
| GET | /bible/books/:usfmCode/chapters | chapters for book |
| GET | /bible/chapters/:chapterId/verses | verses for chapter |
| GET | /plan/today | today's plan day view |
| GET | /plan/:planId/day/:dayNumber | any plan day view |
| POST | /progress/verses | batch mark verses read |
| GET | /progress/continue | next unread verse position |
| GET | /progress/summary | streak, completion %, ahead/behind |
| POST | /auth/otp/send | send OTP to email |
| POST | /auth/otp/verify | verify OTP, return session |
| POST | /auth/guest | create guest user |
| POST | /auth/migrate | migrate guest → authenticated |

---

## 13. non-functional requirements

| category | requirement |
|---|---|
| Performance | Home screen first contentful paint < 1.5s on 4G |
| Performance | POST /progress/verses p95 < 300ms |
| Performance | GET /bible/chapters/:id/verses cached, response < 100ms |
| Availability | API uptime ≥ 99.5% (Supabase SLA) |
| Offline | All read-marking actions work without network; queue flushes on reconnect |
| Security | RLS enforced on all user tables; no cross-user data access |
| Security | Service role key never exposed to frontend |
| Scalability | verse_reads table indexed on (user_id), (user_id, read_at), (verse_id) |
| Accessibility | WCAG 2.1 AA — contrast ratios, focus management, screen reader labels |
| Data retention | verse_reads retained indefinitely; reset = soft delete (archived_at timestamp) |
| Internationalisation | v1 English only; architecture must not hard-block future i18n |

---

## 14. edge cases & risk register

| id | scenario | resolution |
|---|---|---|
| E1 | User taps "mark chapter" on an already-fully-read chapter | Upsert — no duplicate row, read_at preserved, UI already shows read state |
| E2 | User reads offline for 3+ days | Queue may contain 500+ items; flush in batches of 500, retry each batch up to 3 times, then mark as permanently-failed. Hard cap: queue stores max 10,000 items; if exceeded, new writes are dropped and a persistent "some reads could not be saved" banner is surfaced. Recovery path: user must sync before continuing to mark progress. |
| E3 | Two devices mark the same verse simultaneously | UNIQUE constraint + upsert — last write wins on the network level, first read_at preserved |
| E4 | plan_start_date is NULL (user hasn't started) | Return day 1 passage, not an error |
| E5 | Long-press fires on a fully-read chapter tile | Modal opens normally; verse dots show all read; user can unselect (future) or cancel |
| E6 | User is on last verse of Bible | continue reading returns null; UI shows "you've reached the end" message |
| E7 | Guest token missing from localStorage (cleared) | Re-generate guest token, create new guest user; old progress is unrecoverable — this is expected and acknowledged in the UX. After the user marks ≥ 10 chapters read as a guest, a non-intrusive inline nudge appears: "your progress is only stored on this device — sign in to back it up." The nudge appears once per session, never on every tap. |
| E8 | OTP expired before entry | Surface "code expired" message; offer resend |
| E9 | Migration called with invalid/already-used guest_token | Two sub-cases: (a) authenticated user already has verse_reads (migration succeeded on another device) → return 200 `{ migratedReads: 0, alreadyMigrated: true }`, frontend treats as success and proceeds normally; (b) token is completely unknown or expired → return 400 INVALID_GUEST_TOKEN, frontend surfaces "unable to migrate — sign in fresh." Never show an error to the user when migration already completed on another device. |
| E10 | Bible verse count mismatch in seed | Seed includes a row count assertion; migration fails fast if count != 31,102 |
| E11 | Mobile browser blocks long-press (triggers text selection) | CSS: user-select: none + touch-action: manipulation on all chapter tiles |
| E12 | Clock skew between devices affects streak calculation | read_at set server-side on insert, not from client timestamp |
| E13 | User in extreme UTC offset (e.g., UTC+12) reads at 11pm local time | Server-side read_at will fall on the next UTC calendar day, breaking their perceived streak. This is a known limitation of UTC-based streak calculation. The docs acknowledge it. No fix in v1 — resolving it requires user timezone storage and per-user day boundaries, which is post-MVP scope. It will not be silently "fixed" with a client timestamp hack. |

---

## 15. assumptions

| id | assumption |
|---|---|
| A1 | Bible translation = KJV (public domain) for MVP |
| A2 | Default reading plan = sequential Genesis → Revelation, 1 year (365 days) |
| A3 | Verse data seeded from static JSON; no third-party Bible API |
| A4 | jw.org deep-link format: `https://www.jw.org/finder?wtlocale=E&bible={BB}{CCC}&pub=nwt` where `{BB}` = 2-digit zero-padded book sort_order (01–66) and `{CCC}` = 3-digit zero-padded chapter number. Verified example: `https://www.jw.org/finder?wtlocale=E&bible=01001&pub=nwt` opens Genesis 1. For verse-level deep-links append `{VVV}` (3-digit verse, e.g., `01001003` = Genesis 1:3). URL pattern must live in a single config constant — never inlined. |
| A5 | Total Bible verses = 31,102 (KJV) |
| A6 | Streak uses UTC calendar days, not local timezone. Known edge case: users in UTC+12 or UTC+13 who read after 11pm local time will have that session attributed to the next UTC day, potentially breaking their streak. This is a documented limitation, not a bug to silently work around. Post-MVP: user timezone storage. |
| A7 | No push notifications in MVP |
| A8 | Storybook is built but not deployed as a public docs site |
| A9 | "Mark day complete" is a valid user convenience; it internally writes verse_reads — it does not bypass verse-level tracking |

---

## 16. dependencies

| dependency | type | risk |
|---|---|---|
| Supabase | Database, Auth, Realtime | Medium — single provider, mitigated by standard Postgres compatibility |
| jw.org deep-link URL format | External | Medium — URL structure may change; wrap in a config constant |
| Google Fonts (Manrope, Inter) | CDN | Low — fallback font stack defined |
| KJV verse data JSON | Static seed | Low — public domain, version-controlled in repo |
| Vercel | Frontend hosting | Low — standard Next.js deployment |

---

## 17. out of scope

- In-app Bible text rendering
- Audio Bible
- Commentary or footnotes
- Group / shared reading plans
- Push notifications
- Social features (sharing progress)
- Mobile native app (phase 4+)
- Bible translation switching
- Custom reading plan builder
- Offline-first architecture (offline queue is MVP; full offline-first is post-MVP)

---

## 18. glossary

| term | definition |
|---|---|
| verse_reads | The table that is the single source of truth for all reading progress |
| global_order | A unique sequential integer on each verse enabling range arithmetic across chapter/book boundaries |
| plan_day | A mapping of a day number to an inclusive verse range (start_verse_id → end_verse_id) |
| continue position | The lowest global_order verse with no verse_read row for the current user |
| ahead/behind | The delta between verses the user has read in the plan range up to today vs. the expected verses for today |
| guest_token | A UUID stored in localStorage identifying an unauthenticated user's data |
| upsert | An insert that silently ignores or updates on conflict — used for all verse_read writes |
| USFM code | Unified Standard Format Markers book identifier, e.g. GEN, MAT, REV |
| mark day complete | A UI shortcut that internally writes verse_reads for all verses in a plan day's range |

---

## 19. version history

| version | date | author | notes |
|---|---|---|---|
| 1.0 | 2026-03-28 | Product & Delivery | Initial draft |
