-- Phase 1 Membership Activation System
-- Adds founding member perks tracking, tier change tracking, card sync failure logging, and duplicate prevention

-- =====================================================
-- PART 1: Founding Member Perks Tracking
-- =====================================================

-- Add founding privileges tracking columns to members table
ALTER TABLE public.members
ADD COLUMN IF NOT EXISTS founding_privileges_granted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS founding_privileges_granted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS founding_perks_delivered_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS founding_sweater_size TEXT,
ADD COLUMN IF NOT EXISTS founding_bag_size TEXT;

-- =====================================================
-- PART 2: One-Time Tier Change Tracking
-- =====================================================

-- Add tier change tracking columns
ALTER TABLE public.members
ADD COLUMN IF NOT EXISTS tier_change_used BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS tier_change_used_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS original_tier_at_application TEXT;

-- =====================================================
-- PART 3: Member Perk Deliveries Table
-- =====================================================

CREATE TABLE IF NOT EXISTS public.member_perk_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES public.members(id) ON DELETE CASCADE,
  perk_type TEXT NOT NULL,
  perk_variant TEXT,
  size TEXT,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on member_perk_deliveries
ALTER TABLE public.member_perk_deliveries ENABLE ROW LEVEL SECURITY;

-- Admin can manage all perk deliveries
CREATE POLICY "Admins can manage perk deliveries"
ON public.member_perk_deliveries
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'admin', 'manager')
  )
);

-- Members can view their own perk deliveries
CREATE POLICY "Members can view own perk deliveries"
ON public.member_perk_deliveries
FOR SELECT
USING (
  member_id IN (
    SELECT id FROM public.members WHERE user_id = auth.uid()
  )
);

-- =====================================================
-- PART 4: Card Sync Failures Table (CRITICAL)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.card_sync_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  stripe_customer_id TEXT,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on card_sync_failures
ALTER TABLE public.card_sync_failures ENABLE ROW LEVEL SECURITY;

-- Only admins can view/manage card sync failures
CREATE POLICY "Admins can manage card sync failures"
ON public.card_sync_failures
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'admin', 'manager')
  )
);

-- =====================================================
-- PART 5: Duplicate Prevention Constraints
-- =====================================================

-- Note: These are partial indexes to prevent duplicates while allowing historical/rejected records

-- Create index for faster email lookups (case-insensitive)
CREATE INDEX IF NOT EXISTS idx_members_email_lower ON public.members (LOWER(email));

-- Create index for faster application email lookups
CREATE INDEX IF NOT EXISTS idx_applications_email_lower ON public.membership_applications (LOWER(email));

-- =====================================================
-- PART 6: Updated at trigger for perk deliveries
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_member_perk_deliveries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_member_perk_deliveries_updated_at ON public.member_perk_deliveries;

CREATE TRIGGER trigger_update_member_perk_deliveries_updated_at
BEFORE UPDATE ON public.member_perk_deliveries
FOR EACH ROW
EXECUTE FUNCTION public.update_member_perk_deliveries_updated_at();