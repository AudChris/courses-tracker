ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS course_tracker_select_own ON public.courses;
CREATE POLICY course_tracker_select_own
  ON public.courses
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS course_tracker_restrict_select_own ON public.courses;
CREATE POLICY course_tracker_restrict_select_own
  ON public.courses
  AS RESTRICTIVE
  FOR SELECT
  TO public
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS course_tracker_insert_own ON public.courses;
CREATE POLICY course_tracker_insert_own
  ON public.courses
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS course_tracker_restrict_insert_own ON public.courses;
CREATE POLICY course_tracker_restrict_insert_own
  ON public.courses
  AS RESTRICTIVE
  FOR INSERT
  TO public
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS course_tracker_update_own ON public.courses;
CREATE POLICY course_tracker_update_own
  ON public.courses
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS course_tracker_restrict_update_own ON public.courses;
CREATE POLICY course_tracker_restrict_update_own
  ON public.courses
  AS RESTRICTIVE
  FOR UPDATE
  TO public
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS course_tracker_delete_own ON public.courses;
CREATE POLICY course_tracker_delete_own
  ON public.courses
  FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS course_tracker_restrict_delete_own ON public.courses;
CREATE POLICY course_tracker_restrict_delete_own
  ON public.courses
  AS RESTRICTIVE
  FOR DELETE
  TO public
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS course_tracker_select_own ON public.profiles;
CREATE POLICY course_tracker_select_own
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS course_tracker_restrict_select_own ON public.profiles;
CREATE POLICY course_tracker_restrict_select_own
  ON public.profiles
  AS RESTRICTIVE
  FOR SELECT
  TO public
  USING ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS course_tracker_update_own ON public.profiles;
CREATE POLICY course_tracker_update_own
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS course_tracker_restrict_insert_own ON public.profiles;
CREATE POLICY course_tracker_restrict_insert_own
  ON public.profiles
  AS RESTRICTIVE
  FOR INSERT
  TO public
  WITH CHECK ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS course_tracker_restrict_update_own ON public.profiles;
CREATE POLICY course_tracker_restrict_update_own
  ON public.profiles
  AS RESTRICTIVE
  FOR UPDATE
  TO public
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS course_tracker_restrict_delete_own ON public.profiles;
CREATE POLICY course_tracker_restrict_delete_own
  ON public.profiles
  AS RESTRICTIVE
  FOR DELETE
  TO public
  USING ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS course_tracker_avatar_select_own ON storage.objects;
CREATE POLICY course_tracker_avatar_select_own
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );

DROP POLICY IF EXISTS course_tracker_avatar_insert_own ON storage.objects;
CREATE POLICY course_tracker_avatar_insert_own
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );

DROP POLICY IF EXISTS course_tracker_avatar_restrict_insert_own ON storage.objects;
CREATE POLICY course_tracker_avatar_restrict_insert_own
  ON storage.objects
  AS RESTRICTIVE
  FOR INSERT
  TO public
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );

DROP POLICY IF EXISTS course_tracker_avatar_update_own ON storage.objects;
CREATE POLICY course_tracker_avatar_update_own
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );

DROP POLICY IF EXISTS course_tracker_avatar_restrict_update_own ON storage.objects;
CREATE POLICY course_tracker_avatar_restrict_update_own
  ON storage.objects
  AS RESTRICTIVE
  FOR UPDATE
  TO public
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );

DROP POLICY IF EXISTS course_tracker_avatar_restrict_delete_own ON storage.objects;
CREATE POLICY course_tracker_avatar_restrict_delete_own
  ON storage.objects
  AS RESTRICTIVE
  FOR DELETE
  TO public
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );
