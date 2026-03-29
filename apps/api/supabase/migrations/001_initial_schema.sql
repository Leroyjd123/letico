-- ============================================================
-- Lectio — Initial Schema Migration
-- Version: 1.0
-- Order matters: tables must be created before tables that
-- reference them via FOREIGN KEY.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- BIBLE DATA (static, publicly readable)
-- ============================================================

CREATE TABLE public.books (
  id            SERIAL PRIMARY KEY,
  usfm_code     TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  testament     TEXT NOT NULL
                  CHECK (testament IN ('OT', 'NT')),
  chapter_count INT  NOT NULL,
  sort_order    INT  NOT NULL UNIQUE    -- canonical Bible ordering (1–66)
                                        -- intentionally separate from id:
                                        -- prevents a future re-seed from
                                        -- silently breaking the jw.org deep-link
                                        -- URL which uses sort_order as {BB}
);

CREATE TABLE public.chapters (
  id          SERIAL PRIMARY KEY,
  book_id     INT NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  number      INT NOT NULL,
  verse_count INT NOT NULL,
  UNIQUE (book_id, number)
);

CREATE TABLE public.verses (
  id           SERIAL PRIMARY KEY,
  chapter_id   INT    NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  number       INT    NOT NULL,
  text         TEXT   NOT NULL,
  global_order BIGINT NOT NULL UNIQUE,   -- sequential 1 → 31102 across all verses
  UNIQUE (chapter_id, number)
);

CREATE INDEX verses_global_order_idx ON public.verses (global_order);

-- ============================================================
-- PLANS
-- ============================================================

CREATE TABLE public.plans (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.plan_days (
  id                  UUID   PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id             UUID   NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  day_number          INT    NOT NULL,                         -- 1-based
  start_verse_id      INT    NOT NULL REFERENCES public.verses(id),
  end_verse_id        INT    NOT NULL REFERENCES public.verses(id),
  start_global_order  BIGINT NOT NULL,                         -- denormalised from verses.global_order at seed time
  end_global_order    BIGINT NOT NULL,                         -- denormalised from verses.global_order at seed time
                                                               -- stored to eliminate 730 subqueries per plan-view render
  UNIQUE (plan_id, day_number)
);

CREATE INDEX plan_days_plan_id_idx ON public.plan_days (plan_id);

-- ============================================================
-- USERS
-- ============================================================

CREATE TABLE public.users (
  id               UUID PRIMARY KEY,          -- mirrors auth.users.id
  email            TEXT,                       -- NULL for guest users
  guest_token      TEXT UNIQUE,               -- UUID for guest identification; NULL after migration
  plan_id          UUID REFERENCES public.plans(id),
  plan_start_date  DATE,                       -- day 1 of their plan; NULL = show day 1
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at      TIMESTAMPTZ                 -- soft delete (guest TTL, user account deletion)
);

-- ============================================================
-- PROGRESS (verse_reads is the sole source of truth)
-- ============================================================

CREATE TABLE public.verse_reads (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  verse_id   INT         NOT NULL REFERENCES public.verses(id),
  read_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, verse_id)   -- one row per user per verse; upsert semantics
);

-- Indexes: user progress lookups, streak calculation, cross-user analytics
CREATE INDEX verse_reads_user_id_idx  ON public.verse_reads (user_id);
CREATE INDEX verse_reads_read_at_idx  ON public.verse_reads (user_id, read_at);
CREATE INDEX verse_reads_verse_id_idx ON public.verse_reads (verse_id);

-- ============================================================
-- ARCHIVED PROGRESS (reset / recovery)
-- ============================================================

CREATE TABLE public.archived_verse_reads (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        NOT NULL REFERENCES public.users(id),
  verse_id    INT         NOT NULL REFERENCES public.verses(id),
  read_at     TIMESTAMPTZ NOT NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- HELPER FUNCTION
-- ============================================================

-- count_verses_read_in_range: used by PlanService to compute per-day
-- completion % without firing subqueries for global_order lookups.
-- Parameters use global_order directly (stored on plan_days) rather than
-- verse IDs to avoid two correlated subqueries per call.
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

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Bible data: publicly readable (no auth required)
ALTER TABLE public.books       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapters    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verses      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_days   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "books are publicly readable"
  ON public.books FOR SELECT USING (true);

CREATE POLICY "chapters are publicly readable"
  ON public.chapters FOR SELECT USING (true);

CREATE POLICY "verses are publicly readable"
  ON public.verses FOR SELECT USING (true);

CREATE POLICY "plans are publicly readable"
  ON public.plans FOR SELECT USING (true);

CREATE POLICY "plan_days are publicly readable"
  ON public.plan_days FOR SELECT USING (true);

-- Users: own row only
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can view own record"
  ON public.users FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users can update own record"
  ON public.users FOR UPDATE USING (auth.uid() = id);

-- Verse reads: own rows only
-- NOTE: Guest users do not have auth.uid() — all write operations for guests
-- must use the service role key on the backend (bypasses RLS). Never use the
-- anon key for write operations in NestJS.
ALTER TABLE public.verse_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can read own reads"
  ON public.verse_reads FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users can insert own reads"
  ON public.verse_reads FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users can delete own reads"
  ON public.verse_reads FOR DELETE USING (auth.uid() = user_id);
