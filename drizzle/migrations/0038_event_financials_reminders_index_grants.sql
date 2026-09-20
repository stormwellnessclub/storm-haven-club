CREATE INDEX IF NOT EXISTS event_invoices_due_date_open_idx
  ON public.event_invoices(due_date)
  WHERE status NOT IN ('paid','void','refunded');

GRANT EXECUTE ON FUNCTION public.mark_overdue_event_invoices() TO service_role;
