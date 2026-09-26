-- Canonical PT relationship for one user: membership and PT are independent.
CREATE OR REPLACE FUNCTION public.pt_person_relationship(_user_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM members WHERE user_id = _user_id AND status <> 'cancelled') THEN 'member'
    WHEN EXISTS (SELECT 1 FROM members WHERE user_id = _user_id AND status = 'cancelled') THEN 'former_member'
    ELSE 'non_member'
  END
  WHERE _user_id = auth.uid() OR pt_is_staff_or_desk(auth.uid());
$$;
REVOKE ALL ON FUNCTION public.pt_person_relationship(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_person_relationship(uuid) TO authenticated, service_role;