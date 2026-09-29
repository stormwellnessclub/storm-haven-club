CREATE TABLE public.higher_self_society_interest (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id uuid,
  full_name text NOT NULL,
  email text NOT NULL,
  membership_type text,
  is_founding boolean NOT NULL DEFAULT false,
  themes text[] NOT NULL DEFAULT '{}',
  preferred_rhythm text,
  book_suggestion text,
  book_reason text,
  guest_requested boolean NOT NULL DEFAULT false,
  guest_name text,
  guest_status text NOT NULL DEFAULT 'none',
  status text NOT NULL DEFAULT 'interested',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.higher_self_society_interest TO authenticated;
GRANT UPDATE (guest_status, status) ON public.higher_self_society_interest TO authenticated;
GRANT ALL ON public.higher_self_society_interest TO service_role;
ALTER TABLE public.higher_self_society_interest ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or staff read" ON public.higher_self_society_interest FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]));
CREATE POLICY "staff update" ON public.higher_self_society_interest FOR UPDATE TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]));

CREATE OR REPLACE FUNCTION public.submit_higher_self_society_interest(
  _themes text[], _preferred_rhythm text, _book_suggestion text, _book_reason text,
  _guest_requested boolean, _guest_name text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    themes, preferred_rhythm, book_suggestion, book_reason, guest_requested, guest_name, guest_status)
  VALUES (auth.uid(), m.id, trim(m.first_name||' '||m.last_name), m.email, m.membership_type, coalesce(m.is_founding_member,false),
    coalesce(_themes,'{}'), _preferred_rhythm, left(_book_suggestion,300), left(_book_reason,1000),
    _guest_ok AND coalesce(_guest_requested,false), CASE WHEN _guest_ok AND _guest_requested THEN left(_guest_name,120) END,
    CASE WHEN _guest_ok AND _guest_requested THEN 'pending' ELSE 'none' END)
  ON CONFLICT (user_id) DO UPDATE SET themes = excluded.themes, preferred_rhythm = excluded.preferred_rhythm,
    book_suggestion = excluded.book_suggestion, book_reason = excluded.book_reason,
    guest_requested = excluded.guest_requested, guest_name = excluded.guest_name,
    guest_status = CASE WHEN excluded.guest_requested AND h.guest_status IN ('approved','declined') THEN h.guest_status ELSE excluded.guest_status END,
    membership_type = excluded.membership_type, is_founding = excluded.is_founding, updated_at = now();
  RETURN jsonb_build_object('success', true, 'guest_allowed', _guest_ok);
END $$;
REVOKE ALL ON FUNCTION public.submit_higher_self_society_interest(text[],text,text,text,boolean,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.submit_higher_self_society_interest(text[],text,text,text,boolean,text) TO authenticated;