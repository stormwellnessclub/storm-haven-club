CREATE OR REPLACE FUNCTION public.sync_non_member_to_marketing_contact()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.email IS NULL OR position('@' in NEW.email) = 0 THEN RETURN NEW; END IF;
  INSERT INTO public.marketing_contacts (email, first_name, last_name, phone, source, source_label, linked_non_member_id, segment)
  VALUES (lower(trim(NEW.email)), NEW.first_name, NEW.last_name, NEW.phone, 'manual', 'Non-member portal account', NEW.id, 'non_member')
  ON CONFLICT (lower(email)) WHERE email IS NOT NULL
  DO UPDATE SET linked_non_member_id = COALESCE(public.marketing_contacts.linked_non_member_id, EXCLUDED.linked_non_member_id),
    first_name = COALESCE(public.marketing_contacts.first_name, EXCLUDED.first_name),
    last_name = COALESCE(public.marketing_contacts.last_name, EXCLUDED.last_name),
    phone = COALESCE(public.marketing_contacts.phone, EXCLUDED.phone),
    updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_non_member_to_marketing_contact ON public.non_member_profiles;
CREATE TRIGGER trg_sync_non_member_to_marketing_contact
AFTER INSERT OR UPDATE OF email ON public.non_member_profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_non_member_to_marketing_contact();

INSERT INTO public.marketing_contacts (email, first_name, last_name, phone, source, source_label, linked_non_member_id, segment)
SELECT DISTINCT ON (lower(trim(n.email))) lower(trim(n.email)), n.first_name, n.last_name, n.phone, 'manual', 'Non-member portal account', n.id, 'non_member'
FROM public.non_member_profiles n
WHERE n.email IS NOT NULL AND position('@' in n.email) > 0
ON CONFLICT (lower(email)) WHERE email IS NOT NULL
DO UPDATE SET linked_non_member_id = COALESCE(public.marketing_contacts.linked_non_member_id, EXCLUDED.linked_non_member_id), updated_at = now();