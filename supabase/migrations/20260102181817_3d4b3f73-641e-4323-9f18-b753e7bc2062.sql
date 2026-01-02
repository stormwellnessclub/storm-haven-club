-- Allow authenticated users to view active instructors (needed for booking/schedule queries)
CREATE POLICY "Authenticated users can view active instructors"
ON public.instructors FOR SELECT
TO authenticated
USING (is_active = true);