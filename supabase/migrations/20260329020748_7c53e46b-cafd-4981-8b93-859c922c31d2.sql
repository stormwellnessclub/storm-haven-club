
-- Function to get the next waitlist position for a session (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_next_waitlist_position(p_session_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(MAX(position), 0) + 1
  FROM public.class_waitlist
  WHERE session_id = p_session_id;
$$;

-- Function to get waitlist counts for multiple sessions (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_waitlist_counts(p_session_ids uuid[])
RETURNS TABLE(session_id uuid, count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cw.session_id, COUNT(*) as count
  FROM public.class_waitlist cw
  WHERE cw.session_id = ANY(p_session_ids)
    AND cw.status IN ('waiting', 'notified')
  GROUP BY cw.session_id;
$$;
