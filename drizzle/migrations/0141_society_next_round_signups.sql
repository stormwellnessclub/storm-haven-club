ALTER TABLE public.higher_self_society_interest
  ADD COLUMN IF NOT EXISTS joined_round_key text,
  ADD COLUMN IF NOT EXISTS joined_round_at timestamptz;

CREATE OR REPLACE FUNCTION public.submit_higher_self_society_interest(_themes text[], _preferred_rhythm text, _book_suggestion text, _book_reason text, _guest_requested boolean, _guest_name text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE m record; _guest_ok boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Please sign in'; END IF;
  SELECT * INTO m FROM members
   WHERE (user_id = auth.uid() OR lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid())))
     AND status IN ('active','frozen','past_due')
   ORDER BY (user_id = auth.uid()) DESC LIMIT 1;
  IF m IS NULL THEN RAISE EXCEPTION 'The Higher Self Society is reserved for Storm Wellness Club members'; END IF;
  _guest_ok := coalesce(m.is_founding_member,false) OR m.membership_type ILIKE '%diamond%';
  INSERT INTO higher_self_society_interest AS h (user_id, member_id, full_name, email, membership_type, is_founding,
    themes, preferred_rhythm, book_suggestion, book_reason, guest_requested, guest_name, guest_status, joined_round_key, joined_round_at)
  VALUES (auth.uid(), m.id, trim(m.first_name||' '||m.last_name), m.email, m.membership_type, coalesce(m.is_founding_member,false),
    coalesce(_themes,'{}'), _preferred_rhythm, left(_book_suggestion,300), left(_book_reason,1000),
    _guest_ok AND coalesce(_guest_requested,false), CASE WHEN _guest_ok AND _guest_requested THEN left(_guest_name,120) END,
    CASE WHEN _guest_ok AND _guest_requested THEN 'pending' ELSE 'none' END, 'round-2', now())
  ON CONFLICT (user_id) DO UPDATE SET themes = excluded.themes, preferred_rhythm = excluded.preferred_rhythm,
    book_suggestion = excluded.book_suggestion, book_reason = excluded.book_reason,
    guest_requested = excluded.guest_requested, guest_name = excluded.guest_name,
    guest_status = CASE WHEN excluded.guest_requested AND h.guest_status IN ('approved','declined') THEN h.guest_status ELSE excluded.guest_status END,
    membership_type = excluded.membership_type, is_founding = excluded.is_founding,
    joined_round_key = 'round-2', joined_round_at = coalesce(CASE WHEN h.joined_round_key = 'round-2' THEN h.joined_round_at END, now()),
    updated_at = now();
  RETURN jsonb_build_object('success', true, 'guest_allowed', _guest_ok);
END $function$;

-- People who re-submitted the form after the Round 2 announcement went out (Nov 1, 2026).
UPDATE public.higher_self_society_interest
   SET joined_round_key = 'round-2', joined_round_at = updated_at
 WHERE source = 'self' AND updated_at >= timestamptz '2026-11-01 12:00:00+00';