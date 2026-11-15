CREATE OR REPLACE FUNCTION public.pt_my_portal()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN auth.uid() IS NULL THEN NULL ELSE jsonb_build_object(
    'trainer', (
      SELECT jsonb_build_object('name', trim(coalesce(i.first_name,'') || ' ' || coalesce(i.last_name,'')))
      FROM pt_client_trainers ct JOIN instructors i ON i.id = ct.instructor_id
      WHERE ct.client_user_id = auth.uid() AND ct.ended_at IS NULL
      ORDER BY (ct.relationship = 'primary') DESC, ct.assigned_at DESC LIMIT 1),
    'appointments', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', a.id, 'starts_at', a.starts_at, 'ends_at', a.ends_at, 'duration_minutes', a.duration_minutes,
        'status', a.status, 'format', a.format,
        'session_type', st.name,
        'trainer', trim(coalesce(i.first_name,'') || ' ' || coalesce(i.last_name,''))
      ) ORDER BY a.starts_at DESC)
      FROM pt_appointments a
      LEFT JOIN instructors i ON i.id = a.instructor_id
      LEFT JOIN pt_session_types st ON st.id = a.session_type_id
      WHERE a.user_id = auth.uid() AND coalesce(a.is_waitlist, false) = false), '[]'::jsonb),
    'passes', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'pack_name', p.pack_name, 'format', p.format, 'status', p.status,
        'sessions_total', p.sessions_total, 'sessions_remaining', p.sessions_remaining,
        'activated_at', p.activated_at, 'expires_at', p.expires_at, 'purchased_at', coalesce(p.purchased_at, p.created_at),
        'price_cents', coalesce(p.plan_total_cents, p.price_cents_charged),
        'amount_paid_cents', p.amount_paid_cents, 'amount_outstanding_cents', p.amount_outstanding_cents,
        'plan_name', p.payment_plan_name_snapshot, 'plan_status', p.payment_plan_status,
        'next_payment_date', p.payment_plan_next_payment_date
      ) ORDER BY coalesce(p.purchased_at, p.created_at) DESC)
      FROM pt_passes p
      WHERE p.user_id = auth.uid() AND p.status IN ('active','exhausted','expired')), '[]'::jsonb),
    'installments', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', x.id, 'pass_id', x.pass_id, 'installment_number', x.installment_number,
        'due_date', x.due_date, 'amount_cents', x.amount_cents, 'status', x.status,
        'paid_at', x.paid_at, 'card_brand', x.payment_method_brand, 'card_last4', x.payment_method_last4
      ) ORDER BY x.due_date, x.installment_number)
      FROM pt_payment_plan_installments x WHERE x.user_id = auth.uid()), '[]'::jsonb),
    'payments', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', pm.id, 'amount_cents', pm.amount_cents, 'refunded_cents', pm.refunded_cents,
        'method', pm.method, 'status', pm.status, 'paid_at', coalesce(pm.paid_at, pm.created_at),
        'payment_type', pm.payment_type
      ) ORDER BY coalesce(pm.paid_at, pm.created_at) DESC)
      FROM pt_payments pm WHERE pm.user_id = auth.uid()), '[]'::jsonb),
    'refunds', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', r.id, 'amount_cents', r.amount_cents, 'refunded_at', r.refunded_at)
        ORDER BY r.refunded_at DESC)
      FROM pt_refunds r WHERE r.user_id = auth.uid()), '[]'::jsonb),
    'programs', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name, 'status', g.status,
        'start_date', g.start_date, 'length_weeks', g.length_weeks, 'sessions_per_week', g.sessions_per_week)
        ORDER BY g.start_date DESC NULLS LAST)
      FROM pt_programs g WHERE g.user_id = auth.uid() AND coalesce(g.is_template, false) = false), '[]'::jsonb)
  ) END;
$$;

REVOKE ALL ON FUNCTION public.pt_my_portal() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_my_portal() TO authenticated;