
-- Merch Products table
CREATE TABLE public.merch_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price numeric NOT NULL,
  image_urls text[] DEFAULT '{}',
  sizes text[] DEFAULT '{}',
  colors text[] DEFAULT '{}',
  category text DEFAULT 'General',
  is_active boolean DEFAULT true,
  allow_preorder boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Merch Inventory table
CREATE TABLE public.merch_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.merch_products(id) ON DELETE CASCADE NOT NULL,
  size text NOT NULL,
  color text NOT NULL,
  quantity integer DEFAULT 0,
  UNIQUE(product_id, size, color)
);

-- Merch Orders table
CREATE TABLE public.merch_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  customer_name text,
  customer_email text,
  customer_phone text,
  order_items jsonb NOT NULL DEFAULT '[]',
  total_amount numeric NOT NULL DEFAULT 0,
  payment_method text DEFAULT 'card',
  status text DEFAULT 'pending',
  is_preorder boolean DEFAULT false,
  member_id uuid REFERENCES public.members(id),
  stripe_payment_intent_id text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Storage bucket for merch images
INSERT INTO storage.buckets (id, name, public) VALUES ('merch-images', 'merch-images', true);

-- RLS on merch_products
ALTER TABLE public.merch_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active merch products" ON public.merch_products
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage merch products" ON public.merch_products
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager']::app_role[]));

-- RLS on merch_inventory
ALTER TABLE public.merch_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view merch inventory" ON public.merch_inventory
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage merch inventory" ON public.merch_inventory
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager']::app_role[]));

-- RLS on merch_orders
ALTER TABLE public.merch_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own merch orders" ON public.merch_orders
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all merch orders" ON public.merch_orders
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager', 'front_desk']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager', 'front_desk']::app_role[]));

CREATE POLICY "Anyone can create merch orders" ON public.merch_orders
  FOR INSERT WITH CHECK (true);

-- Storage RLS for merch-images
CREATE POLICY "Public can view merch images" ON storage.objects
  FOR SELECT USING (bucket_id = 'merch-images');

CREATE POLICY "Admins can upload merch images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'merch-images' AND public.has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager']::app_role[]));

CREATE POLICY "Admins can update merch images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'merch-images' AND public.has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager']::app_role[]));

CREATE POLICY "Admins can delete merch images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'merch-images' AND public.has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager']::app_role[]));
