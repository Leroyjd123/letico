# lectio — technical architecture

**Version:** 1.0  
**Last Updated:** 2026-03-28

---

## 1. overview

Lectio is a monorepo containing a Next.js frontend, a NestJS backend, and shared packages. The data layer is Supabase (Postgres + Auth + Realtime). The frontend is deployed on Vercel. The backend may run as a Vercel serverless function or a standalone Node process on a VPS — the architecture supports both.

---

## 2. system diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENT                              │
│                                                             │
│   Next.js App Router (Vercel)                               │
│   ├── React Query (server state)                            │
│   ├── Zustand or useState (local UI state)                  │
│   ├── IndexedDB (offline queue)                             │
│   └── localStorage (guest_token, theme preference)          │
│                                                             │
│   Pages: /read  /plan  /analytics  /settings  /login        │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTPS REST
                        │ Bearer token (Supabase JWT)
┌───────────────────────▼─────────────────────────────────────┐
│                        API                                  │
│                                                             │
│   NestJS (Node.js)                                          │
│   ├── BibleModule      → /api/bible/*                       │
│   ├── PlanModule       → /api/plan/*                        │
│   ├── ProgressModule   → /api/progress/*                    │
│   ├── AnalyticsModule  → (via ProgressModule)               │
│   └── AuthModule       → /api/auth/*                        │
│                                                             │
│   Global: ValidationPipe, CacheModule (in-memory), CORS     │
└───────────────────────┬─────────────────────────────────────┘
                        │ Supabase JS client
                        │ (service role key)
┌───────────────────────▼─────────────────────────────────────┐
│                      SUPABASE                               │
│                                                             │
│   Postgres (primary store)                                  │
│   ├── RLS on all user tables                                │
│   └── Helper functions (count_verses_read_in_range)         │
│                                                             │
│   Auth (OTP via email)                                      │
│   Realtime (verse_reads table subscription)                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. monorepo structure

```
lectio/
├── apps/
│   ├── web/                        # Next.js 14 App Router
│   │   ├── app/
│   │   │   ├── (auth)/login/
│   │   │   ├── read/               # home / today's passage
│   │   │   ├── plan/               # plan day list
│   │   │   ├── analytics/
│   │   │   ├── settings/
│   │   │   └── layout.tsx          # root layout, token injection
│   │   ├── components/
│   │   │   ├── ui/                 # Text, Button, ProgressBar
│   │   │   ├── reader/             # TodayCard, ChapterGrid, ChapterTile
│   │   │   ├── modals/             # VerseSelectorModal
│   │   │   ├── plan/               # PlanDayRow
│   │   │   ├── analytics/          # StatCard, ProgressGraph
│   │   │   └── providers/          # QueryProvider, AuthProvider
│   │   ├── hooks/
│   │   │   ├── useVerseRead.ts     # mark verses read, optimistic update
│   │   │   ├── useContinueReading.ts
│   │   │   ├── useOfflineQueue.ts
│   │   │   └── usePlanDay.ts
│   │   ├── lib/
│   │   │   ├── api.ts              # typed fetch wrappers
│   │   │   ├── api.types.ts        # frontend DTOs
│   │   │   ├── supabase.ts         # browser client factory
│   │   │   ├── queryClient.ts      # React Query config
│   │   │   ├── verseRange.ts       # pure range utilities
│   │   │   └── jwLink.ts           # jw.org URL builder
│   │   ├── stories/                # Storybook
│   │   └── __tests__/
│   │
│   └── api/                        # NestJS
│       ├── src/
│       │   ├── main.ts
│       │   ├── app.module.ts
│       │   ├── supabase/           # provider + decorator
│       │   ├── bible/              # module, controller, service, types, spec
│       │   ├── plan/
│       │   ├── progress/
│       │   └── auth/
│       ├── supabase/
│       │   └── migrations/
│       └── test/                   # e2e tests
│
├── packages/
│   ├── types/                      # shared interfaces + design tokens
│   │   └── src/
│   │       ├── index.ts            # domain types
│   │       └── tokens.ts           # design token constants + CSS builder
│   └── tsconfig/
│       ├── base.json
│       └── nextjs.json
│
├── turbo.json
├── package.json                    # pnpm workspaces
└── .env.example
```

---

## 4. technology decisions

### 4.1 why turborepo

Single repo for all code. Shared types package eliminates DTO drift between frontend and backend. Turbo caches build/test outputs — only rebuilds what changed. `pnpm` workspaces handle dependency hoisting.

### 4.2 why next.js app router

Server Components for fast initial load (Bible data, plan day). Client Components only for interactive pieces (chapter tiles, modal, offline queue). Route-level code splitting built in. Vercel deployment is zero-config.

### 4.3 why nestjs

Modular architecture enforces separation of concerns. Decorators keep controllers thin. Injectable providers make unit testing straightforward (mock SupabaseClient). Built-in ValidationPipe + class-validator. Compatible with serverless (Vercel Functions) and standalone Node.

### 4.4 why supabase

Managed Postgres with Row Level Security. Built-in OTP auth via email — no custom auth infrastructure needed. Realtime WebSocket subscriptions on table changes for cross-device sync. Service role key used on the backend; anon key on the frontend (RLS enforces access control).

### 4.5 why react query

Handles stale/fresh state, background refetch, optimistic updates, and retry logic. Stale times are tuned per data type (Bible content: 24h; progress: 30s). `useMutation` with `onMutate` for optimistic verse marking. Query invalidation on successful mutation keeps UI consistent.

### 4.6 why indexeddb for offline queue

localStorage is synchronous and has a 5MB limit — unsuitable for potentially hundreds of queued verse reads. IndexedDB is async, larger capacity, and survives service worker refreshes. The queue is a simple key-value store: `{ verseId, queuedAt, synced }`.

---

## 5. data flow — marking a verse read

```
User taps chapter tile
        │
        ▼
ChapterTile.onClick()
        │
        ▼
useVerseRead.markChapter(chapterId)
  → get all verseIds for chapter (from React Query cache)
  → write to IndexedDB queue { verseIds, synced: false }
  → optimistically update local verse_reads Set in React Query cache
  → UI updates immediately (tile turns read)
        │
        ▼  (if online)
POST /api/progress/verses { verseIds: [...] }
        │
        ▼
ProgressService.markVersesRead(userId, verseIds)
  → Supabase upsert verse_reads (UNIQUE user_id, verse_id)
  → return { inserted: N }
        │
        ▼
Mark IndexedDB items synced: true
React Query invalidates /progress/summary and /progress/continue
```

---

## 6. cross-device sync flow

```
Device A marks verse 1000 read
  → POST /api/progress/verses
  → Supabase inserts verse_reads row

Supabase Realtime fires INSERT event on verse_reads
  → Device B receives event via WebSocket subscription
  → Device B React Query cache invalidated
  → Device B re-fetches /progress/summary
  → Device B UI updates
```

---

## 7. offline flow

```
User goes offline (navigator.onLine = false)
  → All verse mark actions write to IndexedDB
  → UI updates optimistically from local cache

User comes online (window 'online' event fires)
  → useOfflineQueue reads unsynced items from IndexedDB
  → Chunks items into batches of ≤ 500
  → POST /api/progress/verses for each batch
  → On success: mark items synced: true in IndexedDB
  → On failure: retry with exponential backoff (max 3 attempts)
  → After all batches: invalidate React Query progress queries
```

---

## 8. auth flow

```
Guest visit
  → POST /api/auth/guest → { guest_token }
  → Store guest_token in localStorage
  → All API calls include X-Guest-Token header
  → Backend resolves user from guest_token

OTP sign-in
  → POST /api/auth/otp/send { email }
  → Supabase sends OTP email
  → POST /api/auth/otp/verify { email, token }
  → Returns { access_token, user }
  → Store in Supabase session (cookie-based via @supabase/ssr)

Migration
  → POST /api/auth/migrate { guest_token }
  → Backend: UPDATE verse_reads SET user_id = authUserId WHERE user_id = guestUserId
  → Backend: soft-delete guest user row
  → Frontend: clear guest_token from localStorage
```

---

## 9. caching strategy

| resource | stale time | cache mechanism |
|---|---|---|
| Bible books | 24 hours | React Query + NestJS CacheModule (in-memory) |
| Bible chapters | 24 hours | React Query + NestJS CacheModule |
| Bible verses | 1 hour | React Query + NestJS CacheModule |
| Plan day view | 5 minutes | React Query |
| Progress summary | 30 seconds | React Query |
| Continue position | 30 seconds | React Query |
| Verse reads (local set) | session | React Query + optimistic updates |

---

## 10. environment variables

| variable | location | description |
|---|---|---|
| NEXT_PUBLIC_SUPABASE_URL | web | Supabase project URL |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | web | Supabase anon key (RLS enforced) |
| NEXT_PUBLIC_API_URL | web | NestJS API base URL |
| SUPABASE_URL | api | Same as above |
| SUPABASE_SERVICE_ROLE_KEY | api | Service role — never expose to browser |
| FRONTEND_URL | api | For CORS allow-list |
| PORT | api | API listen port (default 4000) |
| NODE_ENV | both | development / production |

---

## 11. deployment

| service | platform | config |
|---|---|---|
| apps/web | Vercel | Auto-deploy from main branch; env vars in Vercel dashboard |
| apps/api | Vercel Functions or VPS | `nest build` → `node dist/main`; env vars in platform config |
| Database | Supabase | Migrations via `supabase db push`; seed via npm script |

---

## 12. version history

| version | date | notes |
|---|---|---|
| 1.0 | 2026-03-28 | Initial draft |
