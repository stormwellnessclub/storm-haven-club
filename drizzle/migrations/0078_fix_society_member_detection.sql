CREATE OR REPLACE FUNCTION public.admin_add_society_person(_user_id uuid, _full_name text, _email text, _phone text,
  _preferred_rhythm text, _themes text[], _book_suggestion text, _staff_note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE m record; _found boolean := false; _email_l text := lower(trim(coalesce(_email,''))); _id uuid;
BEGIN
  IF NOT (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager')) THEN
    RAISE EXCEPTION 'Not authorized'; END IF;
  IF _email_l = '' THEN RAISE EXCEPTION 'Email is required'; END IF;
  IF coalesce(trim(_full_name),'') = '' THEN RAISE EXCEPTION 'Name is required'; END IF;
  IF EXISTS (SELECT 1 FROM higher_self_society_interest WHERE lower(email) = _email_l
             OR (_user_id IS NOT NULL AND user_id = _user_id)) THEN
    RAISE EXCEPTION 'This person is already on the roster'; END IF;
  SELECT * INTO m FROM members WHERE ((_user_id IS NOT NULL AND user_id = _user_id) OR lower(email) = _email_l)
    AND status IN ('active','frozen','past_due')
    ORDER BY created_at DESC LIMIT 1;
  _found := FOUND;
  INSERT INTO higher_self_society_interest (user_id, member_id, full_name, email, phone, membership_type, is_founding, is_member,
    themes, preferred_rhythm, book_suggestion, source, added_by, staff_note, guest_status)
  VALUES (
    CASE WHEN _found THEN coalesce(_user_id, m.user_id) ELSE _user_id END,
    CASE WHEN _found THEN m.id ELSE NULL END,
    CASE WHEN _found THEN trim(coalesce(m.first_name,'')||' '||coalesce(m.last_name,'')) ELSE trim(_full_name) END,
    CASE WHEN _found THEN coalesce(m.email, trim(_email)) ELSE trim(_email) END,
    coalesce(nullif(trim(_phone),''), CASE WHEN _found THEN m.phone END),
    CASE WHEN _found THEN m.membership_type ELSE 'Non-member' END,
    CASE WHEN _found THEN coalesce(m.is_founding_member,false) ELSE false END,
    _found,
    coalesce(_themes,'{}'), nullif(_preferred_rhythm,''), left(nullif(_book_suggestion,''),300), 'staff', auth.uid(), left(nullif(_staff_note,''),1000), 'none')
  RETURNING id INTO _id;
  RETURN jsonb_build_object('success', true, 'id', _id, 'is_member', _found);
END $$;