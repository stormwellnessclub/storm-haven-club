-- =====================================================
-- Migration 1: cafe_orders table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.cafe_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  order_items JSONB NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payment_method TEXT,
  payment_intent_id TEXT,
  estimated_ready_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE public.cafe_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own orders"
ON public.cafe_orders FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own orders"
ON public.cafe_orders FOR INSERT
WITH CHECK (auth.uid() = user_id OR auth.uid() IS NULL);

CREATE POLICY "Users can update their own pending orders"
ON public.cafe_orders FOR UPDATE
USING (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Staff can view all orders"
ON public.cafe_orders FOR SELECT
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'cafe_staff'::app_role]));

CREATE POLICY "Staff can manage all orders"
ON public.cafe_orders FOR ALL
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'cafe_staff'::app_role]));

CREATE TRIGGER update_cafe_orders_updated_at
  BEFORE UPDATE ON public.cafe_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_cafe_orders_user_id ON public.cafe_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_cafe_orders_member_id ON public.cafe_orders(member_id);
CREATE INDEX IF NOT EXISTS idx_cafe_orders_status ON public.cafe_orders(status);
CREATE INDEX IF NOT EXISTS idx_cafe_orders_created_at ON public.cafe_orders(created_at DESC);

COMMENT ON TABLE public.cafe_orders IS 'Stores cafe orders from members and guests.';