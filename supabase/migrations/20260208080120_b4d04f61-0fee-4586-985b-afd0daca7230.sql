-- Create kids care interest waitlist table for soft launch
CREATE TABLE public.kids_care_interest_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  children_count INTEGER DEFAULT 1,
  children_ages TEXT,
  notes TEXT,
  status TEXT DEFAULT 'waiting',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.kids_care_interest_waitlist ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert (public interest form)
CREATE POLICY "Anyone can join interest waitlist"
ON public.kids_care_interest_waitlist
FOR INSERT
WITH CHECK (true);

-- Policy: Users can view their own entries
CREATE POLICY "Users can view their own interest entries"
ON public.kids_care_interest_waitlist
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Admins can view all entries
CREATE POLICY "Admins can view all interest entries"
ON public.kids_care_interest_waitlist
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'super_admin', 'manager')
  )
);

-- Policy: Admins can update entries
CREATE POLICY "Admins can update interest entries"
ON public.kids_care_interest_waitlist
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'super_admin', 'manager')
  )
);

-- Add updated_at trigger
CREATE TRIGGER update_kids_care_interest_waitlist_updated_at
BEFORE UPDATE ON public.kids_care_interest_waitlist
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();