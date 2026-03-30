# lectio

A quiet, guilt-free Bible reading companion. Lectio tracks your reading progress at the verse level — reading happens on jw.org, Lectio just remembers where you are.

---

## What it does

- Shows today's daily reading passage (Genesis to Revelation in 365 days)
- Tap a chapter tile to mark it read; long-press to select a specific verse range
- Opens the passage directly in jw.org with one tap
- Tracks progress without pressure — no streaks, no leaderboards
- Works offline: reads queue to IndexedDB and sync on reconnect
- Guest mode: no sign-up required to start reading

---

## Tech stack

| Layer | Technology |
| --- | --- |
| Monorepo | Turborepo + pnpm workspaces |
| API | NestJS (TypeScript), port 4000 |
| Web | Next.js 14 App Router (TypeScript), port 3000 |
| Database | Supabase (PostgreSQL + Auth + Realtime) |
| Auth | Supabase Auth (OTP email) + anonymous guest tokens |
| State | React Query v5 |
| Styling | CSS custom properties only — no Tailwind |

---

## Project structure

```
lectio/
├── apps/
│   ├── api/                        # NestJS REST API  →  http://localhost:4000/api
│   │   └── src/
│   │       ├── bible/              # GET /bible/books|chapters|verses
│   │       ├── plan/               # GET /plan/today, /plan/:id/day/:n
│   │       ├── progress/           # POST /progress/verses, GET /progress/continue|summary
│   │       └── auth/               # POST /auth/guest, GET /auth/me
│   └── web/                        # Next.js frontend  →  http://localhost:3000
│       ├── app/
│       │   ├── read/               # Main reading screen (today's passage)
│       │   └── plan/               # 365-day plan list
│       ├── components/
│       │   ├── reader/             # TodayCard, ChapterGrid, ChapterTile, ContinuePill
│       │   ├── modals/             # VerseSelectorModal
│       │   └── ui/                 # Button, ProgressBar, Text primitives
│       ├── hooks/                  # useVerseRead, useContinueReading, usePlanDay
│       └── lib/                    # api.ts, jwLink.ts, verseRange.ts, offlineQueue.ts
├── packages/
│   ├── types/                      # Shared domain interfaces + CSS design tokens
│   └── tsconfig/                   # Shared TypeScript config
└── apps/api/supabase/
    └── migrations/
        └── 001_initial_schema.sql  # Run this once in Supabase SQL editor
```

---

## Getting started

### Step 0 — Prerequisites

Before cloning, make sure you have:

| Tool | Version | How to check |
| --- | --- | --- |
| Node.js | 18 or higher | `node -v` |
| pnpm | 10 or higher | `pnpm -v` |
| A Supabase account | — | supabase.com (free tier is enough) |

**Install pnpm if you don't have it:**

```bash
corepack enable
corepack prepare pnpm@10.10.0 --activate
```

---

### Step 1 — Clone and install dependencies

```bash
git clone https://github.com/Leroyjd123/letico.git
cd letico
pnpm install
```

Expected output: `Done in Xs` with no errors. If you see peer-dependency warnings, they are safe to ignore.

---

### Step 2 — Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → **New project**
2. Choose a name (e.g. `lectio`), set a database password, pick the region closest to you
3. Wait ~2 minutes for the project to provision

Once it's ready, go to **Project Settings → API** and collect:

| Variable | Where to find it |
| --- | --- |
| `SUPABASE_URL` | "Project URL" field |
| `SUPABASE_SERVICE_ROLE_KEY` | "service_role" key (click "Reveal") |
| `NEXT_PUBLIC_SUPABASE_URL` | Same as `SUPABASE_URL` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | "anon / public" key |

> **Security note:** `SUPABASE_SERVICE_ROLE_KEY` bypasses Row Level Security. It is only used by the NestJS API server — never put it in the frontend or commit it to git.

---

### Step 3 — Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in the values collected in Step 2:

```env
# NestJS API (server-side only)
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Next.js frontend (NEXT_PUBLIC_ prefix makes these available in the browser)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Where the frontend calls the API
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api

# NestJS server port
PORT=4000

# CORS — which frontend origins the API allows
FRONTEND_URL=http://localhost:3000
```

---

### Step 4 — Run the database migration

In the Supabase dashboard, go to **SQL Editor → New query**, paste the entire contents of this file, and click **Run**:

```
apps/api/supabase/migrations/001_initial_schema.sql
```

This creates all tables: `books`, `chapters`, `verses`, `plans`, `plan_days`, `verse_reads`, `users`.

**Also run this SQL** to create the RPC function used by the plan summary endpoint:

```sql
create or replace function count_verses_read_in_range(
  p_user_id uuid,
  p_start_global_order int,
  p_end_global_order int
)
returns int
language sql
stable
as $$
  select count(*)::int
  from verse_reads vr
  join verses v on v.id = vr.verse_id
  where vr.user_id = p_user_id
    and v.global_order >= p_start_global_order
    and v.global_order <= p_end_global_order
$$;
```

---

### Step 5 — Seed the database

```bash
# Seed: 66 books, 1,189 chapters, 31,102 KJV verses, 3 plans, 365 plan days
pnpm --filter @lectio/api db:seed

# Verify: should print "6/6 checks passed"
pnpm --filter @lectio/api db:verify
```

If `db:verify` shows failures, check that your `.env` credentials are correct and the migration ran without errors.

---

### Step 6 — Start the development servers

```bash
# Start both API and web simultaneously (recommended)
pnpm dev
```

Or start them individually in separate terminals:

```bash
pnpm --filter @lectio/api dev    # API  →  http://localhost:4000/api
pnpm --filter @lectio/web dev    # Web  →  http://localhost:3000
```

**Verify everything is running:**

| Check | Expected result |
| --- | --- |
| `http://localhost:4000/api/bible/books` | JSON array of 66 books |
| `http://localhost:3000` | Lectio home page in Manrope font |
| `http://localhost:3000/read` | Today's reading passage |
| `http://localhost:3000/plan` | 365-day plan list, scrolled to today |

---

## Running tests

```bash
pnpm test                          # All packages
pnpm --filter @lectio/api test     # API unit tests only  (22 tests)
pnpm --filter @lectio/web test     # Web unit tests only  (49 tests)
```

---

## Troubleshooting

**`pnpm install` fails with EACCES or permission errors**
Run `corepack enable` first, or install pnpm globally with `npm install -g pnpm`.

**`db:seed` fails with "relation does not exist"**
The migration in Step 4 did not run, or ran with errors. Re-run it in the Supabase SQL editor and check for error messages.

**`db:verify` shows failures but seed appeared to succeed**
Your `.env` credentials may be wrong. Double-check `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` — a common mistake is using the anon key where the service role key is required.

**API starts but `/api/plan/today` returns 401**
The endpoint requires auth. Use `POST /api/auth/guest` first to get a guest token, then pass it as `X-Guest-Token: <token>` on subsequent requests.

**`GET /plan/:planId/days/summary` returns 500**
The `count_verses_read_in_range` RPC function from Step 4 was not created. Run that SQL block in the Supabase SQL editor.

**Next.js shows a blank page or CSS tokens are missing**
The `:root` token injection happens in `apps/web/app/layout.tsx`. Check the browser console for JavaScript errors. Make sure `NEXT_PUBLIC_API_BASE_URL` points to `http://localhost:4000/api`.

---

## API reference

### Bible (public — no auth required)

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/bible/books` | All 66 books in canonical order |
| GET | `/api/bible/books/:usfm` | Single book by USFM code (e.g. `GEN`) |
| GET | `/api/bible/books/:usfm/chapters` | All chapters for a book |
| GET | `/api/bible/chapters/:id/verses` | All verses for a chapter |

### Auth

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/auth/guest` | Create an anonymous guest session; returns `{ guestToken }` |
| GET | `/api/auth/me` | Resolve current user → `{ id, planId }` (requires auth) |

### Plan (auth required — Bearer JWT or `X-Guest-Token` header)

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/plan/today` | Today's reading day for the authenticated user |
| GET | `/api/plan/:planId/day/:dayNumber` | Specific plan day details |
| GET | `/api/plan/:planId/days/summary` | Completion % for all 365 days |

### Progress (auth required)

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/progress/verses` | Mark verses read — the **only** write path |
| GET | `/api/progress/continue` | First unread verse position in the user's plan |
| GET | `/api/progress/summary` | Aggregate reading stats |
| GET | `/api/progress/reads` | Read verse IDs within a given verse range |

### Auth modes

Both are resolved automatically by `AuthGuard`:

- **Bearer JWT** — `Authorization: Bearer <token>` — Supabase session token (Phase 5, not yet active)
- **Guest token** — `X-Guest-Token: <uuid>` — stored in `localStorage`, no sign-up required

---

## Key architectural decisions

- **`verse_reads` is the only source of truth.** Completion %, progress bars, and summaries are all computed at query time — nothing derived is ever stored in the database.
- **`global_order` never appears in API responses.** It's an internal integer used for range arithmetic in SQL. All API responses use `verse_id`.
- **All progress writes go through `POST /api/progress/verses`.** Every insert uses `{ onConflict: 'user_id,verse_id', ignoreDuplicates: true }` — duplicate reads are silently ignored.
- **CSS tokens only.** No hardcoded hex values anywhere in the UI. Every colour, spacing value, and radius references a CSS custom property.
- **Controllers are routing-only.** All business logic lives in NestJS services, never in controllers.

---

## Build phases

| Phase | Status | Description |
| --- | --- | --- |
| 1 — Foundation | ✅ Complete | Monorepo, DB schema, Bible seed, API, design system |
| 2 — Reading & Progress | ✅ Complete | Plan API, progress API, auth guard, reading screen UI |
| 3 — Plan View | ✅ Complete | 365-day plan list, /auth/me, days/summary endpoint |
| 4 — Guest Mode & Offline | 🔜 Next | IndexedDB queue, offline sync, optimistic UI |
| 5 — Auth & Migration | 🔜 | OTP email login, guest → user migration |
| 6 — Analytics | 🔜 | Streak, ahead/behind, completion chart |
| 7 — Polish | 🔜 | Accessibility, performance, PWA |

See [12_PROGRESS_LOG.md](./12_PROGRESS_LOG.md) for the live task-by-task changelog with agent attribution.
