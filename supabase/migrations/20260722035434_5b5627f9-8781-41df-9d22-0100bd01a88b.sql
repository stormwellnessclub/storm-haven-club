
-- 1. Add new columns
ALTER TABLE public.class_pricing
  ADD COLUMN IF NOT EXISTS audience TEXT,
  ADD COLUMN IF NOT EXISTS label TEXT,
  ADD COLUMN IF NOT EXISTS price_cents INTEGER,
  ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;

-- 2. Drop old unique constraint (will be recreated to include audience)
ALTER TABLE public.class_pricing
  DROP CONSTRAINT IF EXISTS class_pricing_category_pass_type_key;

-- 3. Wipe and reseed with 8 rows (safe: no code reads this table yet)
DELETE FROM public.class_pricing;

INSERT INTO public.class_pricing (category, pass_type, audience, label, price_cents, stripe_price_id, member_price, non_member_price, is_active)
VALUES
  ('pilates_cycling', 'single',  'member',     'Single Class',    2500,  'price_1SlA2vLyZrsSqLhsBHHWlQPD', 25,  30,  true),
  ('pilates_cycling', 'single',  'non_member', 'Single Class',    3000,  'price_1T2XzALyZrsSqLhs1N07i160', 25,  30,  true),
  ('pilates_cycling', '10_pack', 'member',     '10 Class Pack',  17000,  'price_1SlA9sLyZrsSqLhsM0X8VDhN', 170, 285, true),
  ('pilates_cycling', '10_pack', 'non_member', '10 Class Pack',  28500,  'price_1T2XzfLyZrsSqLhsd8Gu4c7B', 170, 285, true),
  ('other',           'single',  'member',     'Single Class',    2000,  'price_1T2XmKLyZrsSqLhsmtaMSUiF', 20,  30,  true),
  ('other',           'single',  'non_member', 'Single Class',    3000,  'price_1SlABFLyZrsSqLhsGOpvWGFE', 20,  30,  true),
  ('other',           '10_pack', 'member',     '10 Class Pack',  15000,  'price_1T2YiALyZrsSqLhsuJGaqAaK', 150, 180, true),
  ('other',           '10_pack', 'non_member', '10 Class Pack',  18000,  'price_1T2XoiLyZrsSqLhsjN7Hb2Lk', 150, 180, true);

-- 4. Enforce non-null and unique on the new structure
ALTER TABLE public.class_pricing
  ALTER COLUMN audience SET NOT NULL,
  ALTER COLUMN label SET NOT NULL,
  ALTER COLUMN price_cents SET NOT NULL,
  ALTER COLUMN stripe_price_id SET NOT NULL,
  ADD CONSTRAINT class_pricing_audience_check CHECK (audience IN ('member', 'non_member')),
  ADD CONSTRAINT class_pricing_category_pass_type_audience_key UNIQUE (category, pass_type, audience);

-- 5. Drop legacy dollar columns
ALTER TABLE public.class_pricing
  DROP COLUMN member_price,
  DROP COLUMN non_member_price;

-- 6. Grants: anon can read for the public pricing page; authenticated for members; admins write.
GRANT SELECT ON public.class_pricing TO anon;
GRANT SELECT ON public.class_pricing TO authenticated;
GRANT ALL ON public.class_pricing TO service_role;
