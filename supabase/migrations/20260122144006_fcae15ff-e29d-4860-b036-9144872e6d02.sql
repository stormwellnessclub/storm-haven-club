-- =====================================================
-- Migration 8: mark_guest_pass_used function
-- =====================================================

-- Function to mark guest pass as used
CREATE OR REPLACE FUNCTION public.mark_guest_pass_used(p_pass_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _pass_record RECORD;
BEGIN
  -- Get the pass record
  SELECT * INTO _pass_record
  FROM public.guest_passes
  WHERE id = p_pass_id
    AND status = 'active'
    AND expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Guest pass not found, already used, or expired'
    );
  END IF;

  -- Mark as used (exhausted)
  UPDATE public.guest_passes
  SET status = 'used',
      used_at = now()
  WHERE id = p_pass_id;

  RETURN jsonb_build_object(
    'success', true,
    'pass_id', p_pass_id,
    'guest_name', _pass_record.guest_name
  );
END;
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.mark_guest_pass_used(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_guest_pass_used(UUID) TO anon;