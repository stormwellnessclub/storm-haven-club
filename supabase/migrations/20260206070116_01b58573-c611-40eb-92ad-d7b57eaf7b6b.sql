-- Create email audit log table for tracking all emails sent through the system
CREATE TABLE IF NOT EXISTS public.email_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_type TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  triggered_by UUID REFERENCES auth.users(id),
  trigger_source TEXT NOT NULL DEFAULT 'admin',
  sent_at TIMESTAMPTZ DEFAULT now(),
  template_data JSONB DEFAULT '{}'::jsonb,
  custom_content TEXT,
  subject TEXT,
  status TEXT NOT NULL DEFAULT 'sent',
  error_message TEXT,
  member_id UUID,
  application_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_audit_log ENABLE ROW LEVEL SECURITY;

-- Only authenticated users with admin/manager role can view email logs
CREATE POLICY "Staff can view email audit logs"
ON public.email_audit_log
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN ('admin', 'super_admin', 'manager')
  )
);

-- Only authenticated users with admin/manager role can insert email logs
CREATE POLICY "Staff can insert email audit logs"
ON public.email_audit_log
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN ('admin', 'super_admin', 'manager')
  )
);

-- Create index for common queries
CREATE INDEX IF NOT EXISTS idx_email_audit_log_recipient ON public.email_audit_log(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_audit_log_application ON public.email_audit_log(application_id);
CREATE INDEX IF NOT EXISTS idx_email_audit_log_type ON public.email_audit_log(email_type);
CREATE INDEX IF NOT EXISTS idx_email_audit_log_sent_at ON public.email_audit_log(sent_at DESC);