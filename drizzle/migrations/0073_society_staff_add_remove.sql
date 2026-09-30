ALTER TABLE public.higher_self_society_interest ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.higher_self_society_interest
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS is_member boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS added_by uuid,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'self',
  ADD COLUMN IF NOT EXISTS staff_note text;
CREATE UNIQUE INDEX IF NOT EXISTS hss_interest_email_lower_uniq ON public.higher_self_society_interest (lower(email));

CREATE OR REPLACE FUNCTION public.admin_add_society_person(_user_id uuid, _full_name text, _email text, _phone text,
  _preferred_rhythm text, _themes text[], _book_suggestion text, _staff_note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE m record; _email_l text := lower(trim(coalesce(_email,''))); _id uuid;
BEGIN
  IF NOT (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager')) THEN
    RAISE EXCEPTION 'Not authorized'; END IF;
  IF _email_l = '' THEN RAISE EXCEPTION 'Email is required'; END IF;
  IF coalesce(trim(_full_name),'') = '' THEN RAISE EXCEPTION 'Name is required'; END IF;
  IF EXISTS (SELECT 1 FROM higher_self_society_interest WHERE lower(email) = _email_l
             OR (_user_id IS NOT NULL AND user_id = _user_id)) THEN
    RAISE EXCEPTION 'This person is already on the roster'; END IF;
  SELECT * INTO m FROM members WHERE (( _user_id IS NOT NULL AND user_id = _user_id) OR lower(email) = _email_l)
    ORDER BY (status IN ('active','frozen','past_due')) DESC LIMIT 1;
  IF m IS NOT NULL AND m.status = 'cancelled' AND NOT EXISTS (SELECT 1 FROM members WHERE lower(email)=_email_l AND status IN ('active','frozen','past_due')) THEN
    m := NULL; -- cancelled members are treated as non-members
  END IF;
  IF m IS NOT NULL AND m.status NOT IN ('active','frozen','past_due') THEN m := NULL; END IF;
  INSERT INTO higher_self_society_interest (user_id, member_id, full_name, email, phone, membership_type, is_founding, is_member,
    themes, preferred_rhythm, book_suggestion, source, added_by, staff_note, guest_status)
  VALUES (coalesce(_user_id, m.user_id), m.id,
    CASE WHEN m IS NOT NULL THEN trim(m.first_name||' '||m.last_name) ELSE trim(_full_name) END,
    coalesce(m.email, trim(_email)), coalesce(nullif(trim(_phone),''), m.phone),
    CASE WHEN m IS NOT NULL THEN m.membership_type ELSE 'Non-member' END,
    coalesce(m.is_founding_member,false), m IS NOT NULL,
    coalesce(_themes,'{}'), nullif(_preferred_rhythm,''), left(nullif(_book_suggestion,''),300), 'staff', auth.uid(), left(nullif(_staff_note,''),1000), 'none')
  RETURNING id INTO _id;
  RETURN jsonb_build_object('success', true, 'id', _id, 'is_member', m IS NOT NULL);
END $$;

CREATE OR REPLACE FUNCTION public.admin_remove_society_person(_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager')) THEN
    RAISE EXCEPTION 'Not authorized'; END IF;
  DELETE FROM higher_self_society_interest WHERE id = _id;
  RETURN jsonb_build_object('success', FOUND);
END $$;
REVOKE ALL ON FUNCTION public.admin_add_society_person(uuid,text,text,text,text,text[],text,text) FROM public, anon;
REVOKE ALL ON FUNCTION public.admin_remove_society_person(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_add_society_person(uuid,text,text,text,text,text[],text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_remove_society_person(uuid) TO authenticated;