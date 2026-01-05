-- Member Notes Table
-- Internal notes for staff to track member interactions and preferences

CREATE TABLE public.member_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  note_text TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT true, -- All notes are internal for now
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Member Tags Table
-- Tags for categorizing members (VIP, Preferred Contact Method, etc.)

CREATE TABLE public.member_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(member_id, tag)
);

-- Enable Row Level Security
ALTER TABLE public.member_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_tags ENABLE ROW LEVEL SECURITY;

-- Member Notes Policies
-- Staff only - members cannot view notes
CREATE POLICY "Staff can view member notes"
ON public.member_notes
FOR SELECT
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'front_desk'::app_role]));

CREATE POLICY "Staff can create member notes"
ON public.member_notes
FOR INSERT
WITH CHECK (
  has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'front_desk'::app_role])
  AND created_by = auth.uid()
);

CREATE POLICY "Staff can update member notes"
ON public.member_notes
FOR UPDATE
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'front_desk'::app_role]));

CREATE POLICY "Staff can delete member notes"
ON public.member_notes
FOR DELETE
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role]));

-- Member Tags Policies
-- Staff only - members cannot view tags
CREATE POLICY "Staff can view member tags"
ON public.member_tags
FOR SELECT
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'front_desk'::app_role]));

CREATE POLICY "Staff can create member tags"
ON public.member_tags
FOR INSERT
WITH CHECK (
  has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'front_desk'::app_role])
  AND created_by = auth.uid()
);

CREATE POLICY "Staff can delete member tags"
ON public.member_tags
FOR DELETE
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role]));

-- Create indexes
CREATE INDEX idx_member_notes_member_id ON public.member_notes(member_id);
CREATE INDEX idx_member_notes_created_at ON public.member_notes(created_at DESC);
CREATE INDEX idx_member_tags_member_id ON public.member_tags(member_id);
CREATE INDEX idx_member_tags_tag ON public.member_tags(tag);

-- Trigger for updated_at on member_notes
CREATE TRIGGER update_member_notes_updated_at
BEFORE UPDATE ON public.member_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();



