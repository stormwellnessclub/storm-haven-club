-- Application Status History Table for Audit Trail
-- Tracks all status changes to membership applications

CREATE TABLE public.application_status_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id UUID NOT NULL REFERENCES public.membership_applications(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.application_status_history ENABLE ROW LEVEL SECURITY;

-- Staff can view all status history
CREATE POLICY "Staff can view application status history"
ON public.application_status_history
FOR SELECT
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'front_desk'::app_role]));

-- Create index for faster lookups
CREATE INDEX idx_application_status_history_application_id ON public.application_status_history(application_id);
CREATE INDEX idx_application_status_history_created_at ON public.application_status_history(created_at DESC);

-- Function to log status changes
CREATE OR REPLACE FUNCTION public.log_application_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only log if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.application_status_history (
      application_id,
      old_status,
      new_status,
      changed_by,
      notes
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      auth.uid(),
      NULL
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger to automatically log status changes
CREATE TRIGGER application_status_change_log
AFTER UPDATE ON public.membership_applications
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.log_application_status_change();



