
-- Email campaigns table
CREATE TABLE public.email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_name text NOT NULL,
  campaign_type text NOT NULL CHECK (campaign_type IN ('guest', 'member')),
  audience_filter jsonb DEFAULT '{}'::jsonb,
  template_id uuid,
  subject text NOT NULL,
  body_html text NOT NULL,
  sent_count integer DEFAULT 0,
  created_by uuid,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage campaigns" ON public.email_campaigns
  FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['super_admin', 'admin']::app_role[]));

CREATE POLICY "Managers can view campaigns" ON public.email_campaigns
  FOR SELECT TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['manager']::app_role[]));

-- Email campaign recipients table
CREATE TABLE public.email_campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  email text NOT NULL,
  recipient_name text,
  recipient_type text NOT NULL CHECK (recipient_type IN ('guest', 'member')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_campaign_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage recipients" ON public.email_campaign_recipients
  FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['super_admin', 'admin']::app_role[]));

CREATE POLICY "Managers can view recipients" ON public.email_campaign_recipients
  FOR SELECT TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['manager']::app_role[]));

-- Email templates table
CREATE TABLE public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('guest_outreach', 'member_promo', 'feedback_request', 'announcement', 'seasonal', 'referral')),
  subject text NOT NULL,
  body_html text NOT NULL,
  merge_fields text[] DEFAULT ARRAY[]::text[],
  is_system boolean DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage templates" ON public.email_templates
  FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['super_admin', 'admin']::app_role[]));

CREATE POLICY "Managers can view templates" ON public.email_templates
  FOR SELECT TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['manager']::app_role[]));

-- Guest feedback table
CREATE TABLE public.guest_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_pass_id uuid REFERENCES public.guest_passes(id),
  guest_email text,
  guest_name text,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  feedback_token text NOT NULL UNIQUE,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.guest_feedback ENABLE ROW LEVEL SECURITY;

-- Allow anonymous/public inserts (token validated in code)
CREATE POLICY "Anyone can submit feedback with token" ON public.guest_feedback
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Staff can view all feedback
CREATE POLICY "Staff can view feedback" ON public.guest_feedback
  FOR SELECT TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager']::app_role[]));

-- Seed default templates
INSERT INTO public.email_templates (name, category, subject, body_html, merge_fields, is_system) VALUES
(
  'Guest Feedback Request',
  'feedback_request',
  'How Was Your Visit to Storm Wellness Club?',
  '<h2>Dear {name},</h2><p>Thank you for visiting Storm Wellness Club{visitDate}. We hope you enjoyed your time with us.</p><p>We''d love to hear about your experience. Please take a moment to share your thoughts:</p><p style="text-align:center"><a href="{feedbackUrl}" style="display:inline-block;background:#1C170F;color:#DEDACE;padding:14px 32px;text-decoration:none;border-radius:4px;font-weight:600;">Share Your Feedback</a></p><p>Your feedback helps us continue to elevate the experience for everyone.</p>',
  ARRAY['name', 'visitDate', 'feedbackUrl'],
  true
),
(
  'Member Welcome Promo',
  'member_promo',
  'A Special Offer Just for You, {name}',
  '<h2>Dear {name},</h2><p>As a valued {membershipTier} member, we wanted to share something special with you.</p><p>Enjoy exclusive access to our latest wellness offerings and member-only events.</p><p style="text-align:center"><a href="https://stormwellnessclub.com/member" style="display:inline-block;background:#1C170F;color:#DEDACE;padding:14px 32px;text-decoration:none;border-radius:4px;font-weight:600;">Visit Your Portal</a></p>',
  ARRAY['name', 'membershipTier'],
  true
),
(
  'Re-engagement Campaign',
  'guest_outreach',
  'We Miss You at Storm Wellness Club',
  '<h2>Dear {name},</h2><p>It''s been a while since your last visit to Storm Wellness Club. We''d love to welcome you back.</p><p>Book a guest pass and experience what''s new — from our latest classes to wellness treatments.</p><p style="text-align:center"><a href="https://stormwellnessclub.com/guest-pass" style="display:inline-block;background:#1C170F;color:#DEDACE;padding:14px 32px;text-decoration:none;border-radius:4px;font-weight:600;">Book a Visit</a></p>',
  ARRAY['name'],
  true
),
(
  'Referral Incentive',
  'referral',
  '{name}, Share the Storm Experience',
  '<h2>Dear {name},</h2><p>Love your experience at Storm Wellness Club? Share it with a friend!</p><p>Invite someone special for a complimentary guest visit. When they join as a member, you''ll both enjoy exclusive perks.</p><p style="text-align:center"><a href="https://stormwellnessclub.com/guest-pass" style="display:inline-block;background:#1C170F;color:#DEDACE;padding:14px 32px;text-decoration:none;border-radius:4px;font-weight:600;">Send an Invitation</a></p>',
  ARRAY['name'],
  true
),
(
  'General Announcement',
  'announcement',
  '{clubName} — Important Update',
  '<h2>Dear {name},</h2><p>We have an exciting update to share with you about {clubName}.</p><p>[Your announcement content here]</p>',
  ARRAY['name', 'clubName'],
  true
);
