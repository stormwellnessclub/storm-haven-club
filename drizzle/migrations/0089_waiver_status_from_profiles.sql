CREATE OR REPLACE FUNCTION public.effective_waiver_status(_user_ids uuid[])
 RETURNS TABLE(user_id uuid, status text, source text, signed_at timestamp with time zone)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH ids AS (SELECT unnest(_user_ids) AS user_id),
  nmp AS (SELECT n.user_id, bool_or(n.waiver_signed) AS waiver_signed, min(n.waiver_signed_at) AS waiver_signed_at
    FROM non_member_profiles n WHERE n.user_id = ANY(_user_ids) GROUP BY n.user_id),
  prof AS (SELECT p.user_id, bool_or(p.waiver_signed) AS waiver_signed, min(p.waiver_signed_at) AS waiver_signed_at
    FROM profiles p WHERE p.user_id = ANY(_user_ids) GROUP BY p.user_id),
  first_booking AS (SELECT cb.user_id, MIN(cb.created_at) AS ts FROM class_bookings cb
    WHERE cb.user_id = ANY(_user_ids) AND cb.status IN ('confirmed','completed','no_show') GROUP BY cb.user_id),
  first_pass AS (SELECT cp.user_id, MIN(cp.created_at) AS ts FROM class_passes cp
    WHERE cp.user_id = ANY(_user_ids) AND cp.status IN ('active','exhausted','expired') GROUP BY cp.user_id)
  SELECT i.user_id,
    CASE WHEN nmp.waiver_signed IS TRUE OR prof.waiver_signed IS TRUE OR fb.ts IS NOT NULL OR fp.ts IS NOT NULL
      THEN 'signed' ELSE 'unsigned' END::text,
    CASE WHEN nmp.waiver_signed IS TRUE OR prof.waiver_signed IS TRUE THEN 'explicit'
      WHEN fb.ts IS NOT NULL THEN 'inferred_booking' WHEN fp.ts IS NOT NULL THEN 'inferred_pass' ELSE 'none' END::text,
    COALESCE(prof.waiver_signed_at, nmp.waiver_signed_at, fb.ts, fp.ts)
  FROM ids i
  LEFT JOIN nmp ON nmp.user_id = i.user_id
  LEFT JOIN prof ON prof.user_id = i.user_id
  LEFT JOIN first_booking fb ON fb.user_id = i.user_id
  LEFT JOIN first_pass fp ON fp.user_id = i.user_id
$function$;

-- Keep the account waiver and the non-member record in step (one direction only flips to signed).
CREATE OR REPLACE FUNCTION public.sync_waiver_profile_to_nm()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.waiver_signed IS TRUE AND NEW.user_id IS NOT NULL THEN
    UPDATE non_member_profiles SET waiver_signed = true, waiver_signed_at = COALESCE(waiver_signed_at, NEW.waiver_signed_at, now())
    WHERE user_id = NEW.user_id AND waiver_signed IS NOT TRUE;
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.sync_waiver_nm_to_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.waiver_signed IS TRUE AND NEW.user_id IS NOT NULL THEN
    UPDATE profiles SET waiver_signed = true, waiver_signed_at = COALESCE(waiver_signed_at, NEW.waiver_signed_at, now())
    WHERE user_id = NEW.user_id AND waiver_signed IS NOT TRUE;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_sync_waiver_profile_to_nm ON public.profiles;
CREATE TRIGGER trg_sync_waiver_profile_to_nm AFTER INSERT OR UPDATE OF waiver_signed ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_waiver_profile_to_nm();
DROP TRIGGER IF EXISTS trg_sync_waiver_nm_to_profile ON public.non_member_profiles;
CREATE TRIGGER trg_sync_waiver_nm_to_profile AFTER INSERT OR UPDATE OF waiver_signed ON public.non_member_profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_waiver_nm_to_profile();