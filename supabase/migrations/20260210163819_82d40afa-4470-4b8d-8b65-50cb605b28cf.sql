
ALTER TABLE guest_passes ADD COLUMN IF NOT EXISTS guest_gender text;
ALTER TABLE guest_passes ADD COLUMN IF NOT EXISTS admin_notes text;
ALTER TABLE guest_passes ADD COLUMN IF NOT EXISTS checked_in_by uuid REFERENCES auth.users(id);
ALTER TABLE guest_passes ADD COLUMN IF NOT EXISTS no_show boolean DEFAULT false;
