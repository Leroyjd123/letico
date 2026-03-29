# lectio — database schema

**Version:** 1.0  
**Last Updated:** 2026-03-28  
**Database:** Supabase (Postgres 15)

---

## 1. design principles

- **verse_reads is the only progress table.** No derived state is stored. Completion %, streak, ahead/behind are computed at query time.
- **global_order enables cross-boundary range arithmetic.** Every verse has a unique sequential integer (1 → 31,102). Range queries use `global_order BETWEEN x AND y` rather than joining through chapters and books.
- **plan_days never store completion.** They store only the verse range for a plan day. Whether the user has read it is computed by joining against verse_reads.
- **RLS is enforced on all user tables.** The service role key on the backend uses explicit `user_id` filters; it does not bypass RLS.

---

## 2. entity relationship

```
books ──< chapters ──< verses ──< verse_reads >── users
                                                     │
plans ──< plan_days >──────────────────────────┘ (via verse ids)
                                                     │
                                              users >─ users
```

---

## 3. tables

### 3.1 books

```sql
CREATE TABLE public.books (
  id            SERIAL PRIMARY KEY,
  usfm_code     TEXT NOT NULL UNIQUE,     -- 'GEN', 'EXO', 'MAT' etc.
  name          TEXT NOT NULL,            -- 'Genesis', 'Matthew' etc.
  testament     TEXT NOT NULL             -- 'OT' | 'NT'
                  CHECK (testament IN ('OT', 'NT')),
  chapter_count INT  NOT NULL,
  sort_order    INT  NOT NULL UNIQUE      -- canonical Bible ordering (1–66)
);
```

**notes:**
- Static seed data. Never modified at runtime.
- `sort_order` is the canonical Bible ordering used to sort `GET /bible/books` and to construct the jw.org deep-link `{BB}` segment (zero-padded to 2 digits).
- `sort_order` is intentionally separate from `id` (which is a SERIAL). Although they will match if books are seeded in canonical order, keeping `sort_order` explicit prevents a future re-seed from silently breaking the deep-link URL if insertion order changes. The `UNIQUE` constraint also acts as a seed integrity check.
- `usfm_code` is the lookup key from the API (case-insensitive normalised to uppercase).

---

### 3.2 chapters

```sql
CREATE TABLE public.chapters (
  id          SERIAL PRIMARY KEY,
  book_id     INT NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  number      INT NOT NULL,
  verse_count INT NOT NULL,
  UNIQUE (book_id, number)
);
```

---

### 3.3 verses

```sql
CREATE TABLE public.verses (
  id           SERIAL PRIMARY KEY,
  chapter_id   INT    NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  number       INT    NOT NULL,
  text         TEXT   NOT NULL,
  global_order BIGINT NOT NULL UNIQUE,  -- sequential: 1 → 31102
  UNIQUE (chapter_id, number)
);

CREATE INDEX verses_global_order_idx ON public.verses (global_order);
```

**notes:**
- `global_order` is assigned during seed. Gen 1:1 = 1, Gen 1:2 = 2, ... Rev 22:21 = 31102.
- All range operations (plan_days, continue position, ahead/behind) use `global_order`.
- `text` is KJV. Static. Never user-modifiable.

---

### 3.4 plans

```sql
CREATE TABLE public.plans (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**seed data:**

| name | description |
|---|---|
| 1 year plan | sequential, Genesis to Revelation, 365 days |
| 2 year plan | sequential, Genesis to Revelation, 730 days |
| chronological | Bible events in historical order |

---

### 3.5 plan_days

```sql
CREATE TABLE public.plan_days (
  id                  UUID   PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id             UUID   NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  day_number          INT    NOT NULL,                        -- 1-based
  start_verse_id      INT    NOT NULL REFERENCES public.verses(id),
  end_verse_id        INT    NOT NULL REFERENCES public.verses(id),
  start_global_order  BIGINT NOT NULL,                        -- denormalised from verses.global_order at seed time
  end_global_order    BIGINT NOT NULL,                        -- denormalised from verses.global_order at seed time
  UNIQUE (plan_id, day_number)
);

CREATE INDEX plan_days_plan_id_idx ON public.plan_days (plan_id);
```

**notes:**
- Range is inclusive: `[start_verse_id, end_verse_id]` by `global_order`.
- `start_global_order` and `end_global_order` are copied from `verses.global_order` during seed. They are never updated at runtime.
- Storing these directly eliminates the two correlated subqueries inside `count_verses_read_in_range`. Without them, computing completion % for all 365 plan_days in a single plan view render would fire 730 subqueries (2 per row). With them, the helper function is a single-range COUNT.
- **A day is never marked complete in this table.** This is by design.

---

### 3.6 users

```sql
CREATE TABLE public.users (
  id               UUID PRIMARY KEY,           -- mirrors auth.users.id
  email            TEXT,                        -- NULL for guest users
  guest_token      TEXT UNIQUE,                 -- UUID for guest identification
  plan_id          UUID REFERENCES public.plans(id),
  plan_start_date  DATE,                        -- day 1 of their plan
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at      TIMESTAMPTZ                  -- soft delete on account deletion
);
```

**notes:**
- Guest users: `email = NULL`, `guest_token = <uuid>`.
- Authenticated users: `email = <email>`, `guest_token = NULL` (cleared after migration).
- `plan_start_date = NULL` → show day 1. Never error on null.

---

### 3.7 verse_reads

```sql
CREATE TABLE public.verse_reads (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  verse_id   INT         NOT NULL REFERENCES public.verses(id),
  read_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, verse_id)
);

CREATE INDEX verse_reads_user_id_idx  ON public.verse_reads (user_id);
CREATE INDEX verse_reads_read_at_idx  ON public.verse_reads (user_id, read_at);
CREATE INDEX verse_reads_verse_id_idx ON public.verse_reads (verse_id);
```

**critical notes:**
- **This is the single source of truth for all progress.**
- `UNIQUE(user_id, verse_id)` — one record per user per verse. Upsert semantics: insert or ignore on conflict.
- `read_at` is the server timestamp of first read. Not updated on re-mark. Not supplied by client.
- No plan day reference. No date target. No completion flag.

---

### 3.8 archived_verse_reads (reset progress)

```sql
CREATE TABLE public.archived_verse_reads (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        NOT NULL REFERENCES public.users(id),
  verse_id    INT         NOT NULL REFERENCES public.verses(id),
  read_at     TIMESTAMPTZ NOT NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**notes:**
- When a user resets progress, their `verse_reads` rows are moved here, not deleted.
- Allows recovery if user resets by mistake (admin operation).

---

## 4. helper functions

### 4.1 count_verses_read_in_range

```sql
CREATE OR REPLACE FUNCTION public.count_verses_read_in_range(
  p_user_id            UUID,
  p_start_global_order BIGINT,
  p_end_global_order   BIGINT
)
RETURNS INT
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)::INT
  FROM public.verse_reads vr
  JOIN public.verses v ON v.id = vr.verse_id
  WHERE vr.user_id = p_user_id
    AND v.global_order BETWEEN p_start_global_order AND p_end_global_order;
$$;
```

**signature change (v1.1):** Parameters are now `p_start_global_order` and `p_end_global_order` (BIGINT) instead of verse IDs. Callers pass `plan_days.start_global_order` and `plan_days.end_global_order` directly — values that are stored on the row and require no subquery. The old signature fired two correlated subqueries per call to look up `global_order` from verse IDs; for the plan view (365 rows), that was 730 extra subqueries per render.

**used by:** PlanService when computing per-day completion % in plan view. Call site: `count_verses_read_in_range(userId, planDay.startGlobalOrder, planDay.endGlobalOrder)`.

---

## 5. row level security

All user tables have RLS enabled. Bible data (books, chapters, verses, plans, plan_days) is publicly readable.

```sql
-- bible data: publicly readable
CREATE POLICY "books are publicly readable"       ON public.books       FOR SELECT USING (true);
CREATE POLICY "chapters are publicly readable"    ON public.chapters    FOR SELECT USING (true);
CREATE POLICY "verses are publicly readable"      ON public.verses      FOR SELECT USING (true);
CREATE POLICY "plans are publicly readable"       ON public.plans       FOR SELECT USING (true);
CREATE POLICY "plan_days are publicly readable"   ON public.plan_days   FOR SELECT USING (true);

-- users: own row only
CREATE POLICY "users can view own record"    ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users can update own record"  ON public.users FOR UPDATE  USING (auth.uid() = id);

-- verse_reads: own rows only
CREATE POLICY "users can read own reads"    ON public.verse_reads FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users can insert own reads"  ON public.verse_reads FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users can delete own reads"  ON public.verse_reads FOR DELETE USING (auth.uid() = user_id);
```

---

## 6. indexes summary

| table | index | columns | purpose |
|---|---|---|---|
| verses | verses_global_order_idx | global_order | Range queries for plan days, ahead/behind |
| verse_reads | verse_reads_user_id_idx | user_id | User progress lookups |
| verse_reads | verse_reads_read_at_idx | user_id, read_at | Streak calculation |
| verse_reads | verse_reads_verse_id_idx | verse_id | Cross-user analytics (future) |
| plan_days | plan_days_plan_id_idx | plan_id | Plan day lookups |

---

## 7. seed data expectations

| table | expected row count |
|---|---|
| books | 66 |
| chapters | 1,189 |
| verses | 31,102 |
| plans | 3 (1yr, 2yr, chronological) |
| plan_days (1yr plan) | 365 |

The seed script asserts `verse count = 31,102` and fails fast if the assertion fails.

---

## 8. guest user lifecycle & cleanup

Guest users accumulate indefinitely in the `users` table with their `verse_reads`. Without a cleanup policy, abandoned guest rows become dead weight over time.

**TTL policy:**

```sql
-- Soft-delete guest users with no verse_read activity for 90 days.
-- Run as a scheduled job (e.g., nightly pg_cron or Supabase scheduled function).
UPDATE public.users
SET archived_at = now()
WHERE guest_token IS NOT NULL
  AND archived_at IS NULL
  AND id NOT IN (
    SELECT DISTINCT user_id
    FROM public.verse_reads
    WHERE read_at > now() - INTERVAL '90 days'
  );
```

**notes:**

- Only affects rows where `guest_token IS NOT NULL` (guest users only; authenticated users are never cleaned up this way).
- `archived_at` is a soft delete — rows remain for potential recovery.
- `verse_reads` for archived guests are retained (CASCADE is on `ON DELETE CASCADE`, but soft-delete does not trigger it).
- 90-day window is a product decision. It means a guest who reads once and never returns is cleaned up after 3 months.
- This job does **not** run during MVP development. It is defined here so it is not forgotten at production launch.

---

## 9. version history

| version | date | notes |
|---|---|---|
| 1.0 | 2026-03-28 | Initial draft |
