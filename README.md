# lectio

A quiet, guilt-free Bible reading companion. Lectio tracks your reading progress at the verse level — reading happens on jw.org, Lectio just remembers where you are.

## What it does

- Shows today's daily reading passage (Genesis to Revelation in 365 days)
- Tap a chapter tile to mark it read; long-press to select a specific verse range
- Opens the passage directly in jw.org with one tap
- Tracks progress without pressure — no streaks, no public leaderboards
- Works offline: reads queue to IndexedDB and sync on reconnect
- Guest mode: no sign-up required to start reading

## Tech stack

| Layer | Technology |
|---|---|
| Monorepo | Turborepo + pnpm workspaces |
| API | NestJS (TypeScript) |
| Web | Next.js 14 App Router (TypeScript) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (OTP email) + guest tokens |
| State | React Query v5 |
| Styling | CSS custom properties only — no Tailwind |

## Project structure

```
lectio/
├── apps/
│   ├── api/               # NestJS REST API (port 4000)
│   │   └── src/
│   │       ├── bible/     # Books, chapters, verses
│   │       ├── plan/      # Reading plan days
│   │       ├── progress/  # verse_reads write path
│   │       └── auth/      # Guest creation, JWT guard
│   └── web/               # Next.js frontend (port 3000)
│       ├── app/
│       │   └── read/      # Main reading screen
│       ├── components/
│       │   ├── reader/    # TodayCard, ChapterGrid, ChapterTile, etc.
│       │   ├── modals/    # VerseSelectorModal
│       │   └── ui/        # Button, ProgressBar, Text primitives
│       ├── hooks/          # useVerseRead, useContinueReading
│       └── lib/            # api.ts, jwLink.ts, verseRange.ts, offlineQueue.ts
├── packages/
│   ├── types/             # Shared domain interfaces + CSS design tokens
│   └── tsconfig/          # Shared TypeScript config (strict + noUncheckedIndexedAccess)
└── apps/api/supabase/
    └── migrations/        # 001_initial_schema.sql
```

## Getting started

### Prerequisites

- Node.js 18+
- pnpm 10+ (`corepack enable && corepack prepare pnpm@10.10.0 --activate`)

### 1. Clone and install

```bash
git clone https://github.com/Leroyjd123/letico.git
cd letico
pnpm install
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

Fill in your Supabase credentials in `.env`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api
PORT=4000
FRONTEND_URL=http://localhost:3000
```

### 3. Run the database migration

In the Supabase dashboard → SQL Editor, run the contents of:

```
apps/api/supabase/migrations/001_initial_schema.sql
```

### 4. Seed the database

```bash
pnpm --filter @lectio/api db:seed
pnpm --filter @lectio/api db:verify   # should show 6/6 passed
```

This seeds 66 books, 1,189 chapters, 31,102 verses, and 365 plan days for the 1-year reading plan.

### 5. Start the dev stack

```bash
# From the monorepo root — starts both API and web:
pnpm dev

# Or individually:
pnpm --filter @lectio/api dev    # http://localhost:4000/api
pnpm --filter @lectio/web dev    # http://localhost:3000
```

## Running tests

```bash
pnpm test                         # all packages
pnpm --filter @lectio/api test    # API unit tests only
pnpm --filter @lectio/web test    # web unit tests only
```

## Key architectural decisions

- **`verse_reads` is the only source of truth.** Completion %, streaks, and ahead/behind are all computed at query time. Nothing derived is ever stored.
- **`global_order` never appears in API responses.** It's an internal detail used for range arithmetic in the database. All API responses use verse IDs.
- **All progress writes go through `POST /api/progress/verses`.** There is no other write path. Every upsert uses `{ onConflict: 'user_id,verse_id', ignoreDuplicates: true }`.
- **CSS tokens only.** No hardcoded hex values anywhere in the UI. Every colour, spacing, and radius references a CSS custom property from the design system.
- **Controllers are routing-only.** Zero business logic lives in NestJS controllers.

## API endpoints

### Bible (public, no auth)

| Method | Path | Description |
|---|---|---|
| GET | `/api/bible/books` | All 66 books in canonical order |
| GET | `/api/bible/books/:usfm` | Single book by USFM code |
| GET | `/api/bible/books/:usfm/chapters` | All chapters for a book |
| GET | `/api/bible/chapters/:id/verses` | All verses for a chapter |

### Auth

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/guest` | Create anonymous guest session |

### Plan (auth required)

| Method | Path | Description |
|---|---|---|
| GET | `/api/plan/today` | Today's reading day for the authenticated user |
| GET | `/api/plan/:planId/day/:dayNumber` | Specific plan day |

### Progress (auth required)

| Method | Path | Description |
|---|---|---|
| POST | `/api/progress/verses` | Mark verses read (the sole write path) |
| GET | `/api/progress/continue` | First unread verse in the user's plan |
| GET | `/api/progress/summary` | Aggregate reading stats |
| GET | `/api/progress/reads` | Read verse IDs in a given verse range |

## Auth

Two modes, both resolved by `AuthGuard`:

- **Bearer JWT** — `Authorization: Bearer <token>` — Supabase session token (Phase 5)
- **Guest token** — `X-Guest-Token: <uuid>` — stored in `localStorage`, no sign-up required

## Build phases

| Phase | Status | Description |
|---|---|---|
| 1 — Foundation | ✅ Complete | Monorepo, DB schema, Bible seed, API scaffold, design system |
| 2 — Reading & Progress | ✅ Complete | Plan API, progress API, auth guard, reading screen UI |
| 3 — Plan View | 🔜 Next | Full 365-day plan list, day navigation |
| 4 — Guest Mode & Offline | 🔜 | IndexedDB queue, offline sync |
| 5 — Auth & Migration | 🔜 | OTP email login, guest → user migration |
| 6 — Analytics | 🔜 | Streak, ahead/behind, completion chart |
| 7 — Polish | 🔜 | Accessibility, performance, PWA |
