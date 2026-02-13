
-- Create cafe_menu_items table for persistent cafe/juice bar items
CREATE TABLE public.cafe_menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_name text NOT NULL,
  flavor text NOT NULL,
  price numeric NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.cafe_menu_items ENABLE ROW LEVEL SECURITY;

-- Staff can view active items
CREATE POLICY "Staff can view cafe menu items"
ON public.cafe_menu_items
FOR SELECT
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'front_desk'::app_role]));

-- Staff can insert new items
CREATE POLICY "Staff can insert cafe menu items"
ON public.cafe_menu_items
FOR INSERT
WITH CHECK (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'front_desk'::app_role]));

-- Staff can update items (e.g. deactivate)
CREATE POLICY "Staff can update cafe menu items"
ON public.cafe_menu_items
FOR UPDATE
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'front_desk'::app_role]));
