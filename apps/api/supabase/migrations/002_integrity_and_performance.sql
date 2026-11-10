-- ============================================================
-- Lectio — 002: integrity, security and performance fixes
--
-- Run once in the Supabase SQL editor after 001_initial_schema.sql.
-- Safe to re-run: every statement is idempotent.
--
-- Why this exists:
--   * PostgREST caps every SELECT at 1,000 rows by default. The API used to
--     fetch "all reads" into Node and work on them there, which silently
--     truncated (and, for reset/migration, DELETED) everything past row 1,000.
--     Each multi-row operation is now a single SQL function that runs in one
--     transaction and never ships the user's whole history over the wire.
--   * archived_verse_reads had no RLS, so the public anon key could read and
--     write every user's archived history.
--   * Helper functions were executable by anon/authenticated with any user id.
-- ============================================================

-- ------------------------------------------------------------
-- Plans: explicit default plan instead of matching on a name string
-- ------------------------------------------------------------
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;

-- Mark the oldest "1 year plan" that actually has days as the default,
-- unless a default is already set.
UPDATE public.plans p
SET is_default = true
WHERE NOT EXISTS (SELECT 1 FROM public.plans WHERE is_default)
  AND p.id = (
    SELECT pl.id
    FROM public.plans pl
    WHERE pl.name = '1 year plan'
      AND EXISTS (SELECT 1 FROM public.plan_days pd WHERE pd.plan_id = pl.id)
    ORDER BY pl.created_at
    LIMIT 1
  );

-- At most one default plan.
CREATE UNIQUE INDEX IF NOT EXISTS plans_single_default_idx
  ON public.plans (is_default) WHERE is_default;

-- Users pointing at a plan with no days (the seeded-but-empty 2yr and
-- chronological plans) would get a broken "today" screen. Reset them to the
-- default plan.
UPDATE public.users u
SET plan_id = NULL
WHERE u.plan_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.plan_days pd WHERE pd.plan_id = u.plan_id);

-- ------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS archived_verse_reads_user_id_idx
  ON public.archived_verse_reads (user_id);

-- ------------------------------------------------------------
-- RLS: archived_verse_reads was wide open
-- ------------------------------------------------------------
ALTER TABLE public.archived_verse_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users can read own archived reads" ON public.archived_verse_reads;
CREATE POLICY "users can read own archived reads"
  ON public.archived_verse_reads FOR SELECT USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- default_plan_id()
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.default_plan_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT id
  FROM public.plans
  WHERE is_default
     OR (name = '1 year plan' AND NOT EXISTS (SELECT 1 FROM public.plans WHERE is_default))
  ORDER BY is_default DESC, created_at
  LIMIT 1;
$$;

-- ------------------------------------------------------------
-- reset_progress(user) — archive + delete in ONE transaction
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reset_progress(p_user_id UUID)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INT;
BEGIN
  WITH moved AS (
    DELETE FROM public.verse_reads
    WHERE user_id = p_user_id
    RETURNING user_id, verse_id, read_at
  )
  INSERT INTO public.archived_verse_reads (user_id, verse_id, read_at)
  SELECT user_id, verse_id, read_at FROM moved;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ------------------------------------------------------------
-- migrate_guest(guest_token, user) — move ALL guest reads + plan settings
-- to the signed-in user and archive the guest, in ONE transaction.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.migrate_guest(p_guest_token TEXT, p_user_id UUID)
RETURNS TABLE (migrated_reads INT, already_migrated BOOLEAN)
LANGUAGE plpgsql
AS $$
DECLARE
  v_guest public.users%ROWTYPE;
  v_moved INT;
BEGIN
  SELECT * INTO v_guest
  FROM public.users
  WHERE guest_token = p_guest_token
    AND archived_at IS NULL
  FOR UPDATE;

  IF NOT FOUND OR v_guest.id = p_user_id THEN
    RETURN QUERY SELECT 0, true;
    RETURN;
  END IF;

  INSERT INTO public.verse_reads (user_id, verse_id, read_at)
  SELECT p_user_id, verse_id, read_at
  FROM public.verse_reads
  WHERE user_id = v_guest.id
  ON CONFLICT (user_id, verse_id) DO NOTHING;

  GET DIAGNOSTICS v_moved = ROW_COUNT;

  -- Carry over the guest's plan and start date unless the account has its own.
  UPDATE public.users
  SET plan_id         = COALESCE(plan_id, v_guest.plan_id),
      plan_start_date = COALESCE(plan_start_date, v_guest.plan_start_date)
  WHERE id = p_user_id;

  UPDATE public.users
  SET archived_at = now(), guest_token = NULL
  WHERE id = v_guest.id;

  RETURN QUERY SELECT v_moved, false;
END;
$$;

-- ------------------------------------------------------------
-- first_unread_verse(user, plan) — "continue reading" position.
-- Replaces fetching every read id and building a giant NOT IN (...) URL.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.first_unread_verse(p_user_id UUID, p_plan_id UUID)
RETURNS TABLE (
  verse_id       INT,
  verse_number   INT,
  chapter_number INT,
  book_name      TEXT,
  book_usfm      TEXT
)
LANGUAGE sql
STABLE
AS $$
  WITH bounds AS (
    SELECT MIN(start_global_order) AS lo, MAX(end_global_order) AS hi
    FROM public.plan_days
    WHERE plan_id = p_plan_id
  )
  SELECT v.id, v.number, c.number, b.name, b.usfm_code
  FROM bounds, public.verses v
  JOIN public.chapters c ON c.id = v.chapter_id
  JOIN public.books b    ON b.id = c.book_id
  WHERE v.global_order BETWEEN bounds.lo AND bounds.hi
    AND NOT EXISTS (
      SELECT 1 FROM public.verse_reads vr
      WHERE vr.user_id = p_user_id AND vr.verse_id = v.id
    )
  ORDER BY v.global_order
  LIMIT 1;
$$;

-- ------------------------------------------------------------
-- plan_days_summary(user, plan) — every day's completion in ONE query
-- (previously 365 separate RPC round-trips per request).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.plan_days_summary(p_user_id UUID, p_plan_id UUID)
RETURNS TABLE (
  day_number         INT,
  total_verses       INT,
  verses_read        INT,
  start_book_name    TEXT,
  start_book_usfm    TEXT,
  start_chapter      INT,
  end_book_name      TEXT,
  end_book_usfm      TEXT,
  end_chapter        INT
)
LANGUAGE sql
STABLE
AS $$
  WITH counts AS (
    SELECT pd.id,
           COUNT(v.id)::INT  AS total_verses,
           COUNT(vr.id)::INT AS verses_read
    FROM public.plan_days pd
    JOIN public.verses v
      ON v.global_order BETWEEN pd.start_global_order AND pd.end_global_order
    LEFT JOIN public.verse_reads vr
      ON vr.verse_id = v.id AND vr.user_id = p_user_id
    WHERE pd.plan_id = p_plan_id
    GROUP BY pd.id
  )
  SELECT pd.day_number,
         counts.total_verses,
         counts.verses_read,
         sb.name, sb.usfm_code, sc.number,
         eb.name, eb.usfm_code, ec.number
  FROM public.plan_days pd
  JOIN counts ON counts.id = pd.id
  JOIN public.verses sv   ON sv.id = pd.start_verse_id
  JOIN public.chapters sc ON sc.id = sv.chapter_id
  JOIN public.books sb    ON sb.id = sc.book_id
  JOIN public.verses ev   ON ev.id = pd.end_verse_id
  JOIN public.chapters ec ON ec.id = ev.chapter_id
  JOIN public.books eb    ON eb.id = ec.book_id
  WHERE pd.plan_id = p_plan_id
  ORDER BY pd.day_number;
$$;

-- ------------------------------------------------------------
-- plan_day_chapters(user, start, end) — the exact chapters (across book
-- boundaries) that make up one plan day, with the verse ids the client needs
-- to mark them and which of those verses this user has already read.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.plan_day_chapters(
  p_user_id            UUID,
  p_start_global_order BIGINT,
  p_end_global_order   BIGINT
)
RETURNS TABLE (
  chapter_id      INT,
  chapter_number  INT,
  book_usfm       TEXT,
  book_name       TEXT,
  verse_ids       INT[],
  verse_numbers   INT[],
  read_verse_ids  INT[]
)
LANGUAGE sql
STABLE
AS $$
  SELECT c.id,
         c.number,
         b.usfm_code,
         b.name,
         ARRAY_AGG(v.id ORDER BY v.number),
         ARRAY_AGG(v.number ORDER BY v.number),
         COALESCE(ARRAY_AGG(v.id ORDER BY v.number) FILTER (WHERE vr.id IS NOT NULL), '{}')
  FROM public.verses v
  JOIN public.chapters c ON c.id = v.chapter_id
  JOIN public.books b    ON b.id = c.book_id
  LEFT JOIN public.verse_reads vr
    ON vr.verse_id = v.id AND vr.user_id = p_user_id
  WHERE v.global_order BETWEEN p_start_global_order AND p_end_global_order
  GROUP BY c.id, c.number, b.usfm_code, b.name
  ORDER BY MIN(v.global_order);
$$;

-- ------------------------------------------------------------
-- daily_read_counts(user, days, tz) — verses read per LOCAL calendar day
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.daily_read_counts(p_user_id UUID, p_days INT, p_tz TEXT)
RETURNS TABLE (day DATE, count INT)
LANGUAGE sql
STABLE
AS $$
  WITH today AS (SELECT (now() AT TIME ZONE p_tz)::DATE AS t),
  series AS (
    SELECT (today.t - g)::DATE AS day
    FROM today, generate_series(0, GREATEST(p_days, 1) - 1) AS g
  ),
  counts AS (
    SELECT (vr.read_at AT TIME ZONE p_tz)::DATE AS day, COUNT(*)::INT AS n
    FROM public.verse_reads vr, today
    WHERE vr.user_id = p_user_id
      AND vr.read_at >= ((today.t - GREATEST(p_days, 1))::TIMESTAMP AT TIME ZONE p_tz)
    GROUP BY 1
  )
  SELECT s.day, COALESCE(c.n, 0)
  FROM series s
  LEFT JOIN counts c ON c.day = s.day
  ORDER BY s.day;
$$;

-- ------------------------------------------------------------
-- reading_streak(user, tz) — consecutive LOCAL days with >= 1 read, ending
-- today or yesterday (a day without reading yet today does not break it).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reading_streak(p_user_id UUID, p_tz TEXT)
RETURNS INT
LANGUAGE sql
STABLE
AS $$
  WITH days AS (
    SELECT DISTINCT (read_at AT TIME ZONE p_tz)::DATE AS day
    FROM public.verse_reads
    WHERE user_id = p_user_id
  ),
  islands AS (
    SELECT day, day - (ROW_NUMBER() OVER (ORDER BY day))::INT AS grp
    FROM days
  ),
  today AS (SELECT (now() AT TIME ZONE p_tz)::DATE AS t),
  anchor AS (
    SELECT i.grp
    FROM islands i, today
    WHERE i.day IN (today.t, today.t - 1)
    ORDER BY i.day DESC
    LIMIT 1
  )
  SELECT COALESCE((SELECT COUNT(*)::INT FROM islands WHERE grp = (SELECT grp FROM anchor)), 0);
$$;

-- ------------------------------------------------------------
-- Lock functions down: only the backend (service_role) may call them.
-- Without this, anyone holding the public anon key could call e.g.
-- reset_progress() for an arbitrary user id.
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION public.count_verses_read_in_range(UUID, BIGINT, BIGINT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.default_plan_id()                                 FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reset_progress(UUID)                               FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.migrate_guest(TEXT, UUID)                          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.first_unread_verse(UUID, UUID)                     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.plan_days_summary(UUID, UUID)                      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.plan_day_chapters(UUID, BIGINT, BIGINT)            FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.daily_read_counts(UUID, INT, TEXT)                 FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reading_streak(UUID, TEXT)                         FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.count_verses_read_in_range(UUID, BIGINT, BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION public.default_plan_id()                                 TO service_role;
GRANT EXECUTE ON FUNCTION public.reset_progress(UUID)                               TO service_role;
GRANT EXECUTE ON FUNCTION public.migrate_guest(TEXT, UUID)                          TO service_role;
GRANT EXECUTE ON FUNCTION public.first_unread_verse(UUID, UUID)                     TO service_role;
GRANT EXECUTE ON FUNCTION public.plan_days_summary(UUID, UUID)                      TO service_role;
GRANT EXECUTE ON FUNCTION public.plan_day_chapters(UUID, BIGINT, BIGINT)            TO service_role;
GRANT EXECUTE ON FUNCTION public.daily_read_counts(UUID, INT, TEXT)                 TO service_role;
GRANT EXECUTE ON FUNCTION public.reading_streak(UUID, TEXT)                         TO service_role;

-- ------------------------------------------------------------
-- Realtime: cross-device sync listens for verse_reads inserts. The table was
-- never added to the realtime publication, so no events were ever sent.
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'verse_reads'
     )
  THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.verse_reads;
  END IF;
END;
$$;
