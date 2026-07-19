CREATE OR REPLACE FUNCTION public.get_event_availability(_slug text)
RETURNS TABLE(capacity integer, sold integer, remaining integer, status text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _event_id uuid;
  _capacity int;
  _status text;
  _sold int;
BEGIN
  SELECT e.id, e.capacity, e.status
    INTO _event_id, _capacity, _status
  FROM public.events e
  WHERE e.slug = _slug;

  IF _event_id IS NULL THEN
    RETURN;
  END IF;

  SELECT COUNT(*)::int INTO _sold
  FROM public.event_tickets et
  WHERE et.event_id = _event_id
    AND (
      et.status = 'paid'
      OR (et.status = 'pending' AND et.created_at > now() - interval '15 minutes')
    );

  capacity := _capacity;
  sold := COALESCE(_sold, 0);
  remaining := GREATEST(_capacity - COALESCE(_sold, 0), 0);
  status := _status;
  RETURN NEXT;
END;
$function$;