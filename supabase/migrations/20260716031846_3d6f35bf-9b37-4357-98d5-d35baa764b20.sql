
-- Restrict kiosk_search_visitors to authenticated staff only.
REVOKE EXECUTE ON FUNCTION public.kiosk_search_visitors(text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.kiosk_search_visitors(text) TO authenticated;

-- Restrict cafe review photo reads to approved reviews only.
DROP POLICY IF EXISTS "Anyone can view cafe review photos" ON storage.objects;
CREATE POLICY "Approved cafe review photos are viewable"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'cafe-review-photos'
  AND (
    EXISTS (
      SELECT 1 FROM public.cafe_reviews r
      WHERE r.photo_path = storage.objects.name
        AND r.moderation_status = 'approved'
    )
    OR auth.uid() = owner
    OR public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','cafe_staff']::app_role[])
  )
);
