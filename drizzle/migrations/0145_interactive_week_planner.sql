ALTER TABLE public.workout_plan_entries
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'training',
  ADD COLUMN IF NOT EXISTS activity_key text,
  ADD COLUMN IF NOT EXISTS start_time time,
  ADD COLUMN IF NOT EXISTS duration_min integer,
  ADD COLUMN IF NOT EXISTS reminder_offset_min integer,
  ADD COLUMN IF NOT EXISTS reminder_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS class_session_id uuid,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

UPDATE public.workout_plan_entries SET category = CASE
  WHEN label = 'Rest day' THEN 'rest'
  WHEN label = 'Class at the club' THEN 'class'
  WHEN label = 'Cardio / walk' THEN 'cardio'
  ELSE 'training' END
WHERE template_id IS NULL;

CREATE INDEX IF NOT EXISTS workout_plan_entries_reminder_idx ON public.workout_plan_entries (reminder_at) WHERE reminder_sent_at IS NULL AND reminder_at IS NOT NULL;

CREATE TABLE public.workout_day_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  check_date date NOT NULL,
  mood smallint,
  energy smallint,
  note text,
  habits jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, check_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_day_checkins TO authenticated;
GRANT ALL ON public.workout_day_checkins TO service_role;
ALTER TABLE public.workout_day_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own checkins" ON public.workout_day_checkins FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.workout_reminder_prefs (
  user_id uuid PRIMARY KEY,
  daily_summary boolean NOT NULL DEFAULT false,
  summary_time time NOT NULL DEFAULT '07:30',
  next_summary_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_reminder_prefs TO authenticated;
GRANT ALL ON public.workout_reminder_prefs TO service_role;
ALTER TABLE public.workout_reminder_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own reminder prefs" ON public.workout_reminder_prefs FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.workout_reminder_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  dedupe_key text NOT NULL UNIQUE,
  sent_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.workout_reminder_sends TO service_role;
ALTER TABLE public.workout_reminder_sends ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.arm_planner_reminder_timer()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE t timestamptz; u timestamp;
BEGIN
  PERFORM pg_advisory_xact_lock(7402917);
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'planner-reminder-next';
  SELECT min(x) INTO t FROM (
    SELECT min(reminder_at) x FROM public.workout_plan_entries
      WHERE reminder_at IS NOT NULL AND reminder_sent_at IS NULL AND status = 'planned' AND reminder_at > now() - interval '2 hours'
    UNION ALL
    SELECT min(next_summary_at) FROM public.workout_reminder_prefs WHERE daily_summary AND next_summary_at IS NOT NULL
  ) s;
  IF t IS NULL THEN RETURN; END IF;
  t := greatest(t, now() + interval '1 minute');
  u := t AT TIME ZONE 'UTC';
  PERFORM cron.schedule('planner-reminder-next',
    format('%s %s %s %s *', extract(minute from u)::int, extract(hour from u)::int, extract(day from u)::int, extract(month from u)::int),
    $job$select cron.unschedule('planner-reminder-next'); select net.http_post(url:='https://cqzmrdzwgsujgbjqpoxh.supabase.co/functions/v1/planner-reminders',headers:=jsonb_build_object('Content-Type','application/json','x-internal-token',public.internal_task_token()),body:='{}'::jsonb,timeout_milliseconds:=60000);$job$);
END $$;
REVOKE ALL ON FUNCTION public.arm_planner_reminder_timer() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.arm_planner_reminder_timer() TO service_role;

CREATE OR REPLACE FUNCTION public.trg_arm_planner_reminder()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM public.arm_planner_reminder_timer();
  RETURN NULL;
END $$;

CREATE TRIGGER arm_planner_reminder_entries
AFTER INSERT OR DELETE OR UPDATE OF reminder_at, status ON public.workout_plan_entries
FOR EACH STATEMENT EXECUTE FUNCTION public.trg_arm_planner_reminder();

CREATE TRIGGER arm_planner_reminder_prefs
AFTER INSERT OR DELETE OR UPDATE OF daily_summary, next_summary_at ON public.workout_reminder_prefs
FOR EACH STATEMENT EXECUTE FUNCTION public.trg_arm_planner_reminder();