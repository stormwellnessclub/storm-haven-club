
ALTER TABLE public.pt_pass_adjustments
  ADD COLUMN IF NOT EXISTS transfer_pass_id uuid REFERENCES public.pt_passes(id) ON DELETE SET NULL;

ALTER TABLE public.pt_passes
  ADD COLUMN IF NOT EXISTS renewal_reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS renewal_reminder_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.pt_tasks
  ADD COLUMN IF NOT EXISTS recurrence text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS recurrence_interval integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS recurrence_until date,
  ADD COLUMN IF NOT EXISTS parent_task_id uuid REFERENCES public.pt_tasks(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.pt_adjust_pass_balance(
  p_pass_id uuid,
  p_delta integer,
  p_reason text,
  p_adjustment_type text DEFAULT 'manual',
  p_new_expires_at date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pass public.pt_passes%ROWTYPE;
  v_after integer;
  v_exp_before date;
  v_new_status text;
BEGIN
  IF NOT public.pt_is_staff_or_desk(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF coalesce(btrim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'A reason is required';
  END IF;

  SELECT * INTO v_pass FROM public.pt_passes WHERE id = p_pass_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Package not found'; END IF;

  v_after := GREATEST(0, v_pass.sessions_remaining + coalesce(p_delta, 0));
  v_exp_before := v_pass.expires_at;
  v_new_status := v_pass.status::text;
  IF v_pass.status::text = 'active' AND v_after = 0 THEN
    v_new_status := 'exhausted';
  ELSIF v_pass.status::text = 'exhausted' AND v_after > 0 THEN
    v_new_status := 'active';
  END IF;

  UPDATE public.pt_passes
     SET sessions_remaining = v_after,
         sessions_total = GREATEST(sessions_total, v_after),
         expires_at = COALESCE(p_new_expires_at, expires_at),
         status = v_new_status::pt_pass_status,
         updated_at = now()
   WHERE id = p_pass_id;

  INSERT INTO public.pt_pass_adjustments
    (pass_id, user_id, delta_sessions, sessions_before, sessions_after, adjustment_type,
     reason, expires_at_before, expires_at_after, created_by)
  VALUES
    (p_pass_id, v_pass.user_id, coalesce(p_delta,0), v_pass.sessions_remaining, v_after, coalesce(p_adjustment_type,'manual'),
     btrim(p_reason), v_exp_before, COALESCE(p_new_expires_at, v_exp_before), auth.uid());

  RETURN jsonb_build_object('success', true, 'sessions_before', v_pass.sessions_remaining, 'sessions_after', v_after);
END;
$$;

REVOKE ALL ON FUNCTION public.pt_adjust_pass_balance(uuid, integer, text, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_adjust_pass_balance(uuid, integer, text, text, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.pt_transfer_pass_sessions(
  p_from_pass_id uuid,
  p_to_pass_id uuid,
  p_sessions integer,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from public.pt_passes%ROWTYPE;
  v_to public.pt_passes%ROWTYPE;
BEGIN
  IF NOT public.pt_is_staff_or_desk(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF coalesce(p_sessions,0) <= 0 THEN RAISE EXCEPTION 'Sessions must be positive'; END IF;
  IF coalesce(btrim(p_reason), '') = '' THEN RAISE EXCEPTION 'A reason is required'; END IF;
  IF p_from_pass_id = p_to_pass_id THEN RAISE EXCEPTION 'Choose two different packages'; END IF;

  SELECT * INTO v_from FROM public.pt_passes WHERE id = p_from_pass_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Source package not found'; END IF;
  SELECT * INTO v_to FROM public.pt_passes WHERE id = p_to_pass_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Destination package not found'; END IF;
  IF v_from.sessions_remaining < p_sessions THEN RAISE EXCEPTION 'Not enough sessions to transfer'; END IF;

  UPDATE public.pt_passes
     SET sessions_remaining = sessions_remaining - p_sessions,
         status = CASE WHEN sessions_remaining - p_sessions = 0 AND status::text = 'active' THEN 'exhausted'::pt_pass_status ELSE status END,
         updated_at = now()
   WHERE id = p_from_pass_id;

  UPDATE public.pt_passes
     SET sessions_remaining = sessions_remaining + p_sessions,
         sessions_total = sessions_total + p_sessions,
         status = CASE WHEN status::text = 'exhausted' THEN 'active'::pt_pass_status ELSE status END,
         updated_at = now()
   WHERE id = p_to_pass_id;

  INSERT INTO public.pt_pass_adjustments
    (pass_id, user_id, delta_sessions, sessions_before, sessions_after, adjustment_type, reason,
     expires_at_before, expires_at_after, created_by, transfer_pass_id)
  VALUES
    (p_from_pass_id, v_from.user_id, -p_sessions, v_from.sessions_remaining, v_from.sessions_remaining - p_sessions,
     'transfer_out', btrim(p_reason), v_from.expires_at, v_from.expires_at, auth.uid(), p_to_pass_id),
    (p_to_pass_id, v_to.user_id, p_sessions, v_to.sessions_remaining, v_to.sessions_remaining + p_sessions,
     'transfer_in', btrim(p_reason), v_to.expires_at, v_to.expires_at, auth.uid(), p_from_pass_id);

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.pt_transfer_pass_sessions(uuid, uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_transfer_pass_sessions(uuid, uuid, integer, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.pt_log_renewal_reminder(p_pass_id uuid, p_note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_pass public.pt_passes%ROWTYPE;
BEGIN
  IF NOT public.pt_is_staff_or_desk(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT * INTO v_pass FROM public.pt_passes WHERE id = p_pass_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Package not found'; END IF;

  UPDATE public.pt_passes
     SET renewal_reminder_sent_at = now(),
         renewal_reminder_count = renewal_reminder_count + 1,
         updated_at = now()
   WHERE id = p_pass_id;

  INSERT INTO public.pt_tasks (title, detail, task_type, priority, due_at, client_user_id, assigned_to, created_by, status)
  VALUES (
    'Renewal follow-up: ' || v_pass.pack_name,
    COALESCE(p_note, 'Package expires ' || to_char(v_pass.expires_at, 'Mon DD, YYYY') || ' with ' || v_pass.sessions_remaining || ' sessions left.'),
    'renewal', 'high', now() + interval '2 days', v_pass.user_id, auth.uid(), auth.uid(), 'todo'
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.pt_log_renewal_reminder(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_log_renewal_reminder(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.pt_complete_task(p_task_id uuid, p_completed boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task public.pt_tasks%ROWTYPE;
  v_next timestamptz;
BEGIN
  IF NOT public.pt_is_staff_or_desk(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT * INTO v_task FROM public.pt_tasks WHERE id = p_task_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Task not found'; END IF;

  UPDATE public.pt_tasks
     SET completed_at = CASE WHEN p_completed THEN now() ELSE NULL END,
         status = CASE WHEN p_completed THEN 'done'::task_status ELSE 'todo'::task_status END,
         updated_at = now()
   WHERE id = p_task_id;

  IF p_completed AND v_task.recurrence IS NOT NULL AND v_task.recurrence <> 'none' AND v_task.completed_at IS NULL THEN
    v_next := COALESCE(v_task.due_at, now()) +
      CASE v_task.recurrence
        WHEN 'daily' THEN make_interval(days => GREATEST(1, v_task.recurrence_interval))
        WHEN 'weekly' THEN make_interval(weeks => GREATEST(1, v_task.recurrence_interval))
        WHEN 'monthly' THEN make_interval(months => GREATEST(1, v_task.recurrence_interval))
        ELSE make_interval(days => 1)
      END;

    IF v_task.recurrence_until IS NULL OR v_next::date <= v_task.recurrence_until THEN
      INSERT INTO public.pt_tasks
        (title, detail, task_type, priority, due_at, client_user_id, instructor_id, assigned_to,
         appointment_id, created_by, status, recurrence, recurrence_interval, recurrence_until, parent_task_id)
      VALUES
        (v_task.title, v_task.detail, v_task.task_type, v_task.priority, v_next, v_task.client_user_id,
         v_task.instructor_id, v_task.assigned_to, v_task.appointment_id, auth.uid(), 'todo',
         v_task.recurrence, v_task.recurrence_interval, v_task.recurrence_until, COALESCE(v_task.parent_task_id, v_task.id));
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.pt_complete_task(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_complete_task(uuid, boolean) TO authenticated;
