-- Security pass 4 (Nov 21 2026).
-- guard_member_field_tamper (Aug 2026) was SECURITY DEFINER, so inside it
-- current_user was always the owner and its "direct API caller" check let every
-- write through: members could edit protected fields on their own class
-- bookings, waitlist entries and kids-care bookings. As SECURITY INVOKER,
-- current_user is 'authenticated'/'anon' for direct API writes and the owner
-- for server code and SECURITY DEFINER RPCs (which stay exempt).
--
-- One member flow writes the waitlist directly: after a successful booking the
-- website marks the member's 'notified' entry 'claimed' (src/hooks/useBooking.ts).
-- That single transition is allowed only when the member really holds an active
-- booking for that session.
CREATE OR REPLACE FUNCTION public.guard_member_field_tamper()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  protected_cols text[] := TG_ARGV[0]::text[];
  col text;
  old_j jsonb := to_jsonb(OLD);
  new_j jsonb := to_jsonb(NEW);
  waitlist_claim boolean := false;
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk','spa_staff','cafe_staff','class_instructor','childcare_staff']::app_role[]) THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'class_waitlist'
     AND old_j ->> 'status' = 'notified'
     AND new_j ->> 'status' = 'claimed'
     AND (new_j ->> 'user_id')::uuid = auth.uid()
     AND EXISTS (
       SELECT 1 FROM public.class_bookings b
        WHERE b.session_id = (new_j ->> 'session_id')::uuid
          AND b.user_id = auth.uid()
          AND b.status::text IN ('confirmed', 'completed')
     ) THEN
    waitlist_claim := true;
  END IF;

  FOREACH col IN ARRAY protected_cols LOOP
    IF waitlist_claim AND col = 'claimed_at' THEN
      CONTINUE;
    END IF;
    IF (old_j -> col) IS DISTINCT FROM (new_j -> col) THEN
      RAISE EXCEPTION 'Not allowed to modify %.% ', TG_TABLE_NAME, col
        USING ERRCODE = '42501';
    END IF;
  END LOOP;

  IF (old_j ? 'status') AND (old_j -> 'status') IS DISTINCT FROM (new_j -> 'status') THEN
    IF NOT waitlist_claim AND COALESCE(new_j ->> 'status', '') NOT IN ('cancelled', 'canceled') THEN
      RAISE EXCEPTION 'Not allowed to set %.status to %', TG_TABLE_NAME, new_j ->> 'status'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_member_field_tamper() FROM PUBLIC, anon, authenticated;

-- Class passes: the member guard let a member raise their own
-- classes_remaining back up to the purchased total (refilling used classes).
-- Booking/cancel RPCs and server code still adjust balances freely. A member's
-- direct API write may only raise it as far as total minus visits still held by
-- their non-cancelled class and kids-care bookings on that pass, which keeps
-- the website's kids-care cancel refund (src/hooks/useKidsCareBooking.ts)
-- working while blocking refills.
CREATE OR REPLACE FUNCTION public.guard_class_passes_member_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  changed text[];
  allowed text[] := ARRAY['classes_remaining','status','updated_at'];
  bad text;
  v_used integer;
BEGIN
  IF public.is_privileged_row_writer() THEN
    RETURN NEW;
  END IF;

  changed := public.changed_columns(to_jsonb(OLD), to_jsonb(NEW));

  FOREACH bad IN ARRAY changed LOOP
    IF NOT (bad = ANY(allowed)) THEN
      RAISE EXCEPTION 'Not allowed to change % on your class pass', bad
        USING ERRCODE = '42501';
    END IF;
  END LOOP;

  IF NEW.classes_remaining > COALESCE(OLD.classes_total, OLD.classes_remaining) THEN
    RAISE EXCEPTION 'Remaining sessions cannot exceed the purchased total'
      USING ERRCODE = '42501';
  END IF;

  IF current_user IN ('authenticated', 'anon')
     AND NEW.classes_remaining > OLD.classes_remaining THEN
    SELECT
      (SELECT count(*) FROM public.class_bookings b
        WHERE b.pass_id = NEW.id AND b.status::text <> 'cancelled')
    + (SELECT count(*) FROM public.kids_care_bookings k
        WHERE k.pass_id = NEW.id AND k.status::text <> 'cancelled')
    INTO v_used;
    IF NEW.classes_remaining > COALESCE(OLD.classes_total, OLD.classes_remaining) - v_used THEN
      RAISE EXCEPTION 'Not allowed to add sessions to your class pass'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status::text NOT IN ('active','exhausted') THEN
    RAISE EXCEPTION 'Not allowed to set this pass status'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_class_passes_member_update() FROM PUBLIC, anon, authenticated;
