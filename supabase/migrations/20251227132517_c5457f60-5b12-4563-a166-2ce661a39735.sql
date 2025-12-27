-- Create members table for storing member information
CREATE TABLE public.members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  member_id text UNIQUE NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  phone text,
  membership_type text NOT NULL DEFAULT 'Standard',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'frozen', 'expired', 'cancelled')),
  membership_start_date date NOT NULL DEFAULT CURRENT_DATE,
  membership_end_date date,
  photo_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create check_ins table for tracking member visits
CREATE TABLE public.check_ins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid REFERENCES public.members(id) ON DELETE CASCADE NOT NULL,
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  checked_out_at timestamptz,
  checked_in_by uuid REFERENCES auth.users(id),
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;

-- RLS: Staff can view all members
CREATE POLICY "Staff can view all members"
ON public.members
FOR SELECT
TO authenticated
USING (
  has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager', 'front_desk']::app_role[])
);

-- RLS: Admins can manage members
CREATE POLICY "Admins can insert members"
ON public.members
FOR INSERT
TO authenticated
WITH CHECK (
  has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager']::app_role[])
);

CREATE POLICY "Admins can update members"
ON public.members
FOR UPDATE
TO authenticated
USING (
  has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager']::app_role[])
);

CREATE POLICY "Admins can delete members"
ON public.members
FOR DELETE
TO authenticated
USING (
  has_any_role(auth.uid(), ARRAY['super_admin', 'admin']::app_role[])
);

-- RLS: Staff can view check-ins
CREATE POLICY "Staff can view check_ins"
ON public.check_ins
FOR SELECT
TO authenticated
USING (
  has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager', 'front_desk']::app_role[])
);

-- RLS: Front desk and above can create check-ins
CREATE POLICY "Staff can create check_ins"
ON public.check_ins
FOR INSERT
TO authenticated
WITH CHECK (
  has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager', 'front_desk']::app_role[])
);

-- RLS: Staff can update check-ins (for checkout)
CREATE POLICY "Staff can update check_ins"
ON public.check_ins
FOR UPDATE
TO authenticated
USING (
  has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager', 'front_desk']::app_role[])
);

-- Create indexes for performance
CREATE INDEX idx_members_member_id ON public.members(member_id);
CREATE INDEX idx_members_email ON public.members(email);
CREATE INDEX idx_members_status ON public.members(status);
CREATE INDEX idx_check_ins_member_id ON public.check_ins(member_id);
CREATE INDEX idx_check_ins_checked_in_at ON public.check_ins(checked_in_at);

-- Trigger for updated_at on members
CREATE TRIGGER update_members_updated_at
BEFORE UPDATE ON public.members
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Generate unique member IDs
CREATE OR REPLACE FUNCTION public.generate_member_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  next_num integer;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(member_id FROM 5) AS integer)), 0) + 1
  INTO next_num
  FROM public.members
  WHERE member_id LIKE 'STM-%';
  
  NEW.member_id := 'STM-' || LPAD(next_num::text, 6, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_member_id
BEFORE INSERT ON public.members
FOR EACH ROW
WHEN (NEW.member_id IS NULL OR NEW.member_id = '')
EXECUTE FUNCTION public.generate_member_id();