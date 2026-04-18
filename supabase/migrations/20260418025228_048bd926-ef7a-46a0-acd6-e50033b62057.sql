-- Create spa_intake_forms table
CREATE TABLE public.spa_intake_forms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID NOT NULL UNIQUE REFERENCES public.spa_appointments(id) ON DELETE CASCADE,
  member_id UUID,
  user_id UUID NOT NULL,
  focus_areas TEXT[] DEFAULT '{}',
  pressure_preference TEXT,
  pain_level INTEGER CHECK (pain_level >= 0 AND pain_level <= 10),
  pain_areas TEXT,
  health_conditions TEXT[] DEFAULT '{}',
  allergies TEXT,
  medications TEXT,
  goals TEXT,
  areas_to_avoid TEXT,
  prior_massage_experience TEXT,
  consent_signed BOOLEAN NOT NULL DEFAULT false,
  consent_signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_spa_intake_forms_appointment ON public.spa_intake_forms(appointment_id);
CREATE INDEX idx_spa_intake_forms_user ON public.spa_intake_forms(user_id);
CREATE INDEX idx_spa_intake_forms_member ON public.spa_intake_forms(member_id);

-- Enable RLS
ALTER TABLE public.spa_intake_forms ENABLE ROW LEVEL SECURITY;

-- Members manage their own forms
CREATE POLICY "Users can view their own intake forms"
ON public.spa_intake_forms FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own intake forms"
ON public.spa_intake_forms FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own intake forms"
ON public.spa_intake_forms FOR UPDATE
USING (auth.uid() = user_id);

-- Staff can view all
CREATE POLICY "Staff can view all intake forms"
ON public.spa_intake_forms FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'front_desk'::app_role) OR
  has_role(auth.uid(), 'spa_staff'::app_role)
);

-- Staff can insert (for booking on behalf of member)
CREATE POLICY "Staff can insert intake forms"
ON public.spa_intake_forms FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'front_desk'::app_role) OR
  has_role(auth.uid(), 'spa_staff'::app_role)
);

-- Spa staff and admins can update
CREATE POLICY "Staff can update intake forms"
ON public.spa_intake_forms FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'spa_staff'::app_role)
);

-- Auto-update timestamp trigger
CREATE TRIGGER update_spa_intake_forms_updated_at
BEFORE UPDATE ON public.spa_intake_forms
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Mark massage and wrap services as requiring intake
UPDATE public.spa_services
SET requires_intake_form = true
WHERE is_active = true
  AND (
    LOWER(category) LIKE '%massage%'
    OR LOWER(category) LIKE '%wrap%'
    OR LOWER(category) LIKE '%body%'
    OR LOWER(name) LIKE '%massage%'
    OR LOWER(name) LIKE '%wrap%'
  );