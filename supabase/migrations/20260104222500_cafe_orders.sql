-- =====================================================
-- TABLE: cafe_orders
-- =====================================================
CREATE TABLE public.cafe_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  order_items JSONB NOT NULL, -- [{item_id, name, price, quantity, category}]
  total_amount DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'preparing', 'ready', 'completed', 'cancelled'
  payment_method TEXT,
  payment_intent_id TEXT,
  estimated_ready_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.cafe_orders ENABLE ROW LEVEL SECURITY;

-- RLS: Users can view their own orders
CREATE POLICY "Users can view their own orders"
ON public.cafe_orders FOR SELECT
USING (auth.uid() = user_id);

-- RLS: Users can create their own orders
CREATE POLICY "Users can create their own orders"
ON public.cafe_orders FOR INSERT
WITH CHECK (auth.uid() = user_id OR auth.uid() IS NULL); -- Allow guest orders

-- RLS: Users can update their own pending orders
CREATE POLICY "Users can update their own pending orders"
ON public.cafe_orders FOR UPDATE
USING (auth.uid() = user_id AND status = 'pending');

-- RLS: Staff can view all orders
CREATE POLICY "Staff can view all orders"
ON public.cafe_orders FOR SELECT
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'cafe_staff'::app_role]));

-- RLS: Staff can manage all orders
CREATE POLICY "Staff can manage all orders"
ON public.cafe_orders FOR ALL
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'cafe_staff'::app_role]));

-- Create trigger for updated_at
CREATE TRIGGER update_cafe_orders_updated_at
  BEFORE UPDATE ON public.cafe_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_cafe_orders_user_id ON public.cafe_orders(user_id);
CREATE INDEX idx_cafe_orders_member_id ON public.cafe_orders(member_id);
CREATE INDEX idx_cafe_orders_status ON public.cafe_orders(status);
CREATE INDEX idx_cafe_orders_created_at ON public.cafe_orders(created_at DESC);

-- Add comment
COMMENT ON TABLE public.cafe_orders IS 'Stores cafe orders from members and guests. Supports both authenticated users and guest orders.';



