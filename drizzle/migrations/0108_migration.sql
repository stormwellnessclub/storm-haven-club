ALTER TABLE public.class_sessions ADD COLUMN IF NOT EXISTS instructor_overridden boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.protect_session_instructor_override()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.instructor_id IS DISTINCT FROM OLD.instructor_id THEN
    IF current_setting('app.session_reconcile', true) = 'on' THEN
      -- Nightly schedule sync: keep a sub/instructor staff set on this one class.
      IF OLD.instructor_overridden THEN
        NEW.instructor_id := OLD.instructor_id;
      END IF;
    ELSE
      -- Staff changed the instructor on this specific class.
      NEW.instructor_overridden := true;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_protect_session_instructor_override ON public.class_sessions;
CREATE TRIGGER trg_protect_session_instructor_override
BEFORE UPDATE ON public.class_sessions
FOR EACH ROW EXECUTE FUNCTION public.protect_session_instructor_override();

DO $$
DECLARE def text;
BEGIN
  SELECT pg_get_functiondef('public.reconcile_and_generate_class_sessions(date,integer)'::regprocedure) INTO def;
  IF position('app.session_reconcile' in def) = 0 THEN
    def := regexp_replace(def, 'BEGIN\s+IF auth\.role\(\)',
      E'BEGIN\n  PERFORM set_config(''app.session_reconcile'', ''on'', true);\n  IF auth.role()');
    IF position('app.session_reconcile' in def) = 0 THEN
      RAISE EXCEPTION 'could not patch reconcile function';
    END IF;
    EXECUTE def;
  END IF;
END $$;