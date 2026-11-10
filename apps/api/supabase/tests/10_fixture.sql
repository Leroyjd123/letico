-- Test fixture loaded between 001 and 002 so 002's data fixes are exercised.
\set ON_ERROR_STOP on


-- ── Fixture: GEN 1 (3 verses), GEN 2 (2), GEN 3 (4), EXO 1 (2) = 11 verses ──
INSERT INTO books (id, usfm_code, name, testament, chapter_count, sort_order) VALUES
  (1, 'GEN', 'Genesis', 'OT', 3, 1), (2, 'EXO', 'Exodus', 'OT', 1, 2);
INSERT INTO chapters (id, book_id, number, verse_count) VALUES
  (1, 1, 1, 3), (2, 1, 2, 2), (3, 1, 3, 4), (4, 2, 1, 2);
INSERT INTO verses (id, chapter_id, number, text, global_order)
SELECT g, CASE WHEN g <= 3 THEN 1 WHEN g <= 5 THEN 2 WHEN g <= 9 THEN 3 ELSE 4 END,
       CASE WHEN g <= 3 THEN g WHEN g <= 5 THEN g - 3 WHEN g <= 9 THEN g - 5 ELSE g - 9 END,
       'v' || g, g
FROM generate_series(1, 11) g;

INSERT INTO plans (id, name, created_at) VALUES
  ('00000000-0000-0000-0000-0000000000a1', '1 year plan', now() - interval '1 day'),
  ('00000000-0000-0000-0000-0000000000a2', '2 year plan', now());   -- no days
INSERT INTO plan_days (plan_id, day_number, start_verse_id, end_verse_id, start_global_order, end_global_order) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 1, 1, 3, 1, 3),     -- GEN 1
  ('00000000-0000-0000-0000-0000000000a1', 2, 4, 5, 4, 5),     -- GEN 2
  ('00000000-0000-0000-0000-0000000000a1', 3, 6, 11, 6, 11);   -- GEN 3 · EXO 1

INSERT INTO users (id, email, guest_token, plan_id, plan_start_date) VALUES
  ('00000000-0000-0000-0000-0000000000b1', 'u@example.com', NULL, NULL, NULL),
  ('00000000-0000-0000-0000-0000000000b2', NULL, 'guest-tok', '00000000-0000-0000-0000-0000000000a1', '2026-01-05'),
  ('00000000-0000-0000-0000-0000000000b3', NULL, 'empty-plan-guest', '00000000-0000-0000-0000-0000000000a2', NULL);
