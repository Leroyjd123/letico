-- ============================================================
-- Enable RLS on archived_verse_reads (defense-in-depth; the API
-- only ever accesses this table via the service-role key, but it
-- was the one user-data table left without RLS enabled, and it's
-- now written to by the reset-progress flow).
-- ============================================================

ALTER TABLE public.archived_verse_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own archived verse reads"
  ON public.archived_verse_reads
  FOR SELECT
  USING (auth.uid() = user_id);
