ALTER TABLE public.cafe_menu_addons
  ADD COLUMN IF NOT EXISTS group_name text NOT NULL DEFAULT 'Add-ons',
  ADD COLUMN IF NOT EXISTS selection_type text NOT NULL DEFAULT 'multi',
  ADD COLUMN IF NOT EXISTS is_required boolean NOT NULL DEFAULT false;

ALTER TABLE public.cafe_menu_addons
  ADD CONSTRAINT cafe_menu_addons_selection_type_chk
  CHECK (selection_type IN ('single','multi'));