ALTER TABLE public.membership_applications 
ADD COLUMN IF NOT EXISTS skip_tour_activate_immediately boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS liability_waiver_signed boolean DEFAULT false;