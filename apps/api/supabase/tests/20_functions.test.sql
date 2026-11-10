-- Assertions for the SQL functions added in 002. Each check is an ASSERT;
-- psql stops on the first failure (ON_ERROR_STOP).
\set ON_ERROR_STOP on

DO $$
DECLARE
  u   CONSTANT UUID := '00000000-0000-0000-0000-0000000000b1';
  g   CONSTANT UUID := '00000000-0000-0000-0000-0000000000b2';
  p1  CONSTANT UUID := '00000000-0000-0000-0000-0000000000a1';
  r   RECORD;
  n   INT;
BEGIN
  -- 002 data fixes
  ASSERT (SELECT is_default FROM plans WHERE id = p1), 'oldest 1yr plan with days must be default';
  ASSERT public.default_plan_id() = p1, 'default_plan_id()';
  ASSERT (SELECT plan_id FROM users WHERE guest_token = 'empty-plan-guest') IS NULL,
    'users on a plan with no days are reset to the default';

  -- first_unread_verse: nothing read → GEN 1:1
  SELECT * INTO r FROM public.first_unread_verse(u, p1);
  ASSERT r.verse_id = 1 AND r.book_usfm = 'GEN' AND r.chapter_number = 1, 'continue starts at GEN 1:1';

  -- guest reads GEN 1 fully and GEN 3:1; user already read GEN 1:1
  INSERT INTO verse_reads (user_id, verse_id, read_at) VALUES
    (g, 1, '2026-01-05T10:00:00Z'), (g, 2, '2026-01-05T10:00:00Z'),
    (g, 3, '2026-01-05T10:00:00Z'), (g, 6, '2026-01-06T10:00:00Z'),
    (u, 1, '2026-01-04T10:00:00Z');

  -- migrate_guest: moves only the 3 non-duplicate reads + plan settings
  SELECT * INTO r FROM public.migrate_guest('guest-tok', u);
  ASSERT r.migrated_reads = 3 AND NOT r.already_migrated, format('migrate: %s', r);
  ASSERT (SELECT COUNT(*) FROM verse_reads WHERE user_id = u) = 4, 'user now has 4 reads';
  ASSERT (SELECT plan_id FROM users WHERE id = u) = p1, 'plan carried over';
  ASSERT (SELECT plan_start_date FROM users WHERE id = u) = '2026-01-05', 'start date carried over';
  ASSERT (SELECT archived_at IS NOT NULL AND guest_token IS NULL FROM users WHERE id = g), 'guest archived';
  SELECT * INTO r FROM public.migrate_guest('guest-tok', u);
  ASSERT r.already_migrated AND r.migrated_reads = 0, 'migrate is idempotent';

  -- first_unread_verse skips read verses: GEN 1 read, next is GEN 2:1 (id 4)
  SELECT * INTO r FROM public.first_unread_verse(u, p1);
  ASSERT r.verse_id = 4 AND r.chapter_number = 2 AND r.verse_number = 1, format('continue: %s', r);

  -- plan_days_summary: one row per day with labels spanning books
  ASSERT (SELECT COUNT(*) FROM public.plan_days_summary(u, p1)) = 3, 'summary has 3 days';
  SELECT * INTO r FROM public.plan_days_summary(u, p1) WHERE day_number = 1;
  ASSERT r.total_verses = 3 AND r.verses_read = 3, format('day 1: %s', r);
  SELECT * INTO r FROM public.plan_days_summary(u, p1) WHERE day_number = 3;
  ASSERT r.total_verses = 6 AND r.verses_read = 1 AND r.start_book_usfm = 'GEN'
     AND r.start_chapter = 3 AND r.end_book_usfm = 'EXO' AND r.end_chapter = 1, format('day 3: %s', r);

  -- plan_day_chapters: day 3 = GEN 3 + EXO 1, across the book boundary
  ASSERT (SELECT COUNT(*) FROM public.plan_day_chapters(u, 6, 11)) = 2, 'day 3 has 2 chapters';
  SELECT * INTO r FROM public.plan_day_chapters(u, 6, 11) LIMIT 1;
  ASSERT r.book_usfm = 'GEN' AND r.chapter_number = 3 AND r.verse_ids = '{6,7,8,9}'
     AND r.verse_numbers = '{1,2,3,4}' AND r.read_verse_ids = '{6}', format('GEN 3: %s', r);
  SELECT * INTO r FROM public.plan_day_chapters(u, 6, 11) OFFSET 1;
  ASSERT r.book_usfm = 'EXO' AND r.read_verse_ids = '{}', format('EXO 1: %s', r);

  -- reading_streak / daily_read_counts use the caller's local day
  DELETE FROM verse_reads WHERE user_id = u;
  INSERT INTO verse_reads (user_id, verse_id, read_at) VALUES
    (u, 1, now()), (u, 2, now() - interval '1 day'), (u, 3, now() - interval '2 days'),
    (u, 4, now() - interval '4 days');
  ASSERT public.reading_streak(u, 'UTC') = 3, format('streak today: %s', public.reading_streak(u, 'UTC'));
  DELETE FROM verse_reads WHERE user_id = u AND verse_id = 1;
  ASSERT public.reading_streak(u, 'UTC') = 2, 'streak still alive when nothing read yet today';
  DELETE FROM verse_reads WHERE user_id = u AND verse_id = 2;
  ASSERT public.reading_streak(u, 'UTC') = 0, 'streak broken after a missed day';

  SELECT COUNT(*), SUM(count) INTO r FROM public.daily_read_counts(u, 7, 'UTC');
  ASSERT r.count = 7 AND r.sum = 2, format('daily counts: %s', r);
  ASSERT (SELECT MAX(day) FROM public.daily_read_counts(u, 7, 'Pacific/Kiritimati'))
       = (now() AT TIME ZONE 'Pacific/Kiritimati')::DATE, 'series ends on local today';

  -- reset_progress: archive + delete atomically
  n := public.reset_progress(u);
  ASSERT n = 2, format('reset archived %s', n);
  ASSERT (SELECT COUNT(*) FROM verse_reads WHERE user_id = u) = 0, 'reads deleted';
  ASSERT (SELECT COUNT(*) FROM archived_verse_reads WHERE user_id = u) = 2, 'reads archived';

  -- security: anon can no longer execute helpers or read archives
  ASSERT NOT has_function_privilege('anon', 'public.reset_progress(uuid)', 'EXECUTE'), 'anon cannot reset';
  ASSERT NOT has_function_privilege('anon', 'public.count_verses_read_in_range(uuid,bigint,bigint)', 'EXECUTE'),
    'anon cannot count';
  ASSERT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.archived_verse_reads'::regclass),
    'RLS on archived_verse_reads';
  ASSERT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'verse_reads'),
    'verse_reads in realtime publication';

  RAISE NOTICE 'all SQL function tests passed';
END $$;
