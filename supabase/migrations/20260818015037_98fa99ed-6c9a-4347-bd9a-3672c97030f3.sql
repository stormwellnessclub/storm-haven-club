DELETE FROM public.application_submit_attempts WHERE client_key IS NULL;
DROP INDEX IF EXISTS public.idx_application_submit_attempts_client_key;
ALTER TABLE public.application_submit_attempts ALTER COLUMN client_key SET NOT NULL;
CREATE UNIQUE INDEX idx_application_submit_attempts_client_key ON public.application_submit_attempts (client_key);