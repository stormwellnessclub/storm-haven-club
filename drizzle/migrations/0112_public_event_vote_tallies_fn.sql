CREATE OR REPLACE FUNCTION public.get_event_vote_tallies(_event_slug text)
RETURNS TABLE(option_key text, vote_count integer, total_votes integer, percentage numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT option_key,
    count(*)::integer,
    (sum(count(*)) OVER ())::integer,
    round(100.0 * count(*) / NULLIF(sum(count(*)) OVER (), 0), 1)
  FROM public.event_votes
  WHERE event_slug = _event_slug
  GROUP BY option_key;
$$;
REVOKE ALL ON FUNCTION public.get_event_vote_tallies(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_event_vote_tallies(text) TO anon, authenticated, service_role;