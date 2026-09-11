-- Private events: public requests, planning, quoting, invoicing, tasks, time blocking

CREATE TABLE public.private_event_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  phone text,
  event_type text,
  preferred_date date,
  preferred_time text,
  guest_count integer,
  spaces text[] NOT NULL DEFAULT '{}',
  budget_range text,
  notes text,
  status text NOT NULL DEFAULT 'new',
  converted_event_id uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.private_event_requests TO authenticated;
GRANT INSERT ON public.private_event_requests TO anon;
GRANT ALL ON public.private_event_requests TO service_role;
ALTER TABLE public.private_event_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a private event request"
ON public.private_event_requests FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Staff can read private event requests"
ON public.private_event_requests FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk']::app_role[]));

CREATE POLICY "Staff can update private event requests"
ON public.private_event_requests FOR UPDATE TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]));

CREATE POLICY "Admins can delete private event requests"
ON public.private_event_requests FOR DELETE TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin']::app_role[]));


CREATE TABLE public.private_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  request_id uuid REFERENCES public.private_event_requests(id) ON DELETE SET NULL,
  member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  title text NOT NULL,
  event_type text,
  client_first_name text,
  client_last_name text,
  client_email text,
  client_phone text,
  event_date date,
  start_time time,
  end_time time,
  guest_count integer,
  spaces text[] NOT NULL DEFAULT '{}',
  stage text NOT NULL DEFAULT 'inquiry',
  internal_notes text,
  flat_total_cents integer,
  tax_enabled boolean NOT NULL DEFAULT true,
  pass_processing_fee boolean NOT NULL DEFAULT false,
  deposit_type text NOT NULL DEFAULT 'percent',
  deposit_value numeric NOT NULL DEFAULT 25,
  balance_due_date date
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.private_events TO authenticated;
GRANT ALL ON public.private_events TO service_role;
ALTER TABLE public.private_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read private events"
ON public.private_events FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk']::app_role[]));

CREATE POLICY "Managers can write private events"
ON public.private_events FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]));


CREATE TABLE public.private_event_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.private_events(id) ON DELETE CASCADE,
  label text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price_cents integer NOT NULL DEFAULT 0,
  taxable boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.private_event_line_items TO authenticated;
GRANT ALL ON public.private_event_line_items TO service_role;
ALTER TABLE public.private_event_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read private event line items"
ON public.private_event_line_items FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk']::app_role[]));

CREATE POLICY "Managers can write private event line items"
ON public.private_event_line_items FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]));


CREATE TABLE public.private_event_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.private_events(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'deposit',
  label text,
  amount_cents integer NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  due_date date,
  pay_token uuid NOT NULL DEFAULT gen_random_uuid(),
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  payment_method text,
  sent_at timestamptz,
  paid_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE UNIQUE INDEX private_event_invoices_pay_token_idx ON public.private_event_invoices(pay_token);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.private_event_invoices TO authenticated;
GRANT ALL ON public.private_event_invoices TO service_role;
ALTER TABLE public.private_event_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read private event invoices"
ON public.private_event_invoices FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk']::app_role[]));

CREATE POLICY "Managers can write private event invoices"
ON public.private_event_invoices FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]));


CREATE TABLE public.private_event_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.private_events(id) ON DELETE CASCADE,
  title text NOT NULL,
  assignee text,
  due_date date,
  is_done boolean NOT NULL DEFAULT false,
  done_at timestamptz,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.private_event_tasks TO authenticated;
GRANT ALL ON public.private_event_tasks TO service_role;
ALTER TABLE public.private_event_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read private event tasks"
ON public.private_event_tasks FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk']::app_role[]));

CREATE POLICY "Staff can write private event tasks"
ON public.private_event_tasks FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk']::app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk']::app_role[]));


CREATE TABLE public.private_event_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.private_events(id) ON DELETE CASCADE,
  block_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  space text,
  spa_room_id uuid REFERENCES public.spa_rooms(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX private_event_blocks_date_idx ON public.private_event_blocks(block_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.private_event_blocks TO authenticated;
GRANT ALL ON public.private_event_blocks TO service_role;
ALTER TABLE public.private_event_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read private event blocks"
ON public.private_event_blocks FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk','spa_staff','class_instructor']::app_role[]));

CREATE POLICY "Managers can write private event blocks"
ON public.private_event_blocks FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]));


CREATE TABLE public.private_event_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.private_events(id) ON DELETE CASCADE,
  kind text NOT NULL,
  message text NOT NULL,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX private_event_activity_event_idx ON public.private_event_activity(event_id, created_at DESC);

GRANT SELECT, INSERT ON public.private_event_activity TO authenticated;
GRANT ALL ON public.private_event_activity TO service_role;
ALTER TABLE public.private_event_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read private event activity"
ON public.private_event_activity FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk']::app_role[]));

CREATE POLICY "Staff can add private event activity"
ON public.private_event_activity FOR INSERT TO authenticated
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk']::app_role[]));


-- Keep updated_at fresh
CREATE OR REPLACE FUNCTION public.touch_private_event()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER private_events_touch
BEFORE UPDATE ON public.private_events
FOR EACH ROW EXECUTE FUNCTION public.touch_private_event();


-- Auto-manage time blocks as the stage changes
CREATE OR REPLACE FUNCTION public.sync_private_event_blocks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sp text;
BEGIN
  IF NEW.stage IN ('lost','cancelled') THEN
    DELETE FROM public.private_event_blocks WHERE event_id = NEW.id;
    RETURN NEW;
  END IF;

  IF NEW.stage IN ('booked','completed')
     AND NEW.event_date IS NOT NULL
     AND NEW.start_time IS NOT NULL
     AND NEW.end_time IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.private_event_blocks WHERE event_id = NEW.id)
  THEN
    IF array_length(NEW.spaces, 1) IS NULL THEN
      INSERT INTO public.private_event_blocks (event_id, block_date, start_time, end_time, space)
      VALUES (NEW.id, NEW.event_date, NEW.start_time, NEW.end_time, NULL);
    ELSE
      FOREACH sp IN ARRAY NEW.spaces LOOP
        INSERT INTO public.private_event_blocks (event_id, block_date, start_time, end_time, space)
        VALUES (NEW.id, NEW.event_date, NEW.start_time, NEW.end_time, sp);
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER private_events_block_sync
AFTER INSERT OR UPDATE OF stage, event_date, start_time, end_time ON public.private_events
FOR EACH ROW EXECUTE FUNCTION public.sync_private_event_blocks();


-- Spa availability must respect private event blocks tied to a spa room
CREATE OR REPLACE FUNCTION public.get_spa_busy_slots(p_date date)
RETURNS TABLE(appointment_time time without time zone, duration_minutes integer, cleanup_minutes integer, staff_id uuid, room_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT a.appointment_time,
         COALESCE(a.duration_minutes, 0),
         COALESCE(a.cleanup_minutes, 0),
         a.staff_id,
         a.room_id
  FROM public.spa_appointments a
  WHERE a.appointment_date = p_date
    AND a.status IN ('confirmed', 'pending', 'checked_in', 'in_progress')
  UNION ALL
  SELECT b.start_time,
         GREATEST(0, (EXTRACT(EPOCH FROM (b.end_time - b.start_time)) / 60)::int),
         0,
         NULL::uuid,
         b.spa_room_id
  FROM public.private_event_blocks b
  WHERE b.block_date = p_date
    AND b.spa_room_id IS NOT NULL;
$$;


-- Conflict lookup for staff scheduling a private event
CREATE OR REPLACE FUNCTION public.private_event_conflicts(
  p_date date,
  p_start time,
  p_end time,
  p_exclude_event uuid DEFAULT NULL
)
RETURNS TABLE(source text, label text, start_time time, end_time time)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 'class'::text,
         COALESCE(ct.name, 'Class') || COALESCE(' — ' || cs.room, ''),
         cs.start_time,
         cs.end_time
  FROM public.class_sessions cs
  LEFT JOIN public.class_types ct ON ct.id = cs.class_type_id
  WHERE cs.session_date = p_date
    AND COALESCE(cs.is_cancelled, false) = false
    AND cs.start_time < p_end
    AND COALESCE(cs.end_time, cs.start_time) > p_start
  UNION ALL
  SELECT 'spa'::text,
         'Spa appointment',
         a.appointment_time,
         (a.appointment_time + make_interval(mins => COALESCE(a.duration_minutes, 0)))::time
  FROM public.spa_appointments a
  WHERE a.appointment_date = p_date
    AND a.status IN ('confirmed','pending','checked_in','in_progress')
    AND a.appointment_time < p_end
    AND (a.appointment_time + make_interval(mins => COALESCE(a.duration_minutes, 0)))::time > p_start
  UNION ALL
  SELECT 'private_event'::text,
         COALESCE(e.title, 'Private event') || COALESCE(' — ' || b.space, ''),
         b.start_time,
         b.end_time
  FROM public.private_event_blocks b
  JOIN public.private_events e ON e.id = b.event_id
  WHERE b.block_date = p_date
    AND (p_exclude_event IS NULL OR b.event_id <> p_exclude_event)
    AND b.start_time < p_end
    AND b.end_time > p_start;
$$;

GRANT EXECUTE ON FUNCTION public.private_event_conflicts(date, time, time, uuid) TO authenticated;