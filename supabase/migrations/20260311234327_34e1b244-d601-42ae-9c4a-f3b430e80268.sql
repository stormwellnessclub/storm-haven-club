
-- Create enums
CREATE TYPE public.marketing_source AS ENUM ('import', 'guest_pass', 'application', 'member', 'manual');
CREATE TYPE public.sequence_trigger AS ENUM ('guest_visit', 'membership_activated', 'dormant_14d', 'dormant_30d', 'membership_anniversary', 'post_class', 'churn_risk', 'manual');
CREATE TYPE public.sequence_channel AS ENUM ('email', 'sms', 'both');
CREATE TYPE public.enrollment_status AS ENUM ('active', 'completed', 'cancelled', 'paused');
CREATE TYPE public.sms_status AS ENUM ('queued', 'sent', 'failed', 'delivered', 'undelivered');

-- marketing_contacts
CREATE TABLE public.marketing_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  phone TEXT,
  first_name TEXT,
  last_name TEXT,
  source marketing_source NOT NULL DEFAULT 'manual',
  segment_tags TEXT[] DEFAULT '{}',
  opted_in_sms BOOLEAN DEFAULT false,
  opted_in_email BOOLEAN DEFAULT true,
  linked_member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_marketing_contacts_email ON public.marketing_contacts(LOWER(email)) WHERE email IS NOT NULL;

ALTER TABLE public.marketing_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage marketing contacts"
  ON public.marketing_contacts FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]));

-- marketing_sequences
CREATE TABLE public.marketing_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  trigger_type sequence_trigger NOT NULL,
  channel sequence_channel NOT NULL DEFAULT 'both',
  steps JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage sequences"
  ON public.marketing_sequences FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]));

-- marketing_sequence_enrollments
CREATE TABLE public.marketing_sequence_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.marketing_contacts(id) ON DELETE CASCADE,
  sequence_id UUID NOT NULL REFERENCES public.marketing_sequences(id) ON DELETE CASCADE,
  current_step INTEGER NOT NULL DEFAULT 0,
  status enrollment_status NOT NULL DEFAULT 'active',
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  next_step_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_sequence_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage enrollments"
  ON public.marketing_sequence_enrollments FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]));

-- sms_messages
CREATE TABLE public.sms_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES public.marketing_contacts(id) ON DELETE SET NULL,
  phone TEXT NOT NULL,
  message_body TEXT NOT NULL,
  status sms_status NOT NULL DEFAULT 'queued',
  campaign_id UUID REFERENCES public.email_campaigns(id) ON DELETE SET NULL,
  twilio_sid TEXT,
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sms_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage sms messages"
  ON public.sms_messages FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]));

-- Enable realtime for sms_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.sms_messages;
