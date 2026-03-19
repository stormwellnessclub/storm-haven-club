
-- Create kids_care_hour_requests table
CREATE TABLE public.kids_care_hour_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  preferred_days TEXT[] NOT NULL DEFAULT '{}',
  preferred_start_time TIME,
  preferred_end_time TIME,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.kids_care_hour_requests ENABLE ROW LEVEL SECURITY;

-- Members can insert their own requests
CREATE POLICY "Users can insert own hour requests"
  ON public.kids_care_hour_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Members can read their own requests
CREATE POLICY "Users can read own hour requests"
  ON public.kids_care_hour_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Admins can read all requests
CREATE POLICY "Admins can read all hour requests"
  ON public.kids_care_hour_requests
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager']::app_role[]));

-- Admins can update request status
CREATE POLICY "Admins can update hour requests"
  ON public.kids_care_hour_requests
  FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager']::app_role[]));
