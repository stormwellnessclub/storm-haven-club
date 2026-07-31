CREATE TABLE public.cancellation_notice_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  subject text NOT NULL,
  body_html text NOT NULL,
  updated_by_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cancellation_notice_templates TO authenticated;
GRANT ALL ON public.cancellation_notice_templates TO service_role;

ALTER TABLE public.cancellation_notice_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage cancellation templates"
ON public.cancellation_notice_templates
FOR ALL
TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]));

CREATE TRIGGER update_cancellation_notice_templates_updated_at
BEFORE UPDATE ON public.cancellation_notice_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.cancellation_notice_templates (template_key, display_name, subject, body_html) VALUES
('membership_cancelled', 'Membership Cancellation Notice', 'Membership Cancellation Confirmation - Storm Wellness Club',
'<p>Dear {{name}},</p>
<p>This email confirms that your {{membershipTier}} membership at Storm Wellness Club has been cancelled.</p>
<p><strong>Effective Date: {{cancellationDate}}</strong></p>
<p>{{amountOwedBlock}}</p>
<p>We appreciate the time you spent as part of our community. Should you wish to rejoin in the future, we would be happy to welcome you back.</p>
<p>If you have any questions about your cancellation or would like to discuss your options, please don''t hesitate to reach out to us at <a href="mailto:admin@stormwellnessclub.com">admin@stormwellnessclub.com</a>.</p>
<p>{{extraMessage}}</p>
<p><em>Warmly,</em><br/><strong>Storm Wellness Club</strong></p>'),
('incomplete_membership_cancelled', 'Incomplete Membership Cancellation Notice', 'Membership Update - Storm Wellness Club',
'<p>Dear {{name}},</p>
<p>We''re writing to let you know that your membership setup at Storm Wellness Club was not completed and has been cancelled.</p>
<p>{{amountOwedBlock}}</p>
<p>If you have any questions, please don''t hesitate to email us at <a href="mailto:admin@stormwellnessclub.com">admin@stormwellnessclub.com</a>.</p>
<p>If you''d like to rejoin in the future, you would need to submit a new application.</p>
<p>{{extraMessage}}</p>
<p><em>Best regards,</em><br/><strong>Storm Wellness Club</strong></p>'),
('application_cancelled', 'Application Cancellation Notice', 'Application Update - Storm Wellness Club',
'<p>Dear {{name}},</p>
<p>We''re writing to let you know that your application to Storm Wellness Club has been cancelled.</p>
<p>If you''re interested in joining in the future, you''re welcome to reapply at any time.</p>
<p>If you have any questions, please feel free to reach out to us at <a href="mailto:admin@stormwellnessclub.com">admin@stormwellnessclub.com</a>.</p>
<p>{{extraMessage}}</p>
<p><em>Best regards,</em><br/><strong>Storm Wellness Club</strong></p>');