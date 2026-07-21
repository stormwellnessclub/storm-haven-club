import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Types that can be safely invoked without authentication (e.g., from the public
// application submission flow). All other types require a valid JWT or service-role key.
const PUBLIC_EMAIL_TYPES = new Set<string>([
  'application_submitted',
]);



async function authorizeRequest(req: Request, type: string): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  // Allow service-role key (used by other edge functions calling send-email).
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (token && serviceRoleKey && token === serviceRoleKey) {
    return { ok: true };
  }

  // Public email types are allowed without auth (e.g., application submission).
  if (PUBLIC_EMAIL_TYPES.has(type)) {
    return { ok: true };
  }

  // All other email types require a STAFF JWT. A plain authenticated member
  // must not be able to send official templates (approvals, dunning, etc.)
  // through this function — that would enable phishing via our domain.
  if (!token) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data, error } = await authClient.auth.getUser(token);
    if (error || !data?.user) {
      return { ok: false, status: 401, error: 'Unauthorized' };
    }
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roles } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', data.user.id);
    const STAFF_ROLES = new Set([
      'super_admin', 'admin', 'manager', 'front_desk',
      'cafe_staff', 'childcare_staff', 'spa_staff', 'class_instructor',
    ]);
    const isStaff = (roles ?? []).some((r: any) => STAFF_ROLES.has(r.role));
    if (!isStaff) {
      return { ok: false, status: 403, error: 'Staff role required' };
    }
    return { ok: true };
  } catch (_e) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }
}


interface EmailRequest {
  type: 'application_submitted' | 'approval_with_deadline' | 'approval_letter' | 'approval_letter_personalized' | 'application_rejected' | 'booking_confirmation' | 'booking_cancellation' | 'class_cancelled_by_admin' | 'waiver_reminder' | 'class_reminder' | 'waitlist_notification' | 'waitlist_claim_confirmation' | 'waitlist_joined' | 'spa_appointment_confirmation' | 'spa_appointment_reminder' | 'spa_appointment_cancellation' | 'activation_reminder_day3' | 'activation_reminder_day5' | 'membership_activated' | 'payment_update_request' | 'charge_confirmation' | 'application_approved_locked_date' | 'add_card_for_dues' | 'staff_reply' | 'payment_failed' | 'application_card_declined' | 'freeze_completed' | 'freeze_request_rejected' | 'freeze_payment_request' | 'annual_fee_payment_request' | 'annual_fee_final_notice' | 'setup_instructions' | 'member_activation_setup' | 'pwa_reinstall_instructions' | 'phase_one_setup' | 'waiver_reminder_email' | 'admin_payment_failed_alert' | 'membership_scheduled' | 'membership_cancelled' | 'application_cancelled' | 'incomplete_membership_cancelled' | 'guest_pass_promo' | 'guest_pass_credit_granted' | 'guest_visit_feedback' | 'guest_pass_purchase_confirmation' | 'soft_launch_hours' | 'staff_invite' | 'account_activation_invite' | 'payment_link_welcome' | 'referral_invite' | 'referral_notification' | 'spa_review_request' | 'dunning_day_0' | 'dunning_day_1' | 'dunning_day_3' | 'dunning_day_5' | 'dunning_day_7' | 'dunning_recovered' | 'upcoming_payment_reminder' | 'renewal_monthly_dues_3day' | 'renewal_annual_dues_14day' | 'renewal_annual_fee_14day' | 'renewal_annual_fee_3day' | 'past_due_formal_notice' | 'card_expiring';
  to: string;
  data: Record<string, any>;
}

const BASE_URL = Deno.env.get('APP_BASE_URL') ?? 'https://stormwellnessclub.com';

// Email template styling - Brand colors: Smoked Umber #1C170F, Limestone Haze #DEDACE, Still Sand #C1B19C, Golden Dune #F0DFC4, Gold Accent #B8A068
const emailStyles = {
  container: 'font-family: Georgia, "Times New Roman", Times, serif; max-width: 600px; margin: 0 auto; padding: 0;',
  header: 'background: #DEDACE; padding: 40px 30px; text-align: center;',
  content: 'background: #ffffff; padding: 30px; border-left: 1px solid #C1B19C; border-right: 1px solid #C1B19C;',
  footer: 'background: #1C170F; padding: 25px; text-align: center; color: #DEDACE;',
  button: 'display: inline-block; background: #1C170F; color: #DEDACE; padding: 14px 32px; text-decoration: none; border-radius: 4px; font-weight: 600; font-family: Georgia, serif; letter-spacing: 0.5px; margin: 10px 5px;',
  buttonSecondary: 'display: inline-block; background: #C1B19C; color: #1C170F; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: 500; font-family: Georgia, serif; margin: 10px 5px;',
  link: 'color: #6C5D3E; text-decoration: underline;',
  muted: 'color: #88766B; font-size: 14px; font-family: Georgia, serif;',
  heading: 'color: #1C170F; margin-top: 0; font-family: Georgia, serif; font-weight: 500;',
  // Brand accent boxes
  infoBox: 'background: #F0DFC4; border: 1px solid #C1B19C; border-radius: 8px; padding: 20px; margin: 25px 0;',
  warningBox: 'background: #F0DFC4; border: 2px solid #B8A068; border-radius: 8px; padding: 20px; margin: 25px 0;',
  successBox: 'background: #DEDACE; border: 1px solid #C1B19C; border-radius: 8px; padding: 20px; margin: 20px 0;',
};

const getEmailHeader = () => `
  <div style="${emailStyles.header}">
    <img src="${BASE_URL}/storm-logo-gold.png" alt="Storm Wellness Club" height="80" style="display: block; margin: 0 auto;" />
  </div>
  <div style="height: 4px; background: linear-gradient(90deg, #B8A068, #C1B19C, #B8A068);"></div>
`;

const getEmailFooter = () => `
  <div style="height: 1px; background: #C1B19C;"></div>
  <div style="${emailStyles.footer}">
    <p style="color: #B8A068; font-size: 14px; margin: 0 0 15px 0; font-family: Georgia, serif;">
      Have questions? Visit your member portal
    </p>
    <p style="margin: 0 0 15px 0;">
      <a href="${BASE_URL}/member/support" style="color: #DEDACE; text-decoration: none; margin: 0 10px;">Contact Support</a> · 
      <a href="${BASE_URL}/member/bookings" style="color: #DEDACE; text-decoration: none; margin: 0 10px;">Manage Bookings</a>
    </p>
    <p style="color: #88766B; font-size: 12px; margin: 15px 0 0 0; font-family: Georgia, serif;">
      Storm Wellness Club · <a href="${BASE_URL}" style="color: #88766B;">stormwellnessclub.com</a>
    </p>
  </div>
`;

// Minimal footer for receipts/applicant emails - no portal links
const getReceiptFooter = () => `
  <div style="${emailStyles.footer}">
    <p style="${emailStyles.muted}">
      Questions about this charge? Reply to this email or contact us.
    </p>
    <p style="${emailStyles.muted}">
      Storm Wellness Club
    </p>
  </div>
`;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  
  if (!resendApiKey) {
    console.error("RESEND_API_KEY is not configured");
    return new Response(
      JSON.stringify({ error: "Email service not configured" }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }

  const resend = new Resend(resendApiKey);

  try {
    const { type, to, data }: EmailRequest = await req.json();

    // Authorize: require service-role key or valid JWT, except for whitelisted public types
    const authz = await authorizeRequest(req, type);
    if (!authz.ok) {
      console.warn(`Unauthorized send-email request for type: ${type}`);
      return new Response(
        JSON.stringify({ error: authz.error }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: authz.status }
      );
    }

    console.log(`Processing email type: ${type} for: ${to}`);

    let subject = '';
    let html = '';

    switch (type) {
      case 'application_submitted':
        subject = 'We received your application — Storm Wellness Club';
        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            <div style="${emailStyles.content}">
              <h2 style="${emailStyles.heading}">Hi ${data.firstName || data.name},</h2>
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                Thank you for applying to Storm Wellness Club. We personally review every application — yours is in our hands now.
              </p>
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                You'll hear from us within 24–48 hours. If your application is approved, we'll reach out to schedule a private walkthrough so you can experience the club before your membership begins.
              </p>
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                In the meantime, feel free to explore what awaits you:
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${BASE_URL}/amenities" style="${emailStyles.button}">Our Amenities</a>
                <a href="${BASE_URL}/spa" style="${emailStyles.buttonSecondary}">Aella Spa</a>
                <a href="${BASE_URL}/classes" style="${emailStyles.buttonSecondary}">Class Schedule</a>
              </div>
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 5px;">
                Talk soon,
              </p>
              <p style="font-size: 16px; font-weight: 600; color: #1C170F; margin-bottom: 0;">
                The Storm Wellness Club Team
              </p>
            </div>
            ${getReceiptFooter()}
          </div>
        `;
        break;

      case 'approval_with_deadline':
        subject = 'Your Application to Storm Wellness Club is Approved';
        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            <div style="${emailStyles.content}">
              <h2 style="${emailStyles.heading}">Dear ${data.name},</h2>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                Your application to Storm Wellness Club is approved.
              </p>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                The way you choose to care for yourself matters. Storm Wellness Club was built for people who value intention, depth, and an environment that supports the whole person—physically, mentally, and through recovery.
              </p>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                Every element of Storm Wellness Club is designed with care and precision, so your time, energy, and well-being are respected the moment you step inside.
              </p>
              
              <div style="background: #F0DFC4; border: 1px solid #C1B19C; border-radius: 8px; padding: 20px; margin: 25px 0;">
                <p style="margin: 0; font-weight: 600; color: #1C170F; font-family: Georgia, serif;">
                  ⏰ Please sign in to your member portal within the next 7 days to select your membership start date.
                </p>
                <p style="margin: 10px 0 0 0; color: #6C5D3E; font-size: 14px; font-family: Georgia, serif;">
                  Your billing will begin on the date you choose. If no date is selected by <strong>${data.activationDeadline || 'the deadline'}</strong>, your membership will automatically begin on that date.
                </p>
              </div>
              
              <div style="background: #DEDACE; border: 1px solid #C1B19C; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <p style="margin: 0; font-size: 14px; color: #1C170F; font-family: Georgia, serif;">
                  <strong>📧 Important:</strong> When creating your member account, please use the same email address you applied with: <strong>${data.email || to}</strong>. This ensures your membership is automatically linked to your account.
                </p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${BASE_URL}/auth" style="${emailStyles.button}">Choose Your Start Date</a>
              </div>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                We look forward to welcoming you inside Storm Wellness Club.
              </p>
              
              <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="font-style: italic; color: #6b7280; margin-bottom: 5px;">Warmly,</p>
                <p style="font-weight: 600; color: #1f2937; margin: 0;">Storm</p>
                <p style="color: #6b7280; margin: 0;">Founder, Storm Wellness Club</p>
              </div>
            </div>
            ${getEmailFooter()}
          </div>
        `;
        break;

      case 'approval_letter':
        subject = 'Welcome to Storm Wellness Club - Application Approved!';
        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            <div style="${emailStyles.content}">
              <h2 style="${emailStyles.heading}">Dear ${data.name},</h2>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                We are delighted to inform you that your application to Storm Wellness Club has been approved.
              </p>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                The way you choose to care for yourself matters. Storm Wellness Club was built for people who value intention, depth, and an environment that supports the whole person—physically, mentally, and through recovery.
              </p>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                You will receive your member account activation details shortly. Once your account is set up, your personalized member portal will guide you through any remaining steps.
              </p>
              
              <div style="background: #DEDACE; border: 1px solid #C1B19C; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <p style="margin: 0; font-weight: 600; color: #1C170F; font-family: Georgia, serif;">
                  ✓ Your spot is secured as a <strong>${data.membershipTier}</strong> member.
                </p>
              </div>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                We look forward to seeing you at the club.
              </p>
              
              <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="font-style: italic; color: #6b7280; margin-bottom: 5px;">Warmly,</p>
                <p style="font-weight: 600; color: #1f2937; margin: 0;">The Storm Wellness Club Team</p>
              </div>
            </div>
            <div style="${emailStyles.footer}">
              <p style="${emailStyles.muted}">
                Storm Wellness Club
              </p>
            </div>
          </div>
        `;
        break;

      case 'application_rejected':
        subject = 'Application Update - Storm Wellness Club';
        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            <div style="${emailStyles.content}">
              <h2 style="${emailStyles.heading}">Dear ${data.name},</h2>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                Thank you for your interest in Storm Wellness Club. After careful review of your application, we are unable to proceed with your membership request at this time.
              </p>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                We appreciate you taking the time to apply, and we encourage you to explore our public services and facilities. We offer spa services, cafe amenities, and various wellness programs that are available without membership.
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${BASE_URL}/spa" style="${emailStyles.buttonSecondary}">Explore Our Spa</a>
                <a href="${BASE_URL}/cafe" style="${emailStyles.buttonSecondary}">Visit Our Cafe</a>
              </div>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                If you have any questions or would like to discuss this decision further, please don't hesitate to reach out to us.
              </p>
              
              <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="font-style: italic; color: #6b7280; margin-bottom: 5px;">Best regards,</p>
                <p style="font-weight: 600; color: #1f2937; margin: 0;">Storm Wellness Club</p>
                <p style="color: #6b7280; margin: 0;">
                  <a href="${BASE_URL}/member/support" style="${emailStyles.link}">Contact Support</a>
                </p>
              </div>
            </div>
            ${getEmailFooter()}
          </div>
        `;
        break;

      case 'activation_reminder_day3':
        subject = 'Choose Your Start Date at Storm Wellness Club';
        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            <div style="${emailStyles.content}">
              <h2 style="${emailStyles.heading}">Dear ${data.name},</h2>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                You're just a few steps away from beginning your Storm Wellness Club membership.
              </p>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                Sign in to your member portal to select your start date. You have <strong>4 days remaining</strong> to make your selection before your membership automatically begins.
              </p>
              
              <div style="background: #DEDACE; border: 1px solid #C1B19C; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <p style="margin: 0; font-size: 14px; color: #1C170F; font-family: Georgia, serif;">
                  <strong>📧 Important:</strong> When signing in or creating your account, please use the same email address you applied with: <strong>${data.email || to}</strong>.
                </p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${BASE_URL}/auth" style="${emailStyles.button}">Choose My Start Date</a>
              </div>
              
              <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="font-style: italic; color: #6b7280; margin-bottom: 5px;">Warmly,</p>
                <p style="font-weight: 600; color: #1f2937; margin: 0;">Storm Wellness Club</p>
              </div>
            </div>
            ${getEmailFooter()}
          </div>
        `;
        break;

      case 'activation_reminder_day5':
        subject = '2 Days Remaining to Choose Your Start Date';
        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            <div style="${emailStyles.content}">
              <h2 style="${emailStyles.heading}">Dear ${data.name},</h2>
              
              <div style="background: #F0DFC4; border: 2px solid #B8A068; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <p style="margin: 0; font-weight: 600; color: #1C170F; font-family: Georgia, serif;">
                  ⏰ Your membership activation window closes in 2 days.
                </p>
              </div>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px; font-family: Georgia, serif;">
                Please sign in to select your preferred start date. If no date is selected by <strong>${data.activationDeadline}</strong>, your membership will automatically begin on that date.
              </p>
              
              <div style="background: #DEDACE; border: 1px solid #C1B19C; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <p style="margin: 0; font-size: 14px; color: #1C170F; font-family: Georgia, serif;">
                  <strong>📧 Important:</strong> When signing in or creating your account, please use the same email address you applied with: <strong>${data.email || to}</strong>.
                </p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${BASE_URL}/auth" style="${emailStyles.button}">Choose My Start Date</a>
              </div>
              
              <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="font-style: italic; color: #6b7280; margin-bottom: 5px;">Warmly,</p>
                <p style="font-weight: 600; color: #1f2937; margin: 0;">Storm Wellness Club</p>
              </div>
            </div>
            ${getEmailFooter()}
          </div>
        `;
        break;

      case 'membership_activated':
        subject = 'Welcome to Storm Wellness Club - Membership Activated!';
        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            <div style="${emailStyles.content}">
              <h2 style="${emailStyles.heading}">Welcome, ${data.name}! 🎉</h2>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                Your membership is now active. We're thrilled to have you as part of the Storm Wellness Club community.
              </p>
              
              <div style="background: #DEDACE; border: 1px solid #C1B19C; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <table style="width: 100%; border-collapse: collapse; font-family: Georgia, serif;">
                  <tr>
                    <td style="padding: 8px 0; color: #88766B;">Membership Tier</td>
                    <td style="padding: 8px 0; font-weight: 600; color: #1C170F;">${data.membershipType}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #88766B;">Start Date</td>
                    <td style="padding: 8px 0; font-weight: 600; color: #1C170F;">${data.startDate}</td>
                  </tr>
                </table>
              </div>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                Here's what you can do next:
              </p>
              
              <ul style="color: #374151; line-height: 2;">
                <li>Browse and book classes in your member portal</li>
                <li>Complete your profile and sign your waivers</li>
                <li>Explore our amenities and spa services</li>
              </ul>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${BASE_URL}/member" style="${emailStyles.button}">Access Member Portal</a>
                <a href="${BASE_URL}/schedule" style="${emailStyles.buttonSecondary}">Book a Class</a>
              </div>
              
              <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="font-style: italic; color: #6b7280; margin-bottom: 5px;">Warmly,</p>
                <p style="font-weight: 600; color: #1f2937; margin: 0;">Storm</p>
                <p style="color: #6b7280; margin: 0;">Founder, Storm Wellness Club</p>
              </div>
            </div>
            ${getEmailFooter()}
          </div>
        `;
        break;

      case 'booking_confirmation':
        subject = `Booking Confirmed - ${data.className}`;
        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            <div style="${emailStyles.content}">
              <h2 style="${emailStyles.heading}">Booking Confirmed! ✓</h2>
              <p>You're all set for your upcoming class:</p>
              <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Class</td>
                    <td style="padding: 8px 0; font-weight: 600;">${data.className}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Date</td>
                    <td style="padding: 8px 0; font-weight: 600;">${data.date}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Time</td>
                    <td style="padding: 8px 0; font-weight: 600;">${data.time}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Instructor</td>
                    <td style="padding: 8px 0; font-weight: 600;">${data.instructor}</td>
                  </tr>
                  ${data.room ? `
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Room</td>
                    <td style="padding: 8px 0; font-weight: 600;">${data.room}</td>
                  </tr>
                  ` : ''}
                  ${data.remainingCreditsLabel ? `
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Credits</td>
                    <td style="padding: 8px 0; font-weight: 600;">${data.remainingCreditsLabel}</td>
                  </tr>
                  ` : ''}
                </table>
              </div>
              <div style="background: #FEF8E7; border-left: 3px solid #D4A84B; border-radius: 6px; padding: 14px 16px; margin: 20px 0;">
                <p style="margin: 0 0 4px 0; font-weight: 600; color: #1C170F; font-size: 14px;">Cancellation policy</p>
                <p style="margin: 0; color: #4B4537; font-size: 13px; line-height: 1.5;">Free cancellation up to 24 hours before class. Late cancellations forfeit your credit or pass.</p>
              </div>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${BASE_URL}/member/bookings" style="${emailStyles.button}">View My Bookings</a>
                <a href="${BASE_URL}/schedule" style="${emailStyles.buttonSecondary}">Browse Schedule</a>
              </div>
              <p style="${emailStyles.muted}">Need to cancel? <a href="${BASE_URL}/member/bookings" style="${emailStyles.link}">Manage your booking here</a></p>
            </div>
            ${getEmailFooter()}
          </div>
        `;
        break;

      case 'booking_cancellation':
        subject = `Booking Cancelled - ${data.className}`;
        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            <div style="${emailStyles.content}">
              <h2 style="${emailStyles.heading}">Booking Cancelled</h2>
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                Hi ${data.name || 'there'}, your class booking has been cancelled. Here are the details:
              </p>
              <div style="${emailStyles.warningBox}">
                <table style="width: 100%; border-collapse: collapse; font-family: Georgia, serif;">
                  <tr>
                    <td style="padding: 8px 0; color: #6C5D3E;">Class</td>
                    <td style="padding: 8px 0; font-weight: 600; color: #1C170F;">${data.className}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6C5D3E;">Date</td>
                    <td style="padding: 8px 0; font-weight: 600; color: #1C170F;">${data.date}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6C5D3E;">Time</td>
                    <td style="padding: 8px 0; font-weight: 600; color: #1C170F;">${data.time}</td>
                  </tr>
                </table>
              </div>
              ${data.creditRefunded
                ? `<div style="${emailStyles.successBox}">
                    <p style="margin: 0; font-family: Georgia, serif; color: #1C170F;">
                      ✓ Your class credit has been refunded to your account.
                    </p>
                  </div>`
                : `<div style="background: #FEF3C7; border: 1px solid #F59E0B; border-radius: 8px; padding: 16px; margin: 20px 0;">
                    <p style="margin: 0; font-family: Georgia, serif; color: #1C170F;">
                      ⚠ Because this was cancelled less than 24 hours before class, your credit has been forfeited per our cancellation policy.
                    </p>
                  </div>`
              }
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                We hope to see you in another class soon.
              </p>
              <div style="background: #FEF8E7; border-left: 3px solid #D4A84B; border-radius: 6px; padding: 14px 16px; margin: 20px 0;">
                <p style="margin: 0 0 4px 0; font-weight: 600; color: #1C170F; font-size: 14px;">Cancellation policy</p>
                <p style="margin: 0; color: #4B4537; font-size: 13px; line-height: 1.5;">Free cancellation up to 24 hours before class. Late cancellations forfeit your credit or pass.</p>
              </div>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${BASE_URL}/schedule" style="${emailStyles.button}">Book Another Class</a>
              </div>
            </div>
            ${getEmailFooter()}
          </div>
        `;
        break;

      case 'class_cancelled_by_admin':
        subject = `Class Cancelled - ${data.className}`;
        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            <div style="${emailStyles.content}">
              <h2 style="${emailStyles.heading}">Class Cancelled</h2>
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                Hi ${data.name}, we're sorry to let you know that the following class has been cancelled by the studio:
              </p>
              <div style="${emailStyles.warningBox}">
                <table style="width: 100%; border-collapse: collapse; font-family: Georgia, serif;">
                  <tr>
                    <td style="padding: 8px 0; color: #6C5D3E;">Class</td>
                    <td style="padding: 8px 0; font-weight: 600; color: #1C170F;">${data.className}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6C5D3E;">Date</td>
                    <td style="padding: 8px 0; font-weight: 600; color: #1C170F;">${data.date}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6C5D3E;">Time</td>
                    <td style="padding: 8px 0; font-weight: 600; color: #1C170F;">${data.time}</td>
                  </tr>
                </table>
              </div>
              <div style="${emailStyles.successBox}">
                <p style="margin: 0; font-family: Georgia, serif; color: #1C170F;">
                  ✓ Your class credit has been automatically refunded to your account.
                </p>
              </div>
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                We apologize for the inconvenience. You're welcome to book another class at your convenience.
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${BASE_URL}/schedule" style="${emailStyles.button}">Book Another Class</a>
              </div>
            </div>
            ${getEmailFooter()}
          </div>
        `;
        break;

      case 'waiver_reminder':
        subject = 'Action Required: Sign Your Waiver';
        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            <div style="${emailStyles.content}">
              <h2 style="${emailStyles.heading}">Waiver Signature Required</h2>
              <p>Hi ${data.name},</p>
              <p>Please sign your liability waiver before your first class. This is required for your safety and ours.</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${BASE_URL}/member/waivers" style="${emailStyles.button}">Sign Your Waiver</a>
              </div>
              <p style="${emailStyles.muted}">This only takes a minute and you'll be ready to join any class!</p>
            </div>
            ${getEmailFooter()}
          </div>
        `;
        break;

      case 'class_reminder':
        subject = `Reminder: ${data.class_name} Tomorrow at ${data.time}`;
        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            <div style="${emailStyles.content}">
              <h2 style="${emailStyles.heading}">Class Reminder ⏰</h2>
              <p>Don't forget - you have a class coming up tomorrow!</p>
              <div style="background: #F0DFC4; border: 1px solid #C1B19C; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <table style="width: 100%; border-collapse: collapse; font-family: Georgia, serif;">
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Class</td>
                    <td style="padding: 8px 0; font-weight: 600;">${data.class_name}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Date</td>
                    <td style="padding: 8px 0; font-weight: 600;">${data.date}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Time</td>
                    <td style="padding: 8px 0; font-weight: 600;">${data.time}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Instructor</td>
                    <td style="padding: 8px 0; font-weight: 600;">${data.instructor}</td>
                  </tr>
                  ${data.room ? `
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Room</td>
                    <td style="padding: 8px 0; font-weight: 600;">${data.room}</td>
                  </tr>
                  ` : ''}
                </table>
              </div>
              <p style="${emailStyles.muted}">Please arrive 5-10 minutes early to check in and prepare for your class.</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${BASE_URL}/member/bookings" style="${emailStyles.button}">View My Bookings</a>
              </div>
              <p style="${emailStyles.muted}">Need to cancel? Please do so at least 24 hours in advance to avoid losing your credit.</p>
            </div>
            ${getEmailFooter()}
          </div>
        `;
        break;

      case 'waitlist_notification':
        subject = `Spot Available: ${data.class_name} - Claim Now!`;
        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            <div style="${emailStyles.content}">
              <h2 style="${emailStyles.heading}">A Spot Just Opened Up! 🎉</h2>
              <p>Great news! A spot has become available in a class you're on the waitlist for:</p>
              <div style="background: #DEDACE; border: 1px solid #C1B19C; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <table style="width: 100%; border-collapse: collapse; font-family: Georgia, serif;">
                  <tr>
                    <td style="padding: 8px 0; color: #88766B;">Class</td>
                    <td style="padding: 8px 0; font-weight: 600; color: #1C170F;">${data.class_name}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #88766B;">Date</td>
                    <td style="padding: 8px 0; font-weight: 600; color: #1C170F;">${data.date}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #88766B;">Time</td>
                    <td style="padding: 8px 0; font-weight: 600; color: #1C170F;">${data.time}</td>
                  </tr>
                </table>
              </div>
              <div style="background: #F0DFC4; border: 2px solid #B8A068; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; font-weight: 600; color: #1C170F; font-family: Georgia, serif;">⏰ Act fast! You have 5 minutes to claim this spot.</p>
              </div>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${BASE_URL}/schedule" style="${emailStyles.button}">Claim Your Spot Now</a>
              </div>
              <p style="${emailStyles.muted}">If you don't claim this spot within 5 minutes, it will be offered to the next person on the waitlist.</p>
            </div>
            ${getEmailFooter()}
          </div>
        `;
        break;

      case 'waitlist_claim_confirmation':
        subject = `Waitlist Spot Claimed! - ${data.class_name}`;
        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            <div style="${emailStyles.content}">
              <h2 style="${emailStyles.heading}">You Got the Spot! 🎉</h2>
              <p>Congratulations! You successfully claimed your spot from the waitlist:</p>
              <div style="background: #DEDACE; border: 1px solid #C1B19C; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <table style="width: 100%; border-collapse: collapse; font-family: Georgia, serif;">
                  <tr>
                    <td style="padding: 8px 0; color: #88766B;">Class</td>
                    <td style="padding: 8px 0; font-weight: 600; color: #1C170F;">${data.class_name}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #88766B;">Date</td>
                    <td style="padding: 8px 0; font-weight: 600; color: #1C170F;">${data.date}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #88766B;">Time</td>
                    <td style="padding: 8px 0; font-weight: 600; color: #1C170F;">${data.time}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #88766B;">Instructor</td>
                    <td style="padding: 8px 0; font-weight: 600; color: #1C170F;">${data.instructor}</td>
                  </tr>
                  ${data.room ? `
                  <tr>
                    <td style="padding: 8px 0; color: #88766B;">Room</td>
                    <td style="padding: 8px 0; font-weight: 600; color: #1C170F;">${data.room}</td>
                  </tr>
                  ` : ''}
                </table>
              </div>
              <p style="color: #1C170F; font-weight: 500; font-family: Georgia, serif;">✓ Your spot is now confirmed!</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${BASE_URL}/member/bookings" style="${emailStyles.button}">View My Bookings</a>
              </div>
              <p style="${emailStyles.muted}">Please arrive 5-10 minutes early to check in. Remember, cancellations must be made at least 24 hours in advance to avoid forfeiting your credit.</p>
            </div>
            ${getEmailFooter()}
          </div>
        `;
        break;

      case 'payment_update_request':
        subject = 'Action Required: Update Your Payment Information - Storm Wellness Club';
        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            <div style="${emailStyles.content}">
              <h2 style="${emailStyles.heading}">Dear ${data.name},</h2>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                Thank you for your interest in joining Storm Wellness Club!
              </p>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                To complete your membership application, we need your payment information on file. This allows us to process your annual membership fee and set up your billing.
              </p>
              
              <div style="background: #F0DFC4; border: 1px solid #C1B19C; border-radius: 8px; padding: 20px; margin: 25px 0;">
                <p style="margin: 0; font-weight: 600; color: #1C170F; font-family: Georgia, serif;">
                  Sign in or create an account using the same email address you applied with (${data.email}), and you'll be able to add your payment method securely.
                </p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${BASE_URL}/auth" style="${emailStyles.button}">Add Payment Information</a>
              </div>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                If you have any questions, please don't hesitate to reach out to us.
              </p>
              
              <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="font-style: italic; color: #6b7280; margin-bottom: 5px;">Warmly,</p>
                <p style="font-weight: 600; color: #1f2937; margin: 0;">Storm</p>
                <p style="color: #6b7280; margin: 0;">Founder, Storm Wellness Club</p>
              </div>
            </div>
            ${getEmailFooter()}
          </div>
        `;
        break;

      case 'membership_scheduled':
        subject = `Your Membership is Scheduled - Starting ${data.benefitsStartDate}`;
        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            <div style="${emailStyles.content}">
              <h2 style="${emailStyles.heading}">Membership Scheduled</h2>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                Dear ${data.name},
              </p>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                Excellent! Your ${data.tier} membership has been scheduled and is ready to go.
              </p>
              
              <div style="${emailStyles.infoBox}">
                <h3 style="margin: 0 0 15px 0; color: #1C170F; font-family: Georgia, serif;">Membership Details</h3>
                <table style="width: 100%; border-collapse: collapse; font-family: Georgia, serif;">
                  <tr>
                    <td style="padding: 8px 0; color: #88766B;">Tier</td>
                    <td style="padding: 8px 0; font-weight: 600; text-align: right; color: #1C170F;">${data.tier}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #88766B;">Benefits Start</td>
                    <td style="padding: 8px 0; font-weight: 600; text-align: right; color: #1C170F;">${data.benefitsStartDate}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #88766B;">First Charge Date</td>
                    <td style="padding: 8px 0; font-weight: 600; text-align: right; color: #1C170F;">${data.firstChargeDate}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #88766B;">Charge Amount</td>
                    <td style="padding: 8px 0; font-weight: 600; text-align: right; font-size: 18px; color: #1C170F;">$${data.amount}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #88766B;">Payment Method</td>
                    <td style="padding: 8px 0; font-weight: 600; text-align: right; color: #1C170F;">${data.cardBrand} •••• ${data.cardLast4}</td>
                  </tr>
                </table>
              </div>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                On ${data.firstChargeDate}, we'll charge your card on file for your membership dues. Your benefits will begin immediately on ${data.benefitsStartDate}.
              </p>
              
              <div style="${emailStyles.successBox}">
                <p style="margin: 0; color: #1C170F; font-weight: 600;">
                  ✓ Your membership is confirmed and scheduled
                </p>
              </div>
              
              <p style="font-size: 14px; color: #88766B; margin-bottom: 20px; margin-top: 30px;">
                If you have any questions or need to make changes to your membership, please contact us or log into your member portal.
              </p>
              
              <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="font-style: italic; color: #6b7280; margin-bottom: 5px;">Thank you,</p>
                <p style="font-weight: 600; color: #1f2937; margin: 0;">Storm Wellness Club</p>
              </div>
            </div>
            ${getEmailFooter()}
          </div>
        `;
        break;

      case 'charge_confirmation':
        // Enhanced receipt with optional Benefits Start date for "Charge Now, Activate Later" flow
        const paymentDate = data.paymentDate || data.date || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const benefitsStartDate = data.benefitsStartDate;
        const nextBillingDate = data.nextBillingDate;
        const showBenefitsStart = benefitsStartDate && benefitsStartDate !== paymentDate;
        
        subject = `Payment Receipt - Storm Wellness Club`;
        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            <div style="${emailStyles.content}">
              <h2 style="${emailStyles.heading}">Payment Confirmation</h2>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                Dear ${data.name},
              </p>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                This email confirms that your payment has been successfully processed.
              </p>
              
              <div style="background: #DEDACE; border: 1px solid #C1B19C; border-radius: 8px; padding: 20px; margin: 25px 0;">
                <h3 style="margin: 0 0 15px 0; color: #1C170F; font-family: Georgia, serif;">Receipt Details</h3>
                <table style="width: 100%; border-collapse: collapse; font-family: Georgia, serif;">
                  <tr>
                    <td style="padding: 8px 0; color: #88766B;">Description</td>
                    <td style="padding: 8px 0; font-weight: 600; text-align: right; color: #1C170F;">${data.description}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #88766B;">Amount</td>
                    <td style="padding: 8px 0; font-weight: 600; text-align: right; font-size: 18px; color: #1C170F;">$${data.amount}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #88766B;">Payment Date</td>
                    <td style="padding: 8px 0; font-weight: 600; text-align: right; color: #1C170F;">${paymentDate}</td>
                  </tr>
                  ${showBenefitsStart ? `
                  <tr>
                    <td style="padding: 8px 0; color: #88766B;">Benefits Start</td>
                    <td style="padding: 8px 0; font-weight: 600; text-align: right; color: #1C170F;">${benefitsStartDate}</td>
                  </tr>
                  ` : ''}
                  ${nextBillingDate ? `
                  <tr>
                    <td style="padding: 8px 0; color: #88766B;">Next Billing</td>
                    <td style="padding: 8px 0; font-weight: 600; text-align: right; color: #1C170F;">${nextBillingDate}</td>
                  </tr>
                  ` : ''}
                  <tr>
                    <td style="padding: 8px 0; color: #88766B;">Payment Method</td>
                    <td style="padding: 8px 0; font-weight: 600; text-align: right; color: #1C170F;">${data.cardBrand} •••• ${data.cardLast4}</td>
                  </tr>
                </table>
              </div>
              
              <p style="font-size: 14px; color: #6b7280; margin-bottom: 20px;">
                Please keep this email as your receipt for your records.
              </p>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                If you have any questions about this charge, please don't hesitate to contact us.
              </p>
              
              <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="font-style: italic; color: #6b7280; margin-bottom: 5px;">Thank you,</p>
                <p style="font-weight: 600; color: #1f2937; margin: 0;">Storm Wellness Club</p>
              </div>
            </div>
            ${getReceiptFooter()}
          </div>
        `;
        break;

      case 'pos_charge_receipt': {
        const posDate = data.chargedAt
          ? new Date(data.chargedAt).toLocaleString('en-US', {
              timeZone: 'America/Detroit',
              month: 'short', day: 'numeric', year: 'numeric',
              hour: 'numeric', minute: '2-digit',
            })
          : new Date().toLocaleString('en-US', { timeZone: 'America/Detroit' });

        const lineItemRows = Array.isArray(data.lineItems) && data.lineItems.length
          ? data.lineItems.map((li: any) => `
              <tr>
                <td style="padding: 6px 0; color: #1C170F;">${li.quantity}× ${li.name}</td>
                <td style="padding: 6px 0; text-align: right; color: #1C170F;">$${(Number(li.unit_price) * Number(li.quantity)).toFixed(2)}</td>
              </tr>`).join('')
          : '';

        subject = `Your receipt from Storm Wellness Club — $${data.amount}`;
        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            <div style="${emailStyles.content}">
              <h2 style="${emailStyles.heading}">Receipt</h2>
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                Hi ${data.name},
              </p>
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                Thanks — here's your receipt for today's purchase at Storm Wellness Club.
              </p>

              ${data.note ? `
                <div style="background: #FFF8E7; border-left: 4px solid #C1B19C; padding: 14px 16px; border-radius: 6px; margin: 20px 0;">
                  <div style="font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: #88766B; margin-bottom: 6px;">Note from the front desk</div>
                  <div style="color: #1C170F; font-size: 15px; line-height: 1.6;">${data.note}</div>
                </div>
              ` : ''}

              <div style="background: #DEDACE; border: 1px solid #C1B19C; border-radius: 8px; padding: 20px; margin: 25px 0;">
                <h3 style="margin: 0 0 15px 0; color: #1C170F; font-family: Georgia, serif;">Receipt Details</h3>
                <table style="width: 100%; border-collapse: collapse; font-family: Georgia, serif;">
                  ${lineItemRows ? `
                    <tr><td colspan="2" style="padding-bottom: 6px; color: #88766B; font-size: 12px; letter-spacing: .06em; text-transform: uppercase;">Items</td></tr>
                    ${lineItemRows}
                    <tr><td colspan="2" style="border-top: 1px solid #C1B19C; padding-top: 8px;"></td></tr>
                  ` : `
                    <tr>
                      <td style="padding: 8px 0; color: #88766B;">Description</td>
                      <td style="padding: 8px 0; font-weight: 600; text-align: right; color: #1C170F;">${data.description || 'Purchase'}</td>
                    </tr>
                  `}
                  ${data.subtotal ? `
                    <tr>
                      <td style="padding: 6px 0; color: #88766B;">Subtotal</td>
                      <td style="padding: 6px 0; text-align: right; color: #1C170F;">$${data.subtotal}</td>
                    </tr>` : ''}
                  ${data.tax ? `
                    <tr>
                      <td style="padding: 6px 0; color: #88766B;">MI Sales Tax (6%)</td>
                      <td style="padding: 6px 0; text-align: right; color: #1C170F;">$${data.tax}</td>
                    </tr>` : ''}
                  ${data.processingFee && Number(data.processingFee) > 0 ? `
                    <tr>
                      <td style="padding: 6px 0; color: #88766B;">Processing Fee</td>
                      <td style="padding: 6px 0; text-align: right; color: #1C170F;">$${data.processingFee}</td>
                    </tr>` : ''}
                  <tr>
                    <td style="padding: 10px 0 4px; color: #1C170F; font-weight: 700;">Total Charged</td>
                    <td style="padding: 10px 0 4px; text-align: right; font-weight: 700; font-size: 18px; color: #1C170F;">$${data.amount}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #88766B;">Date</td>
                    <td style="padding: 8px 0; font-weight: 600; text-align: right; color: #1C170F;">${posDate}</td>
                  </tr>
                  ${data.cardBrand ? `
                    <tr>
                      <td style="padding: 8px 0; color: #88766B;">Payment Method</td>
                      <td style="padding: 8px 0; font-weight: 600; text-align: right; color: #1C170F;">${data.cardBrand} •••• ${data.cardLast4 || '****'}</td>
                    </tr>` : ''}
                </table>
              </div>

              <p style="font-size: 14px; color: #6b7280; margin-bottom: 20px;">
                Please keep this email as your receipt. If anything looks off, reply to this email and we'll take care of it.
              </p>

              <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="font-style: italic; color: #6b7280; margin-bottom: 5px;">Thank you,</p>
                <p style="font-weight: 600; color: #1f2937; margin: 0;">Storm Wellness Club</p>
              </div>
            </div>
            ${getReceiptFooter()}
          </div>
        `;
        break;
      }


      case 'application_approved_locked_date':
        subject = `Your Membership is Approved - Starting ${data.lockedStartDate}!`;
        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            <div style="${emailStyles.content}">
              <h2 style="${emailStyles.heading}">Dear ${data.name},</h2>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                Great news! Your application to Storm Wellness Club has been approved.
              </p>
              
              <div style="background: #ecfdf5; border: 1px solid #10b981; border-radius: 8px; padding: 20px; margin: 25px 0; text-align: center;">
                <p style="margin: 0 0 10px 0; color: #065f46; font-size: 14px;">Your membership begins on</p>
                <p style="margin: 0; font-size: 24px; font-weight: 700; color: #065f46;">${data.lockedStartDate}</p>
              </div>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                To complete your membership setup, please sign in to your member portal to:
              </p>
              
              <ul style="color: #374151; line-height: 2; margin: 20px 0;">
                <li>Add your payment information for your membership subscription</li>
                <li>Complete your profile</li>
                <li>Sign your membership agreement</li>
              </ul>
              
              <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 20px; margin: 25px 0;">
                <p style="margin: 0; font-weight: 600; color: #92400e;">
                  ⏰ Please complete your setup before your start date to ensure uninterrupted access.
                </p>
              </div>
              
              <div style="background: #e0f2fe; border: 1px solid #0284c7; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <p style="margin: 0; font-size: 14px; color: #0369a1;">
                  <strong>📧 Important:</strong> When creating your member account, please use the same email address you applied with: <strong>${data.email || to}</strong>. This ensures your membership is automatically linked to your account.
                </p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${BASE_URL}/auth" style="${emailStyles.button}">Complete Your Setup</a>
              </div>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                We look forward to welcoming you to Storm Wellness Club!
              </p>
              
              <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="font-style: italic; color: #6b7280; margin-bottom: 5px;">Warmly,</p>
                <p style="font-weight: 600; color: #1f2937; margin: 0;">Storm</p>
                <p style="color: #6b7280; margin: 0;">Founder, Storm Wellness Club</p>
              </div>
            </div>
            ${getEmailFooter()}
          </div>
        `;
        break;

      case 'add_card_for_dues':
        subject = 'Add Your Payment Method - Storm Wellness Club';
        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            <div style="${emailStyles.content}">
              <h2 style="${emailStyles.heading}">Dear ${data.name},</h2>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                Your initiation fee has been received — thank you!
              </p>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                To prepare for your membership activation, please sign in to your member portal and add the payment method you'd like to use for your membership dues.
              </p>
              
              <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 25px 0;">
                <h3 style="margin: 0 0 15px 0; color: #312D28;">What you need to do:</h3>
                <ul style="color: #374151; line-height: 2; margin: 0; padding-left: 20px;">
                  <li>Sign in to your member portal</li>
                  <li>Go to Settings → Payment Methods</li>
                  <li>Add your preferred payment card</li>
                </ul>
              </div>
              
              <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 20px; margin: 25px 0;">
                <p style="margin: 0; font-weight: 600; color: #92400e;">
                  Important Notes:
                </p>
                <ul style="color: #92400e; line-height: 1.8; margin: 10px 0 0 0; padding-left: 20px; font-size: 14px;">
                  <li>Your card will be securely saved for billing</li>
                  <li>You can change your payment method anytime in your Member Portal</li>
                  <li>Your membership will be activated when we open</li>
                </ul>
              </div>
              
              <div style="background: #e0f2fe; border: 1px solid #0284c7; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <p style="margin: 0; font-size: 14px; color: #0369a1;">
                  <strong>📧 Important:</strong> When signing in, please use the same email address you applied with: <strong>${data.email || to}</strong>. This ensures your membership is automatically linked to your account.
                </p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${BASE_URL}/auth" style="${emailStyles.button}">Add Payment Method</a>
              </div>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                If you have any questions, please don't hesitate to reach out.
              </p>
              
              <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="font-style: italic; color: #6b7280; margin-bottom: 5px;">Warmly,</p>
                <p style="font-weight: 600; color: #1f2937; margin: 0;">Storm</p>
                <p style="color: #6b7280; margin: 0;">Founder, Storm Wellness Club</p>
              </div>
            </div>
            ${getEmailFooter()}
          </div>
        `;
        break;

      case 'staff_reply':
        subject = data.subject || 'Re: Your Message - Storm Wellness Club';
        // Route member replies to Resend Inbound on reply.stormwellnessclub.com.
        // If we have a conversationId, use plus-addressing so we can thread the reply
        // deterministically in receive-email.
        if (data?.conversationId && typeof data.conversationId === 'string') {
          data.replyTo = `reply+${data.conversationId}@reply.stormwellnessclub.com`;
        } else if (!data?.replyTo) {
          data.replyTo = 'reply@reply.stormwellnessclub.com';
        }
        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            <div style="${emailStyles.content}">
              <h2 style="${emailStyles.heading}">Hello ${data.name || 'Member'},</h2>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                Thank you for reaching out to us. We've received your message and wanted to respond:
              </p>
              
              <div style="background: #f9fafb; border-left: 4px solid #C9A227; padding: 20px; margin: 25px 0; border-radius: 4px;">
                <div style="white-space: pre-wrap; color: #374151; line-height: 1.8;">${data.message || ''}</div>
              </div>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                If you have any further questions, you can simply reply to this email and we'll see it — or use your member portal.
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${BASE_URL}/member/support" style="${emailStyles.button}">Open Member Portal</a>
              </div>
              
              <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="font-style: italic; color: #6b7280; margin-bottom: 5px;">Best regards,</p>
                <p style="font-weight: 600; color: #1f2937; margin: 0;">Storm Wellness Club Team</p>
              </div>
            </div>
            ${getEmailFooter()}
          </div>
        `;
        break;

      case 'application_card_declined': {
        subject = 'A small hold on your Storm Wellness Club membership — action needed';
        const firstName = data.name || data.first_name || 'there';
        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            <div style="${emailStyles.content}; font-family: Georgia, 'Times New Roman', Times, serif;">
              <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your application has been approved. We need a quick payment update to complete activation.</div>
              <h2 style="${emailStyles.heading}; font-family: Georgia, serif;">Dear ${firstName},</h2>

              <p style="font-size:16px;line-height:1.8;color:#374151;margin-bottom:20px;font-family:Georgia,serif;">
                Wonderful news — your Storm Wellness Club application has been approved. We're looking forward to welcoming you into the Club.
              </p>

              <p style="font-size:16px;line-height:1.8;color:#374151;margin-bottom:20px;font-family:Georgia,serif;">
                Before we can complete your activation, we ran into a small issue: your card on file was declined when we attempted your initial charge. This is typically due to a daily limit, an expired card, or a routine fraud check from your bank — nothing to be concerned about.
              </p>

              <p style="font-size:16px;line-height:1.8;color:#374151;margin-bottom:10px;font-family:Georgia,serif;">
                <strong>To complete your activation, please update your payment method:</strong>
              </p>
              <div style="text-align:center;margin:20px 0 30px;">
                <a href="${BASE_URL}/portal/payment-methods" style="${emailStyles.button}">Update Payment Method</a>
              </div>

              <div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:20px;margin:25px 0;">
                <p style="margin:0;font-weight:600;color:#92400e;font-family:Georgia,serif;font-size:15px;">
                  ⏰ Your approval is reserved for the next 7 days. If we don't receive a valid payment method by then, your approval will expire and a new application will be required to rejoin.
                </p>
              </div>

              <p style="font-size:16px;line-height:1.8;color:#374151;margin-bottom:20px;font-family:Georgia,serif;">
                Questions? Just reply to this email or give the Club a call — we're happy to help. To update your card, please use the secure link above.
              </p>

              <div style="margin-top:40px;padding-top:20px;border-top:1px solid #e5e7eb;">
                <p style="font-style:italic;color:#6b7280;margin-bottom:5px;font-family:Georgia,serif;">Warmly,</p>
                <p style="font-weight:600;color:#1f2937;margin:0;font-family:Georgia,serif;">The Storm Wellness Club Team</p>
              </div>
            </div>
            ${getEmailFooter()}
          </div>
        `;
        break;
      }

      case 'payment_failed':
        subject = 'Payment Issue - Storm Wellness Club';
        const amount = data.amount ? `$${data.amount.toFixed(2)}` : 'your membership dues';
        const nextRetry = data.nextRetryAt ? new Date(data.nextRetryAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null;
        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            <div style="${emailStyles.content}">
              <h2 style="${emailStyles.heading}">Dear ${data.name},</h2>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                We encountered an issue processing your payment for ${amount}.
              </p>
              
              <div style="background: #fee2e2; border: 1px solid #ef4444; border-radius: 8px; padding: 20px; margin: 25px 0;">
                <p style="margin: 0 0 10px 0; font-weight: 600; color: #991b1b;">
                  Payment Failed: ${data.failureReason || data.declineReason || 'Unable to process payment'}
                </p>
                ${data.failureMessage ? `<p style="margin: 0; color: #991b1b; font-size: 14px;">${data.failureMessage}</p>` : ''}
              </div>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                To ensure uninterrupted access to your membership, please update your payment method as soon as possible.
              </p>
              
              ${nextRetry ? `
                <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 20px; margin: 25px 0;">
                  <p style="margin: 0; font-weight: 600; color: #92400e;">
                    ⏰ We will automatically retry your payment on ${nextRetry}. Please update your payment method before then to avoid service interruption.
                  </p>
                </div>
              ` : `
                <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 20px; margin: 25px 0;">
                  <p style="margin: 0; font-weight: 600; color: #92400e;">
                    ⚠️ Please update your payment method to restore full access to your membership benefits.
                  </p>
                </div>
              `}
              
              <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 25px 0;">
                <h3 style="margin: 0 0 15px 0; color: #312D28;">What you need to do:</h3>
                <ul style="color: #374151; line-height: 2; margin: 0; padding-left: 20px;">
                  <li>Sign in to your member portal</li>
                  <li>Go to Membership → Payment Methods</li>
                  <li>Update your payment method or add a new card</li>
                </ul>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${BASE_URL}/member/membership" style="${emailStyles.button}">Update Payment Method</a>
              </div>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                Common reasons for payment failure include:
              </p>
              <ul style="color: #374151; line-height: 2; margin: 0 0 20px 0; padding-left: 20px;">
                <li>Insufficient funds</li>
                <li>Expired card</li>
                <li>Card number changed</li>
                <li>Bank declined the transaction</li>
              </ul>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                If you have any questions or need assistance, please don't hesitate to reach out to us.
              </p>
              
              <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="font-style: italic; color: #6b7280; margin-bottom: 5px;">Best regards,</p>
                <p style="font-weight: 600; color: #1f2937; margin: 0;">Storm Wellness Club Team</p>
              </div>
            </div>
            ${getEmailFooter()}
          </div>
        `;
        break;

      case 'annual_fee_payment_request':
        subject = 'Complete Your Initiation Fee - Storm Wellness Club';
        const feeAmount = data.amount || 300;
        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            <div style="${emailStyles.content}; font-family: Georgia, 'Times New Roman', Times, serif;">
              <h2 style="${emailStyles.heading}; font-family: Georgia, 'Times New Roman', Times, serif;">Dear ${data.name},</h2>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px; font-family: Georgia, 'Times New Roman', Times, serif;">
                Congratulations on being approved to join Storm Wellness Club. To complete your membership setup, please pay your initiation fee using the secure link below.
              </p>
              
              <div style="background: #fef3c7; border: 2px solid #f59e0b; border-radius: 8px; padding: 20px; margin: 25px 0;">
                <p style="margin: 0; font-weight: 600; color: #92400e; font-family: Georgia, 'Times New Roman', Times, serif; font-size: 16px;">
                  ⏰ Important: You have 3 days to complete this payment
                </p>
                <p style="margin: 10px 0 0 0; color: #92400e; font-size: 14px; font-family: Georgia, 'Times New Roman', Times, serif;">
                  If payment is not received within 3 days, your application will expire and you will need to reapply.
                </p>
              </div>
              
              <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-family: Georgia, 'Times New Roman', Times, serif;">Initiation Fee</td>
                    <td style="padding: 8px 0; font-weight: 600; font-family: Georgia, 'Times New Roman', Times, serif;">$${feeAmount}</td>
                  </tr>
                </table>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${data.paymentUrl}" style="${emailStyles.button}; font-family: Georgia, 'Times New Roman', Times, serif; font-size: 16px;">Complete Payment</a>
              </div>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px; font-family: Georgia, 'Times New Roman', Times, serif;">
                Once your payment is received, our team will be in touch with next steps to <strong>activate your member account</strong> and welcome you to Storm Wellness Club.
              </p>
              
              <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="font-style: italic; color: #6b7280; margin-bottom: 5px; font-family: Georgia, 'Times New Roman', Times, serif;">Warmly,</p>
                <p style="font-weight: 600; color: #1f2937; margin: 0; font-family: Georgia, 'Times New Roman', Times, serif;">Storm Wellness Club</p>
              </div>
            </div>
            ${getReceiptFooter()}
          </div>
        `;
        break;

      case 'annual_fee_final_notice':
        subject = 'Action Required by Sunday - Storm Wellness Club';
        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            
            <!-- COMPLETE INITIATION PAYMENT Header -->
            <div style="background: #DEDACE; padding: 30px 20px; text-align: center; border-bottom: 3px solid #B8A068;">
              <h1 style="color: #1C170F; font-size: 28px; font-weight: 500; margin: 0 0 8px 0; font-family: Georgia, 'Times New Roman', Times, serif; letter-spacing: 2px;">
                COMPLETE INITIATION PAYMENT
              </h1>
              <p style="color: #6C5D3E; font-size: 14px; font-weight: 700; margin: 0; font-family: Georgia, 'Times New Roman', Times, serif; letter-spacing: 1px;">
                <strong>Action Required</strong>
              </p>
            </div>
            
            <div style="${emailStyles.content}; font-family: Georgia, 'Times New Roman', Times, serif;">
              <h2 style="${emailStyles.heading}; font-family: Georgia, 'Times New Roman', Times, serif;">Dear ${data.name},</h2>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px; font-family: Georgia, 'Times New Roman', Times, serif;">
                We are thrilled to have you as part of our founding member community and cannot wait to welcome you to Storm Wellness Club.
              </p>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px; font-family: Georgia, 'Times New Roman', Times, serif;">
                To confirm your place for our soft launch, we kindly ask that you complete your initiation fee payment by <strong>Sunday, February 8th at 5:00 PM</strong>.
              </p>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px; font-family: Georgia, 'Times New Roman', Times, serif;">
                As we personalize each member's experience, we need to finalize our confirmed membership count to ensure we can deliver the exceptional service you deserve from day one. Unfortunately, we are unable to hold spots indefinitely for members who have not completed their enrollment.
              </p>
              
              <!-- Grace Period Option -->
              <div style="background: #F0DFC4; border: 1px solid #C1B19C; border-radius: 8px; padding: 20px; margin: 25px 0;">
                <p style="margin: 0; color: #1C170F; font-size: 15px; font-family: Georgia, 'Times New Roman', Times, serif;">
                  If you need additional time, we are able to offer a seven-day grace period to complete your payment. Simply reply to this email to request an extension.
                </p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${data.paymentUrl}" style="display: inline-block; background: #B8A068; color: #1C170F; padding: 16px 40px; text-decoration: none; font-weight: 600; border-radius: 4px; font-family: Georgia, 'Times New Roman', Times, serif; font-size: 16px; letter-spacing: 0.5px;">
                  Complete Payment
                </a>
              </div>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px; font-family: Georgia, 'Times New Roman', Times, serif;">
                We truly hope to see you at the club soon.
              </p>
              
              <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #C1B19C;">
                <p style="font-style: italic; color: #6C5D3E; margin-bottom: 5px; font-family: Georgia, 'Times New Roman', Times, serif;">Warmly,</p>
                <p style="font-weight: 600; color: #1C170F; margin: 0; font-family: Georgia, 'Times New Roman', Times, serif;">The Storm Wellness Club Team</p>
              </div>
            </div>
            ${getReceiptFooter()}
          </div>
        `;
        break;

      case 'freeze_completed':
        // SAFETY CHECK: Only send if this is actually from a freeze completion
        // This prevents the email from being sent incorrectly during member activation
        console.log('[SEND-EMAIL] freeze_completed called', { to, data, source: data.source || 'unknown' });
        
        if (!data.freezeEndDate && !data.freezeId) {
          console.error('[SEND-EMAIL] freeze_completed called WITHOUT valid freeze data - BLOCKING email', { 
            to, 
            data,
            reason: 'Missing freezeEndDate and freezeId - likely called incorrectly during activation'
          });
          // Return success but don't send the email
          return new Response(
            JSON.stringify({ 
              success: false, 
              blocked: true, 
              reason: 'freeze_completed requires freezeEndDate or freezeId - email blocked to prevent incorrect send'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        }
        
        subject = 'Membership Reactivated - Welcome Back to Storm Wellness Club!';
        const freezeEndDate = data.freezeEndDate ? new Date(data.freezeEndDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'today';
        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            <div style="${emailStyles.content}">
              <h2 style="${emailStyles.heading}">Welcome back, ${data.name}! 🎉</h2>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                Your membership freeze has ended and your membership is now active again. We're excited to have you back!
              </p>
              
              <div style="background: #ecfdf5; border: 1px solid #10b981; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <p style="margin: 0 0 10px 0; font-weight: 600; color: #065f46;">
                  ✅ Membership Reactivated
                </p>
                <p style="margin: 0; color: #047857; font-size: 14px;">
                  Your membership freeze ended on ${freezeEndDate}. Full access to all facilities and services has been restored.
                </p>
              </div>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                You now have full access to:
              </p>
              
              <ul style="color: #374151; line-height: 2; margin: 0 0 20px 0; padding-left: 20px;">
                <li>All fitness facilities and equipment</li>
                <li>Group classes and personal training</li>
                <li>Spa services and amenities</li>
                <li>Cafe and wellness services</li>
              </ul>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${BASE_URL}/member" style="${emailStyles.button}">Access Member Portal</a>
                <a href="${BASE_URL}/schedule" style="${emailStyles.buttonSecondary}">Book a Class</a>
              </div>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                If you have any questions or need assistance, please don't hesitate to reach out to our team.
              </p>
              
              <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="font-style: italic; color: #6b7280; margin-bottom: 5px;">Welcome back,</p>
                <p style="font-weight: 600; color: #1f2937; margin: 0;">Storm Wellness Club Team</p>
              </div>
            </div>
            ${getEmailFooter()}
          </div>
        `;
        break;

      case 'freeze_request_rejected': {
        // Admin-composed freeze rejection email. Subject + body are passed in
        // (and edited in the admin UI before send). Body is plain text — we
        // escape it and convert line breaks into paragraphs so the message
        // renders cleanly inside the standard branded shell.
        subject = (data.subject && String(data.subject).trim()) || 'Regarding Your Freeze Request';

        const rawBody = String(data.bodyText ?? '').trim();
        const escapeHtml = (s: string) =>
          s.replace(/&/g, '&amp;')
           .replace(/</g, '&lt;')
           .replace(/>/g, '&gt;')
           .replace(/"/g, '&quot;')
           .replace(/'/g, '&#39;');

        const paragraphs = rawBody
          .split(/\n{2,}/)
          .map((para) => {
            const inner = escapeHtml(para).replace(/\n/g, '<br />');
            return `<p style="font-size: 16px; line-height: 1.8; color: #1C170F; margin: 0 0 18px 0; font-family: Georgia, serif;">${inner}</p>`;
          })
          .join('\n');

        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            <div style="${emailStyles.content}">
              ${paragraphs}
            </div>
            ${getEmailFooter()}
          </div>
        `;
        break;
      }

      case 'freeze_payment_request': {
        subject = 'Action Required: Pay Your Freeze Fee — Storm Wellness Club';
        const firstName = String(data.firstName ?? data.name ?? '').trim();
        const startDate = data.startDate
          ? new Date(data.startDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
          : null;
        const endDate = data.endDate
          ? new Date(data.endDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
          : null;
        const durationMonths = Number(data.durationMonths ?? 0);
        const feeAmount = Number(data.freezeFeeTotal ?? 0);
        const feeFormatted = `$${feeAmount.toFixed(2)}`;
        const payUrl = `${BASE_URL}/member/freeze`;

        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            <div style="${emailStyles.content}">
              <h2 style="${emailStyles.heading}">Hi ${firstName || 'there'},</h2>

              <p style="font-size: 16px; line-height: 1.8; color: #1C170F; margin: 0 0 18px 0; font-family: Georgia, serif;">
                Good news — your membership freeze request has been approved. To activate the freeze, please pay the freeze fee below.
              </p>

              <div style="background: #F0DFC4; border: 1px solid #C1B19C; border-radius: 8px; padding: 20px; margin: 24px 0; font-family: Georgia, serif;">
                <p style="margin: 0 0 8px 0; color: #1C170F; font-size: 15px;">
                  <strong>Freeze Period:</strong> ${startDate || 'TBD'}${endDate ? ` &rarr; ${endDate}` : ''}
                </p>
                ${durationMonths ? `<p style="margin: 0 0 8px 0; color: #1C170F; font-size: 15px;"><strong>Duration:</strong> ${durationMonths} month${durationMonths === 1 ? '' : 's'}</p>` : ''}
                <p style="margin: 0; color: #1C170F; font-size: 15px;">
                  <strong>Freeze Fee:</strong> ${feeFormatted}
                </p>
              </div>

              <p style="font-size: 16px; line-height: 1.8; color: #1C170F; margin: 0 0 24px 0; font-family: Georgia, serif;">
                Your freeze will not start until the fee is paid. Once paid, your monthly dues and annual fee billing will be paused for the duration above.
              </p>

              <div style="text-align: center; margin: 32px 0;">
                <a href="${payUrl}" style="${emailStyles.button}">Pay ${feeFormatted} Now</a>
              </div>

              <p style="font-size: 14px; line-height: 1.6; color: #6C5D3E; margin: 0 0 8px 0; font-family: Georgia, serif;">
                Or copy this link into your browser:<br />
                <a href="${payUrl}" style="color: #1C170F;">${payUrl}</a>
              </p>

              <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #C1B19C;">
                <p style="font-style: italic; color: #6C5D3E; margin-bottom: 5px; font-family: Georgia, serif;">In good standing,</p>
                <p style="font-weight: 600; color: #1C170F; margin: 0; font-family: Georgia, serif;">The Storm Wellness Club Team</p>
              </div>
            </div>
            ${getEmailFooter()}
          </div>
        `;
        break;
      }

      case 'member_activation_setup':
      case 'setup_instructions':
        subject = 'Welcome to Storm Wellness Club — Complete Your Membership Setup';
        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            <div style="${emailStyles.content}; font-family: Georgia, 'Times New Roman', Times, serif;">
              <h2 style="${emailStyles.heading}; font-family: Georgia, 'Times New Roman', Times, serif;">Dear ${data.name},</h2>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px; font-family: Georgia, 'Times New Roman', Times, serif;">
                Welcome to Storm Wellness Club! Complete these steps to activate your member portal and unlock full member access.
              </p>
              
              <div style="background: #DEDACE; border: 2px solid #B8A068; border-radius: 8px; padding: 20px; margin: 25px 0;">
                <p style="margin: 0 0 10px 0; font-weight: 600; color: #1C170F; font-family: Georgia, 'Times New Roman', Times, serif; font-size: 16px;">
                  📧 Important: Create your account with this email address
                </p>
                <p style="margin: 0; font-size: 18px; font-weight: 700; color: #1C170F; font-family: Georgia, 'Times New Roman', Times, serif; background: #F0DFC4; padding: 10px; border-radius: 4px; text-align: center;">
                  ${data.email || to}
                </p>
                <p style="margin: 10px 0 0 0; color: #6C5D3E; font-size: 14px; font-family: Georgia, 'Times New Roman', Times, serif;">
                  This is the same email you used when applying. Using a different email will prevent your membership from being linked automatically.
                </p>
              </div>
              
              <div style="background: #F0DFC4; border: 1px solid #C1B19C; border-radius: 8px; padding: 25px; margin: 25px 0;">
                <h3 style="margin: 0 0 15px 0; color: #1C170F; font-family: Georgia, 'Times New Roman', Times, serif; font-weight: 600;">
                  Complete Your Membership Setup:
                </h3>
                <ol style="color: #1C170F; line-height: 2.2; margin: 0; padding-left: 20px; font-family: Georgia, 'Times New Roman', Times, serif;">
                  <li><strong>Sign in or create your account</strong> using the email above</li>
                  <li>Go to the <strong>Waivers</strong> tab and sign any required waivers</li>
                  <li>Sign your <strong>Membership Agreement</strong> (also in the Waivers tab)</li>
                  <li>Add a <strong>Payment Method</strong> for monthly dues and mark one as default</li>
                  <li>Review your setup checklist in the <strong>My Membership</strong> tab</li>
                </ol>
              </div>
              
              <div style="background: #DEDACE; border: 1px solid #C1B19C; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <p style="margin: 0; font-size: 14px; color: #1C170F; font-family: Georgia, 'Times New Roman', Times, serif;">
                  <strong>💳 Important:</strong> When adding payment methods, please indicate which card 
                  you'd like us to use for your membership dues by setting it as your <em>default</em>.
                </p>
              </div>
              
              <div style="background: #F0DFC4; border: 2px solid #B8A068; border-radius: 8px; padding: 20px; margin: 25px 0;">
                <p style="margin: 0; font-weight: 600; color: #1C170F; font-family: Georgia, 'Times New Roman', Times, serif; font-size: 16px;">
                  Complete these steps to activate your member portal for full member access.
                </p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${BASE_URL}/auth?redirect=/member/membership" style="${emailStyles.button}; font-family: Georgia, 'Times New Roman', Times, serif; font-size: 16px;">Complete Your Setup</a>
              </div>
              
              <p style="font-size: 14px; line-height: 1.8; color: #6b7280; margin-bottom: 20px; font-family: Georgia, 'Times New Roman', Times, serif;">
                After signing in, you can access your payment methods at <a href="${BASE_URL}/member/payment-methods" style="${emailStyles.link}">Payment Methods</a> 
                and sign agreements at <a href="${BASE_URL}/member/waivers" style="${emailStyles.link}">Waivers & Agreements</a>.
              </p>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px; font-family: Georgia, 'Times New Roman', Times, serif;">
                We're excited to have you at Storm Wellness Club.
              </p>
              
              <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="font-style: italic; color: #6b7280; margin-bottom: 5px; font-family: Georgia, 'Times New Roman', Times, serif;">Warmly,</p>
                <p style="font-weight: 600; color: #1f2937; margin: 0; font-family: Georgia, 'Times New Roman', Times, serif;">Storm</p>
                <p style="color: #6b7280; margin: 0; font-family: Georgia, 'Times New Roman', Times, serif;">Founder, Storm Wellness Club</p>
              </div>
            </div>
            ${getEmailFooter()}
          </div>
        `;
        break;

      case 'approval_letter_personalized':
        // AI-generated personalized approval letter
        subject = data.customSubject || 'Welcome to Storm Wellness Club - Application Approved!';
        const customBody = data.customBody || '';
        // Convert plain text body to HTML paragraphs
        const formattedBody = customBody
          .split('\n\n')
          .filter((p: string) => p.trim())
          .map((p: string) => `<p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px; font-family: Georgia, 'Times New Roman', Times, serif;">${p.replace(/\n/g, '<br>')}</p>`)
          .join('');
        
        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            <div style="${emailStyles.content}">
              <h2 style="${emailStyles.heading}; font-family: Georgia, 'Times New Roman', Times, serif;">Dear ${data.name},</h2>
              
              ${formattedBody}
              
              <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="font-style: italic; color: #6b7280; margin-bottom: 5px; font-family: Georgia, 'Times New Roman', Times, serif;">Warmly,</p>
                <p style="font-weight: 600; color: #1f2937; margin: 0; font-family: Georgia, 'Times New Roman', Times, serif;">Storm</p>
                <p style="color: #6b7280; margin: 0; font-family: Georgia, 'Times New Roman', Times, serif;">Founder, Storm Wellness Club</p>
              </div>
            </div>
            <div style="${emailStyles.footer}">
              <p style="${emailStyles.muted}">
                Storm Wellness Club
              </p>
            </div>
          </div>
        `;
        break;

      case 'pwa_reinstall_instructions':
        subject = 'Important: Update Your Storm App';
        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            <div style="${emailStyles.content}; font-family: Georgia, 'Times New Roman', Times, serif;">
              <h2 style="${emailStyles.heading}; font-family: Georgia, 'Times New Roman', Times, serif;">Dear ${data.name},</h2>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px; font-family: Georgia, 'Times New Roman', Times, serif;">
                We've moved to our official domain! To ensure the best experience with your Storm Wellness Club app, 
                please follow the steps below to reinstall from our new address.
              </p>
              
              <div style="background: #dbeafe; border: 2px solid #3b82f6; border-radius: 8px; padding: 20px; margin: 25px 0;">
                <p style="margin: 0 0 15px 0; font-weight: 600; color: #1e40af; font-family: Georgia, 'Times New Roman', Times, serif; font-size: 16px;">
                  📱 For iPhone / iPad:
                </p>
                <ol style="margin: 0; padding-left: 20px; color: #1e40af; font-family: Georgia, 'Times New Roman', Times, serif;">
                  <li style="margin-bottom: 8px;">Delete the old "Storm" app from your home screen</li>
                  <li style="margin-bottom: 8px;">Open <strong>Safari</strong> and visit <strong>stormwellnessclub.com</strong></li>
                  <li style="margin-bottom: 8px;">Tap the <strong>Share</strong> button (□↑)</li>
                  <li>Tap <strong>"Add to Home Screen"</strong></li>
                </ol>
              </div>
              
              <div style="background: #dcfce7; border: 2px solid #22c55e; border-radius: 8px; padding: 20px; margin: 25px 0;">
                <p style="margin: 0 0 15px 0; font-weight: 600; color: #166534; font-family: Georgia, 'Times New Roman', Times, serif; font-size: 16px;">
                  📱 For Android:
                </p>
                <ol style="margin: 0; padding-left: 20px; color: #166534; font-family: Georgia, 'Times New Roman', Times, serif;">
                  <li style="margin-bottom: 8px;">Delete the old "Storm" app</li>
                  <li style="margin-bottom: 8px;">Open <strong>Chrome</strong> and visit <strong>stormwellnessclub.com</strong></li>
                  <li>Tap the menu (⋮) → <strong>"Install app"</strong></li>
                </ol>
              </div>
              
              <div style="background: #ecfdf5; border: 1px solid #10b981; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <p style="margin: 0; font-size: 14px; color: #065f46; font-family: Georgia, 'Times New Roman', Times, serif;">
                  <strong>✓ Your account, preferences, and membership are fully preserved.</strong><br>
                  Simply sign in with your email after reinstalling.
                </p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://stormwellnessclub.com" style="${emailStyles.button}; font-family: Georgia, 'Times New Roman', Times, serif; font-size: 16px;">Visit stormwellnessclub.com</a>
              </div>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px; font-family: Georgia, 'Times New Roman', Times, serif;">
                Thank you for being part of Storm Wellness Club!
              </p>
              
              <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="font-style: italic; color: #6b7280; margin-bottom: 5px; font-family: Georgia, 'Times New Roman', Times, serif;">Warmly,</p>
                <p style="font-weight: 600; color: #1f2937; margin: 0; font-family: Georgia, 'Times New Roman', Times, serif;">Storm Wellness Club Team</p>
              </div>
            </div>
            ${getEmailFooter()}
          </div>
        `;
        break;

      case 'phase_one_setup':
        // Phase 1: Pre-paid members who need to complete setup
        subject = 'Complete Your Membership Setup - Storm Opens February 9th';
        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            <div style="${emailStyles.content}">
              <h2 style="${emailStyles.heading}">Dear ${data.name},</h2>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                Thank you for your initiation fee payment! Your spot at Storm Wellness Club is secured.
              </p>
              
              <div style="background: #ecfdf5; border: 1px solid #10b981; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <p style="margin: 0; font-weight: 600; color: #065f46;">
                  ✓ Your <strong>${data.membershipTier}</strong> membership is confirmed
                </p>
                ${data.isFoundingMember ? `
                <p style="margin: 10px 0 0 0; color: #065f46;">
                  🌟 Founding Member Status: Exclusive perks await you!
                </p>
                ` : ''}
              </div>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                To be ready for opening day on <strong>February 9th, 2026</strong>, please complete these steps:
              </p>
              
              <ol style="line-height: 2.2; color: #374151; font-size: 16px; padding-left: 20px;">
                <li><strong>Sign in or create your account</strong> using: <span style="color: #C9A227;">${data.email || to}</span></li>
                <li>Go to the <strong>Waivers</strong> tab and sign the <strong>Liability Waiver</strong></li>
                <li>Sign your <strong>Membership Agreement</strong> (also in the Waivers tab)</li>
                <li>Go to <strong>Payment Methods</strong> and add your card, then <strong>set it as default</strong> for monthly dues</li>
                ${data.allowTierChange ? `
                <li><strong>Review your tier</strong> - You have one chance to change before we lock it in</li>
                ` : ''}
                <li>Check the <strong>My Membership</strong> tab to confirm all steps are complete</li>
              </ol>
              
              <p style="font-size: 14px; line-height: 1.6; color: #6b7280; margin: 20px 0;">
                <strong>Quick links:</strong><br/>
                <a href="${BASE_URL}/member/waivers" style="color: #C9A227;">Sign Waivers & Agreements →</a><br/>
                <a href="${BASE_URL}/member/payment-methods" style="color: #C9A227;">Add Payment Method →</a>
              </p>
              
              <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <p style="margin: 0; font-weight: 600; color: #374151;">
                  💳 Your first dues charge: <strong>February 9th, 2026</strong>
                </p>
                <p style="${emailStyles.muted}; margin: 8px 0 0 0;">
                  Your card will be securely saved but NOT charged until opening day.
                </p>
              </div>
              
              <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="font-style: italic; color: #6b7280; margin-bottom: 5px;">Warmly,</p>
                <p style="font-weight: 600; color: #1f2937; margin: 0;">Storm</p>
                <p style="color: #6b7280; margin: 0;">Founder, Storm Wellness Club</p>
              </div>
            </div>
            ${getEmailFooter()}
          </div>
        `;
        break;

      case 'waiver_reminder':
        subject = 'Action Required: Sign Your Waivers - Storm Wellness Club';
        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            <div style="${emailStyles.content}; font-family: Georgia, 'Times New Roman', Times, serif;">
              <h2 style="${emailStyles.heading}; font-family: Georgia, 'Times New Roman', Times, serif;">Hi ${data.name},</h2>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px; font-family: Georgia, 'Times New Roman', Times, serif;">
                We noticed you haven't signed your required waivers yet. Before you can use certain services at Storm Wellness Club, we need these documents on file.
              </p>
              
              <div style="${emailStyles.warningBox}">
                <p style="margin: 0 0 10px 0; font-weight: 600; color: #1C170F; font-family: Georgia, 'Times New Roman', Times, serif;">
                  📋 What You Need to Sign:
                </p>
                <ul style="margin: 0; padding-left: 20px; color: #374151; font-family: Georgia, 'Times New Roman', Times, serif;">
                  <li style="margin-bottom: 8px;"><strong>Liability Waiver</strong> — Required for all members</li>
                  <li style="margin-bottom: 8px;"><strong>Membership Agreement</strong> — Required for all members</li>
                </ul>
              </div>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px; font-family: Georgia, 'Times New Roman', Times, serif;">
                <strong>Optional waivers</strong> are also available for specific services you may want to use:
              </p>
              
              <ul style="color: #6b7280; font-size: 14px; margin: 0 0 20px 0; padding-left: 20px; font-family: Georgia, 'Times New Roman', Times, serif;">
                <li style="margin-bottom: 6px;">Kids Care Agreement — For childcare services</li>
                <li style="margin-bottom: 6px;">Guest Pass Agreement — To bring guests</li>
                <li style="margin-bottom: 6px;">Class Pass Agreement — For class packages</li>
                <li style="margin-bottom: 6px;">Spa & Wellness Agreement — For spa treatments</li>
              </ul>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${BASE_URL}/member/waivers" style="${emailStyles.button}; font-family: Georgia, 'Times New Roman', Times, serif; font-size: 16px;">
                  Sign Waivers Now
                </a>
              </div>
              
              <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <p style="margin: 0; font-weight: 600; color: #374151; font-family: Georgia, 'Times New Roman', Times, serif;">
                  📍 How to Sign:
                </p>
                <ol style="margin: 10px 0 0 0; padding-left: 20px; color: #6b7280; font-size: 14px; font-family: Georgia, 'Times New Roman', Times, serif;">
                  <li style="margin-bottom: 6px;">Log into your member portal</li>
                  <li style="margin-bottom: 6px;">Click on <strong>Waivers</strong> in the sidebar</li>
                  <li style="margin-bottom: 6px;">Review and sign each required document</li>
                </ol>
              </div>
              
              <p style="font-size: 14px; color: #6b7280; margin-top: 20px; font-family: Georgia, 'Times New Roman', Times, serif;">
                If you've already signed your waivers, you can disregard this email.
              </p>
              
              <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="font-style: italic; color: #6b7280; margin-bottom: 5px; font-family: Georgia, 'Times New Roman', Times, serif;">Warmly,</p>
                <p style="font-weight: 600; color: #1f2937; margin: 0; font-family: Georgia, 'Times New Roman', Times, serif;">Storm Wellness Club</p>
              </div>
            </div>
            ${getEmailFooter()}
          </div>
        `;
        break;

      case 'admin_payment_failed_alert':
        // Admin notification when a member's payment fails
        const alertAmount = data.amount ? `$${typeof data.amount === 'number' ? data.amount.toFixed(2) : data.amount}` : 'Unknown';
        const alertMemberName = data.memberName || 'Unknown Member';
        const alertMemberEmail = data.memberEmail || '';
        const alertMemberId = data.memberId || '';
        const alertFailureReason = data.failureReason || 'Payment declined';
        const alertSubscriptionType = data.subscriptionType || 'Membership Dues';
        const alertWillRetry = data.willRetry !== false;
        const alertNextRetryDate = data.nextRetryDate ? 
          new Date(data.nextRetryDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null;
        
        subject = `⚠️ Payment Failed - ${alertMemberName}`;
        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            <div style="${emailStyles.content}">
              <h2 style="${emailStyles.heading}">⚠️ Payment Failed Alert</h2>
              
              <div style="background: #fee2e2; border: 2px solid #ef4444; border-radius: 8px; padding: 20px; margin: 25px 0;">
                <p style="margin: 0 0 10px 0; font-weight: 600; color: #991b1b; font-size: 16px;">
                  A member's payment has failed and requires attention.
                </p>
              </div>
              
              <div style="background: #DEDACE; border: 1px solid #C1B19C; border-radius: 8px; padding: 20px; margin: 25px 0;">
                <h3 style="margin: 0 0 15px 0; color: #1C170F; font-family: Georgia, serif;">Payment Details</h3>
                <table style="width: 100%; border-collapse: collapse; font-family: Georgia, serif;">
                  <tr>
                    <td style="padding: 8px 0; color: #88766B;">Member</td>
                    <td style="padding: 8px 0; font-weight: 600; text-align: right; color: #1C170F;">${alertMemberName}</td>
                  </tr>
                  ${alertMemberEmail ? `
                  <tr>
                    <td style="padding: 8px 0; color: #88766B;">Email</td>
                    <td style="padding: 8px 0; font-weight: 600; text-align: right; color: #1C170F;">${alertMemberEmail}</td>
                  </tr>
                  ` : ''}
                  <tr>
                    <td style="padding: 8px 0; color: #88766B;">Charge Type</td>
                    <td style="padding: 8px 0; font-weight: 600; text-align: right; color: #1C170F;">${alertSubscriptionType}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #88766B;">Amount</td>
                    <td style="padding: 8px 0; font-weight: 600; text-align: right; font-size: 18px; color: #1C170F;">${alertAmount}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #88766B;">Reason</td>
                    <td style="padding: 8px 0; font-weight: 600; text-align: right; color: #991b1b;">${alertFailureReason}</td>
                  </tr>
                </table>
              </div>
              
              <div style="background: ${alertWillRetry ? '#fef3c7' : '#fee2e2'}; border: 1px solid ${alertWillRetry ? '#f59e0b' : '#ef4444'}; border-radius: 8px; padding: 20px; margin: 25px 0;">
                <p style="margin: 0; font-weight: 600; color: ${alertWillRetry ? '#92400e' : '#991b1b'};">
                  ${alertWillRetry 
                    ? `⏰ Status: Stripe will automatically retry ${alertNextRetryDate ? `on ${alertNextRetryDate}` : 'in 3-5 days'}`
                    : '❌ Status: No automatic retry scheduled - manual intervention required'}
                </p>
              </div>
              
              ${alertMemberId ? `
              <div style="text-align: center; margin: 30px 0;">
                <a href="${BASE_URL}/admin/members/${alertMemberId}" style="${emailStyles.button}">View Member</a>
              </div>
              ` : ''}
              
              <p style="font-size: 14px; color: #6b7280; margin-bottom: 20px;">
                Consider reaching out to the member to help them update their payment method.
              </p>
              
              <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="font-style: italic; color: #6b7280; margin-bottom: 5px;">Automated Alert</p>
                <p style="font-weight: 600; color: #1f2937; margin: 0;">Storm Wellness Club</p>
              </div>
            </div>
            ${getEmailFooter()}
          </div>
        `;
        break;

      case 'membership_cancelled':
        subject = 'Membership Cancellation Confirmation - Storm Wellness Club';
        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            <div style="${emailStyles.content}">
              <h2 style="${emailStyles.heading}">Dear ${data.name},</h2>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                This email confirms that your ${data.membershipTier ? `<strong>${data.membershipTier}</strong> ` : ''}membership at Storm Wellness Club has been cancelled.
              </p>
              
              ${data.cancellationDate ? `
              <div style="${emailStyles.infoBox}">
                <p style="margin: 0; font-weight: 600; color: #1C170F; font-family: Georgia, serif;">
                  Effective Date: ${data.cancellationDate}
                </p>
              </div>
              ` : ''}
              
              ${data.reason ? `
              <p style="font-size: 14px; line-height: 1.8; color: #6b7280; margin-bottom: 20px;">
                <em>Reason: ${data.reason}</em>
              </p>
              ` : ''}
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                We appreciate the time you spent as part of our community. Should you wish to rejoin in the future, we would be happy to welcome you back.
              </p>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                If you have any questions about your cancellation or would like to discuss your options, please don't hesitate to reach out to us at <a href="mailto:admin@stormwellnessclub.com" style="${emailStyles.link}">admin@stormwellnessclub.com</a>.
              </p>
              
              <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="font-style: italic; color: #6b7280; margin-bottom: 5px;">Warmly,</p>
                <p style="font-weight: 600; color: #1f2937; margin: 0;">Storm Wellness Club</p>
              </div>
            </div>
            ${getReceiptFooter()}
          </div>
        `;
        break;

      case 'application_cancelled':
        subject = 'Application Update - Storm Wellness Club';
        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            <div style="${emailStyles.content}">
              <h2 style="${emailStyles.heading}">Dear ${data.name},</h2>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                We're writing to let you know that your application to Storm Wellness Club has been cancelled.
              </p>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                If you're interested in joining in the future, you're welcome to reapply at any time.
              </p>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                If you have any questions, please feel free to reach out to us at <a href="mailto:admin@stormwellnessclub.com" style="${emailStyles.link}">admin@stormwellnessclub.com</a>.
              </p>
              
              <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="font-style: italic; color: #6b7280; margin-bottom: 5px;">Best regards,</p>
                <p style="font-weight: 600; color: #1f2937; margin: 0;">Storm Wellness Club</p>
              </div>
            </div>
            ${getReceiptFooter()}
          </div>
        `;
        break;

      case 'incomplete_membership_cancelled':
        subject = 'Membership Update - Storm Wellness Club';
        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            <div style="${emailStyles.content}">
              <h2 style="${emailStyles.heading}">Dear ${data.name},</h2>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                We're writing to let you know that your membership setup at Storm Wellness Club was not completed and has been cancelled.
              </p>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                If you have any questions, please don't hesitate to email us at <a href="mailto:admin@stormwellnessclub.com" style="${emailStyles.link}">admin@stormwellnessclub.com</a>.
              </p>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                If you'd like to rejoin in the future, you would need to submit a new application.
              </p>
              
              <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="font-style: italic; color: #6b7280; margin-bottom: 5px;">Best regards,</p>
                <p style="font-weight: 600; color: #1f2937; margin: 0;">Storm Wellness Club</p>
              </div>
            </div>
            ${getReceiptFooter()}
          </div>
        `;
        break;

      case 'guest_pass_promo':
        subject = "You're Invited to Bring a Guest This Month";
        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            <div style="${emailStyles.content}">
              <h2 style="${emailStyles.heading}">Dear ${data.name},</h2>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                We'd love for you to share the Storm Wellness experience with someone special. This month, you've been gifted a <strong>complimentary guest pass</strong> — on us.
              </p>
              
              <div style="${emailStyles.infoBox}">
                <p style="margin: 0; font-weight: 600; color: #1C170F; font-family: Georgia, serif; font-size: 18px;">
                  🎟️ 1 Complimentary Guest Pass
                </p>
                <p style="margin: 10px 0 0 0; color: #6C5D3E; font-size: 14px; font-family: Georgia, serif;">
                  Valid through the end of ${data.expiryMonth || 'this month'}. Includes full gym and amenity access for your guest.
                </p>
              </div>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                Register your guest through your member portal to reserve their visit. It only takes a moment.
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${BASE_URL}/member/credits" style="${emailStyles.button}">Register Your Guest</a>
              </div>
              
              <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="font-style: italic; color: #6b7280; margin-bottom: 5px;">Warmly,</p>
                <p style="font-weight: 600; color: #1f2937; margin: 0;">Storm Wellness Club</p>
              </div>
            </div>
            ${getEmailFooter()}
          </div>
        `;
        break;

      case 'guest_pass_credit_granted':
        subject = 'You Have a Complimentary Guest Pass!';
        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            <div style="${emailStyles.content}">
              <h2 style="${emailStyles.heading}">Dear ${data.name},</h2>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                Great news — you've received <strong>${data.credits_count} complimentary guest pass credit${data.credits_count > 1 ? 's' : ''}</strong> at Storm Wellness Club!
              </p>
              
              <div style="${emailStyles.infoBox}">
                <p style="margin: 0; font-weight: 600; color: #1C170F; font-family: Georgia, serif; font-size: 18px;">
                  🎟️ ${data.credits_count} Guest Pass Credit${data.credits_count > 1 ? 's' : ''}
                </p>
                <p style="margin: 10px 0 0 0; color: #6C5D3E; font-size: 14px; font-family: Georgia, serif;">
                  Valid through ${data.expires_date}. Includes full gym and amenity access for your guest.
                </p>
              </div>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 10px;">
                <strong>How to use your guest pass:</strong>
              </p>
              <ol style="font-size: 15px; line-height: 2; color: #374151; padding-left: 20px;">
                <li>Log in to your member portal</li>
                <li>Go to your Credits page</li>
                <li>Register your guest with their name, email, and phone number</li>
              </ol>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${BASE_URL}/member/credits" style="${emailStyles.button}">Register Your Guest</a>
              </div>
              
              <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="font-style: italic; color: #6b7280; margin-bottom: 5px;">Warmly,</p>
                <p style="font-weight: 600; color: #1f2937; margin: 0;">The Storm Wellness Club Team</p>
              </div>
            </div>
            ${getEmailFooter()}
          </div>
        `;
        break;

      case 'guest_visit_feedback':
        subject = 'How Was Your Visit to Storm Wellness Club?';
        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            <div style="${emailStyles.content}">
              <h2 style="${emailStyles.heading}">Dear ${data.name},</h2>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                Thank you for visiting Storm Wellness Club${data.visitDate ? ' on ' + data.visitDate : ' yesterday'}. We hope you enjoyed your time with us.
              </p>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                We'd love to hear about your experience — what stood out, what you enjoyed most, and anything we could do better. Your feedback helps us continue to elevate the experience for everyone who walks through our doors.
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${data.feedbackUrl || BASE_URL + '/guest-feedback?token=' + (data.feedbackToken || '')}" style="${emailStyles.button}">Share Your Feedback</a>
              </div>
              
              <div style="text-align: center; margin: 20px 0;">
                <a href="${BASE_URL}/guest-pass" style="${emailStyles.buttonSecondary}">Book Another Visit</a>
              </div>
              
              <p style="font-size: 15px; line-height: 1.8; color: #6b7280; margin-bottom: 20px; font-style: italic;">
                If you're interested in making Storm Wellness Club part of your routine, we'd love to tell you more about membership.
              </p>
              
              <div style="text-align: center; margin: 20px 0;">
                <a href="${BASE_URL}/memberships" style="${emailStyles.buttonSecondary}">Explore Membership</a>
              </div>
              
              <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="font-style: italic; color: #6b7280; margin-bottom: 5px;">Warmly,</p>
                <p style="font-weight: 600; color: #1f2937; margin: 0;">Storm Wellness Club</p>
              </div>
            </div>
            <div style="${emailStyles.footer}">
              <p style="${emailStyles.muted}">
                Storm Wellness Club · <a href="${BASE_URL}" style="color: #88766B;">stormwellnessclub.com</a>
              </p>
            </div>
          </div>
        `;
        break;

      case 'soft_launch_hours':
        subject = 'Soft Launch Hours - Storm Wellness Club';
        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            <div style="${emailStyles.content}">
              <h2 style="${emailStyles.heading}">Dear ${data.name || 'Member'},</h2>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                We're thrilled to welcome you during our soft launch week! Below are our temporary operating hours for <strong>February 16 – 22, 2026</strong>.
              </p>
              
              <div style="${emailStyles.infoBox}">
                <h3 style="margin: 0 0 12px 0; color: #1C170F; font-family: Georgia, serif; font-size: 16px;">🕐 Soft Launch Hours</h3>
                <table style="width: 100%; border-collapse: collapse; font-family: Georgia, serif;">
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #C1B19C; color: #1C170F;">Monday – Thursday</td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #C1B19C; color: #1C170F; text-align: right; font-weight: 600;">7:00 AM – 10:00 PM</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #C1B19C; color: #1C170F;">Friday</td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #C1B19C; color: #1C170F; text-align: right; font-weight: 600;">7:00 AM – 8:00 PM</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #1C170F;">Saturday – Sunday</td>
                    <td style="padding: 8px 0; color: #1C170F; text-align: right; font-weight: 600;">7:00 AM – 6:00 PM</td>
                  </tr>
                </table>
              </div>
              
              <p style="font-size: 14px; line-height: 1.6; color: #6b7280; margin-bottom: 20px; font-style: italic;">
                Regular hours will resume after February 22, 2026. We appreciate your flexibility as we fine-tune everything for you.
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${BASE_URL}/member/dashboard" style="${emailStyles.button}">Visit Member Portal</a>
              </div>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                We look forward to seeing you inside Storm Wellness Club.
              </p>
              
              <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="font-style: italic; color: #6b7280; margin-bottom: 5px;">Warmly,</p>
                <p style="font-weight: 600; color: #1f2937; margin: 0;">Storm Wellness Club</p>
              </div>
            </div>
            ${getEmailFooter()}
          </div>
        `;
        break;

      case 'staff_invite':
        subject = `You're Invited to Join the Storm Wellness Club Team`;
        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            <div style="${emailStyles.content}">
              <h2 style="${emailStyles.heading}">Welcome to the Team, ${data.firstName}!</h2>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                You've been invited to join Storm Wellness Club as <strong>${data.roles}</strong>.
              </p>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                To get started, create your staff account using the button below. Once your account is created, you'll be taken directly to your staff dashboard with all the tools assigned to your role.
              </p>
              
              <div style="${emailStyles.infoBox}">
                <p style="margin: 0; font-weight: 600; color: #1C170F; font-family: Georgia, serif;">
                  📧 Important: Please create your account using this email address to ensure your role is automatically assigned.
                </p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${BASE_URL}/auth?staff_invite=true&redirect=/admin" style="${emailStyles.button}">Create Your Staff Account</a>
              </div>
              
              <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="font-style: italic; color: #6b7280; margin-bottom: 5px;">Welcome aboard,</p>
                <p style="font-weight: 600; color: #1f2937; margin: 0;">Storm Wellness Club</p>
              </div>
            </div>
            ${getReceiptFooter()}
          </div>
        `;
        break;

      case 'account_activation_invite':
        subject = 'Access Your Class Passes — Storm Wellness Club';
        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            <div style="${emailStyles.content}">
              <h2 style="${emailStyles.heading}">${data.first_name ? `Hi ${data.first_name}, Your` : 'Your'} Class Passes Are Ready</h2>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                Thank you for your recent purchase at Storm Wellness Club. To access your class passes and start booking, please create your free account using the button below.
              </p>
              
              <div style="${emailStyles.infoBox}">
                <p style="margin: 0; font-weight: 600; color: #1C170F; font-family: Georgia, serif;">
                  📧 Important: Please create your account using this email address (<strong>${to}</strong>) to ensure your purchases are automatically linked.
                </p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${BASE_URL}/auth?redirect=/portal" style="${emailStyles.button}">Create Your Account</a>
              </div>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                Once your account is set up, you'll be able to:
              </p>
              <ul style="color: #374151; line-height: 2; padding-left: 20px;">
                <li>View and manage your class passes</li>
                <li>Browse and book available classes</li>
                <li>Track your booking history</li>
              </ul>
              
              <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="font-style: italic; color: #6b7280; margin-bottom: 5px;">Welcome,</p>
                <p style="font-weight: 600; color: #1f2937; margin: 0;">Storm Wellness Club</p>
              </div>
            </div>
            ${getEmailFooter()}
          </div>
        `;
        break;

      case 'guest_pass_purchase_confirmation':
        subject = 'Your Guest Pass is Confirmed — Storm Wellness Club';
        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            <div style="${emailStyles.content}">
              <h2 style="${emailStyles.heading}">Thank You, ${data.name || 'Guest'}!</h2>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                Your guest pass purchase has been confirmed. We're looking forward to welcoming you to Storm Wellness Club.
              </p>
              
              <div style="${emailStyles.successBox}">
                <h3 style="margin: 0 0 12px 0; color: #1C170F; font-family: Georgia, serif; font-size: 16px;">🎫 Guest Pass Details</h3>
                <table style="width: 100%; border-collapse: collapse; font-family: Georgia, serif;">
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #C1B19C; color: #6C5D3E;">Guest Name</td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #C1B19C; color: #1C170F; text-align: right; font-weight: 600;">${data.name || 'Guest'}</td>
                  </tr>
                  ${data.visitDate ? `
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #C1B19C; color: #6C5D3E;">Visit Date</td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #C1B19C; color: #1C170F; text-align: right; font-weight: 600;">${data.visitDate}</td>
                  </tr>
                  ` : ''}
                  <tr>
                    <td style="padding: 8px 0; color: #6C5D3E;">Amount Paid</td>
                    <td style="padding: 8px 0; color: #1C170F; text-align: right; font-weight: 600;">$${data.amountPaid || '60.00'}</td>
                  </tr>
                </table>
              </div>
              
              <div style="${emailStyles.infoBox}">
                <p style="margin: 0; font-weight: 600; color: #1C170F; font-family: Georgia, serif;">
                  📍 What to Expect
                </p>
                <ul style="color: #374151; line-height: 2; padding-left: 20px; margin: 10px 0 0 0;">
                  <li>Full access to the gym floor and amenities</li>
                  <li>Locker room and shower facilities</li>
                  <li>Access to our wellness amenities (subject to availability)</li>
                </ul>
              </div>
              
              <p style="font-size: 15px; line-height: 1.8; color: #6b7280; margin-bottom: 20px;">
                Please check in at the front desk upon arrival. A team member will be happy to show you around.
              </p>
              
              <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="font-style: italic; color: #6b7280; margin-bottom: 5px;">See you soon,</p>
                <p style="font-weight: 600; color: #1f2937; margin: 0;">Storm Wellness Club</p>
              </div>
            </div>
            ${getReceiptFooter()}
          </div>
        `;
        break;

      case 'payment_link_welcome':
        subject = 'Your Purchase is Confirmed — Set Up Your Account';
        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            <div style="${emailStyles.content}">
              <h2 style="${emailStyles.heading}">Hi ${data.name || 'there'},</h2>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                Thank you for your purchase! Your <strong>${data.productLabel || 'service'}</strong> has been confirmed.
              </p>

              <div style="${emailStyles.successBox}">
                <p style="margin: 0; font-weight: 600; color: #1C170F; font-family: Georgia, serif;">
                  ✓ Purchase confirmed: ${data.productLabel || 'Service'}
                </p>
              </div>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                We've created an account for you so you can manage your passes, sign your waiver, and book classes. Set your password below to get started:
              </p>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${data.resetUrl || BASE_URL + '/reset-password'}" style="${emailStyles.button}">Set Your Password</a>
              </div>

              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                Once your account is set up, you'll be able to:
              </p>
              <ul style="color: #374151; line-height: 2; padding-left: 20px;">
                <li>View and use your class passes</li>
                <li>Sign your liability waiver online</li>
                <li>Browse and book available classes</li>
                <li>Track your purchase and booking history</li>
                <li>Apply for a full membership when you're ready</li>
              </ul>
              
              <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="font-style: italic; color: #6b7280; margin-bottom: 5px;">Welcome,</p>
                <p style="font-weight: 600; color: #1f2937; margin: 0;">Storm Wellness Club</p>
              </div>
            </div>
            ${getEmailFooter()}
          </div>
        `;
        break;

      case 'referral_invite':
        subject = `${data.referrerName} invited you to Storm Wellness Club`;
        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            <div style="${emailStyles.content}">
              <h2 style="${emailStyles.heading}">You've Been Invited</h2>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                Your friend <strong>${data.referrerName}</strong> thinks you'd love Storm Wellness Club — and we think so too.
              </p>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                Storm is a members-only wellness club built for people who value intention, depth, and an environment that supports the whole person — physically, mentally, and through recovery.
              </p>
              
              <div style="${emailStyles.infoBox}">
                <p style="margin: 0 0 10px 0; font-weight: 600; color: #1C170F; font-family: Georgia, serif;">
                  What awaits you at Storm:
                </p>
                <ul style="margin: 0; padding-left: 20px; color: #374151; font-family: Georgia, serif; line-height: 2;">
                  <li>State-of-the-art fitness & recovery facilities</li>
                  <li>Red Light Therapy & Dry Cryotherapy</li>
                  <li>Reformer Pilates, Cycling & Heated Yoga</li>
                  <li>Full-service spa & wellness cafe</li>
                </ul>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${data.referralLink}" style="${emailStyles.button}">Apply Now</a>
              </div>
              
              <div style="${emailStyles.successBox}">
                <p style="margin: 0; text-align: center; font-family: Georgia, serif; color: #1C170F;">
                  Your personal referral code: <strong style="letter-spacing: 1px;">${data.referralCode}</strong>
                </p>
              </div>
              
              <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="font-style: italic; color: #6b7280; margin-bottom: 5px;">Warmly,</p>
                <p style="font-weight: 600; color: #1f2937; margin: 0;">Storm Wellness Club</p>
              </div>
            </div>
            ${getEmailFooter()}
          </div>
        `;
        break;

      case 'referral_notification':
        subject = `New Referral: ${data.referrerName} referred ${data.referredName}`;
        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            <div style="${emailStyles.content}">
              <h2 style="${emailStyles.heading}">New Member Referral</h2>
              <div style="${emailStyles.infoBox}">
                <p style="margin: 0 0 8px 0; font-family: Georgia, serif; color: #1C170F;">
                  <strong>Referred by:</strong> ${data.referrerName}
                </p>
                <p style="margin: 0 0 8px 0; font-family: Georgia, serif; color: #1C170F;">
                  <strong>Referred person:</strong> ${data.referredName}
                </p>
                <p style="margin: 0; font-family: Georgia, serif; color: #1C170F;">
                  <strong>Email:</strong> ${data.referredEmail}
                </p>
              </div>
              <p style="font-size: 14px; color: #6b7280; font-family: Georgia, serif;">
                An invitation email has been sent to the referred person automatically.
              </p>
            </div>
            ${getEmailFooter()}
          </div>
        `;
        break;

      case 'spa_review_request': {
        const reviewUrl = data.reviewUrl || `${BASE_URL}/review/spa/${data.token}`;
        const greetingName = data.name && String(data.name).trim() ? String(data.name).trim() : 'there';
        const visitLine = data.serviceName
          ? `your ${data.serviceName} visit${data.visitDate ? ' on ' + data.visitDate : ''}`
          : `your recent visit${data.visitDate ? ' on ' + data.visitDate : ''}`;
        subject = 'How was your visit to Storm Wellness Club?';
        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            <div style="${emailStyles.content}">
              <h2 style="${emailStyles.heading}">Hi ${greetingName},</h2>
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                Thank you for ${visitLine}. We hope it was restorative.
              </p>
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                If you have a moment, we'd love to hear how it went — your reflection helps us care for every guest who walks through our doors.
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${reviewUrl}" style="${emailStyles.button}">Leave a Review</a>
              </div>
              <p style="font-size: 13px; line-height: 1.6; color: #9ca3af; margin-top: 30px; text-align: center;">
                This link is private to your appointment and expires in 90 days.
              </p>
              <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="font-style: italic; color: #6b7280; margin-bottom: 5px;">Warmly,</p>
                <p style="font-weight: 600; color: #1f2937; margin: 0;">The Storm Wellness Club Team</p>
              </div>
            </div>
            ${getEmailFooter()}
          </div>
        `;
        break;
      }

      case 'dunning_day_0': {
        const firstName = data.first_name || data.name || 'Member';
        const amountStr = data.amount ? `$${Number(data.amount).toFixed(2)}` : 'your monthly Storm membership payment';
        const reasonStr = data.decline_reason || data.failureReason || 'the card on file could not be charged';
        const updateUrl = `${BASE_URL}/member/payment-methods${data.invoice_id ? `?retry=${encodeURIComponent(data.invoice_id)}` : ''}`;
        subject = 'A note regarding your Storm membership payment';
        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            <div style="${emailStyles.content}">
              <h2 style="${emailStyles.heading}">${firstName},</h2>
              <p style="font-size: 16px; line-height: 1.8; color: #1C170F; margin-bottom: 20px;">
                Your monthly Storm membership payment of ${amountStr} was unable to be processed today (${reasonStr}). Your account is currently past due, and member privileges &mdash; including monthly credits and member pricing &mdash; are paused until the balance is resolved.
              </p>
              <p style="font-size: 16px; line-height: 1.8; color: #1C170F; margin-bottom: 10px;">
                You may update your payment method at any time:
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${updateUrl}" style="${emailStyles.button}">Update Payment Method</a>
              </div>
              <p style="font-style: italic; ${emailStyles.muted} margin-top: 30px;">
                For assistance, email <a href="mailto:admin@stormwellnessclub.com" style="${emailStyles.link}">admin@stormwellnessclub.com</a> or message Member Services from your portal.
              </p>
              <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #C1B19C;">
                <p style="font-weight: 600; color: #1C170F; margin: 0;">&mdash; The Storm Wellness Club Team</p>
              </div>
            </div>
            ${getEmailFooter()}
          </div>
        `;
        break;
      }

      case 'dunning_recovered': {
        const firstName = data.first_name || data.name || 'Member';
        const amountStr = data.amount ? `$${Number(data.amount).toFixed(2)}` : 'your outstanding balance';
        subject = 'Payment received \u2014 welcome back';
        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            <div style="${emailStyles.content}">
              <h2 style="${emailStyles.heading}">${firstName},</h2>
              <p style="font-size: 16px; line-height: 1.8; color: #1C170F; margin-bottom: 20px;">
                Your payment of ${amountStr} has been received and your Storm membership is once again in good standing. Full member privileges have been restored.
              </p>
              <p style="font-size: 16px; line-height: 1.8; color: #1C170F; margin-bottom: 20px;">
                Thank you, and we look forward to seeing you at the Club.
              </p>
              <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #C1B19C;">
                <p style="font-weight: 600; color: #1C170F; margin: 0;">&mdash; The Storm Wellness Club Team</p>
              </div>
            </div>
            ${getEmailFooter()}
          </div>
        `;
        break;
      }

      case 'dunning_day_1': {
        const firstName = data.first_name || data.name || 'Member';
        const amountStr = data.amount ? `$${Number(data.amount).toFixed(2)}` : 'your outstanding balance';
        const failedDateStr = data.failed_date || 'the original billing date';
        const updateUrl = `${BASE_URL}/member/payment-methods${data.invoice_id ? `?retry=${encodeURIComponent(data.invoice_id)}` : ''}`;
        subject = 'Your Storm account remains past due';
        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            <div style="${emailStyles.content}">
              <h2 style="${emailStyles.heading}">${firstName},</h2>
              <p style="font-size: 16px; line-height: 1.8; color: #1C170F; margin-bottom: 20px;">
                A brief reminder that the outstanding balance of ${amountStr} from ${failedDateStr} has not yet been resolved. Your account remains past due.
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${updateUrl}" style="${emailStyles.button}">Resolve Balance</a>
              </div>
              <p style="font-style: italic; ${emailStyles.muted} margin-top: 30px;">
                For assistance, email <a href="mailto:admin@stormwellnessclub.com" style="${emailStyles.link}">admin@stormwellnessclub.com</a> or message Member Services from your portal.
              </p>
              <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #C1B19C;">
                <p style="font-weight: 600; color: #1C170F; margin: 0;">&mdash; The Storm Wellness Club Team</p>
              </div>
            </div>
            ${getEmailFooter()}
          </div>
        `;
        break;
      }

      case 'dunning_day_3': {
        const firstName = data.first_name || data.name || 'Member';
        const amountStr = data.amount ? `$${Number(data.amount).toFixed(2)}` : 'your outstanding balance';
        const failedDateStr = data.failed_date || 'the original billing date';
        const updateUrl = `${BASE_URL}/member/payment-methods${data.invoice_id ? `?retry=${encodeURIComponent(data.invoice_id)}` : ''}`;
        subject = 'Past due \u2014 action required to preserve your Storm membership';
        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            <div style="${emailStyles.content}">
              <h2 style="${emailStyles.heading}">${firstName},</h2>
              <p style="font-size: 16px; line-height: 1.8; color: #1C170F; margin-bottom: 20px;">
                Your Storm membership has been past due for three days. Member privileges remain suspended, and an outstanding balance of ${amountStr} is owed from ${failedDateStr}.
              </p>
              <p style="font-size: 16px; line-height: 1.8; color: #1C170F; margin-bottom: 20px;">
                Per the terms of your membership agreement, contractual dues continue to accrue while your account is in arrears and remain your responsibility regardless of access. Should the balance remain unresolved, your acceptance into the Club may be forfeited &mdash; at which point reinstatement would require submitting a new application for review.
              </p>
              <p style="font-size: 16px; line-height: 1.8; color: #1C170F; margin-bottom: 10px;">
                We would be glad to keep your standing intact. Resolving the balance restores full benefits immediately:
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${updateUrl}" style="${emailStyles.button}">Update Payment Method</a>
              </div>
              <p style="font-style: italic; ${emailStyles.muted} margin-top: 30px;">
                For assistance, email <a href="mailto:admin@stormwellnessclub.com" style="${emailStyles.link}">admin@stormwellnessclub.com</a> or message Member Services from your portal.
              </p>
              <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #C1B19C;">
                <p style="font-weight: 600; color: #1C170F; margin: 0;">&mdash; The Storm Wellness Club Team</p>
              </div>
            </div>
            ${getEmailFooter()}
          </div>
        `;
        break;
      }

      case 'dunning_day_5': {
        const firstName = data.first_name || data.name || 'Member';
        const amountStr = data.amount ? `$${Number(data.amount).toFixed(2)}` : 'your outstanding balance';
        const failedDateStr = data.failed_date || 'the original billing date';
        const updateUrl = `${BASE_URL}/member/payment-methods${data.invoice_id ? `?retry=${encodeURIComponent(data.invoice_id)}` : ''}`;
        subject = 'Action required: Storm membership in arrears';
        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            <div style="${emailStyles.content}">
              <h2 style="${emailStyles.heading}">${firstName},</h2>
              <p style="font-size: 16px; line-height: 1.8; color: #1C170F; margin-bottom: 20px;">
                Your account has now been past due for five days. Despite our prior attempts to process payment, the ${amountStr} balance from ${failedDateStr} remains outstanding.
              </p>
              <p style="font-size: 16px; line-height: 1.8; color: #1C170F; margin-bottom: 20px;">
                We kindly ask that you update your payment method at your earliest convenience to bring your account current and restore the full benefits of membership.
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${updateUrl}" style="${emailStyles.button}">Update Payment Method</a>
              </div>
              <p style="font-style: italic; ${emailStyles.muted} margin-top: 30px;">
                For assistance, email <a href="mailto:admin@stormwellnessclub.com" style="${emailStyles.link}">admin@stormwellnessclub.com</a> or message Member Services from your portal.
              </p>
              <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #C1B19C;">
                <p style="font-weight: 600; color: #1C170F; margin: 0;">&mdash; The Storm Wellness Club Team</p>
              </div>
            </div>
            ${getEmailFooter()}
          </div>
        `;
        break;
      }

      case 'dunning_day_7': {
        const firstName = data.first_name || data.name || 'Member';
        const amountStr = data.amount ? `$${Number(data.amount).toFixed(2)}` : 'your outstanding balance';
        const failedDateStr = data.failed_date || 'the original billing date';
        const updateUrl = `${BASE_URL}/member/payment-methods${data.invoice_id ? `?retry=${encodeURIComponent(data.invoice_id)}` : ''}`;
        subject = 'Immediate Action Required';
        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            <div style="${emailStyles.content}">
              <h2 style="${emailStyles.heading}">${firstName},</h2>
              <p style="font-size: 16px; line-height: 1.8; color: #1C170F; margin-bottom: 20px;">
                We have made several attempts over the past week to resolve the ${amountStr} balance outstanding on your Storm membership since ${failedDateStr}. Per your membership agreement, dues continue to accrue and remain your contractual responsibility. To preserve your standing at the Club and avoid further review of your membership, we ask that you take a moment to resolve the balance today:
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${updateUrl}" style="${emailStyles.button}">Resolve Balance</a>
              </div>
              <p style="font-size: 16px; line-height: 1.8; color: #1C170F; margin-top: 20px;">
                Should circumstances warrant a conversation about your account, we welcome you to reach us directly at <a href="mailto:admin@stormwellnessclub.com" style="${emailStyles.link}">admin@stormwellnessclub.com</a> or through Member Services in your portal.
              </p>
              <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #C1B19C;">
                <p style="font-weight: 600; color: #1C170F; margin: 0;">&mdash; The Storm Wellness Club Team</p>
              </div>
            </div>
            ${getEmailFooter()}
          </div>
        `;
        break;
      }

      case 'renewal_monthly_dues_3day':
      case 'renewal_annual_dues_14day':
      case 'renewal_annual_fee_14day':
      case 'renewal_annual_fee_3day': {
        const firstName = data.first_name || data.name || 'Member';
        const amountStr = data.amount ? `$${Number(data.amount).toFixed(2)}` : 'your scheduled amount';
        const chargeDate = data.charge_date || 'your next billing date';
        const cardBrand = data.card_brand || 'card on file';
        const last4 = data.card_last4 ? ` ending in ${data.card_last4}` : '';
        const updateUrl = `${BASE_URL}/member/payment-methods`;

        let body = '';
        if (type === 'renewal_monthly_dues_3day') {
          subject = 'Your upcoming Storm monthly dues';
          body = `This is a courtesy reminder that your Storm monthly dues of ${amountStr} are scheduled to be charged on <strong>${chargeDate}</strong> to your ${cardBrand}${last4}. No action is needed if everything looks correct &mdash; we simply wish to keep you informed.`;
        } else if (type === 'renewal_annual_dues_14day') {
          subject = 'Your Storm annual dues renew in 14 days';
          body = `As a courtesy, we are writing to let you know that your Storm annual dues of ${amountStr} are scheduled to renew on <strong>${chargeDate}</strong>, billed to your ${cardBrand}${last4}. Should you wish to review or update the payment method on file, you may do so at any time.`;
        } else if (type === 'renewal_annual_fee_14day') {
          subject = 'Your Storm annual fee renews in 14 days';
          body = `This is a courtesy notice that your Storm annual fee of ${amountStr} &mdash; the yearly facility fee billed separately from your dues &mdash; is scheduled to renew on <strong>${chargeDate}</strong> to your ${cardBrand}${last4}.`;
        } else {
          subject = 'Reminder: Storm annual fee charges in 3 days';
          body = `A brief reminder that your Storm annual fee of ${amountStr} will post to your ${cardBrand}${last4} on <strong>${chargeDate}</strong>. If you wish to update the payment method on file, please do so before that date.`;
        }

        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            <div style="${emailStyles.content}">
              <h2 style="${emailStyles.heading}">${firstName},</h2>
              <p style="font-size: 16px; line-height: 1.8; color: #1C170F; margin-bottom: 20px;">
                ${body}
              </p>
              <p style="font-size: 16px; line-height: 1.8; color: #1C170F; margin-bottom: 10px;">
                To review or update the payment method on file:
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${updateUrl}" style="${emailStyles.button}">Update Payment Method</a>
              </div>
              <p style="font-style: italic; ${emailStyles.muted} margin-top: 30px;">
                For assistance, email <a href="mailto:admin@stormwellnessclub.com" style="${emailStyles.link}">admin@stormwellnessclub.com</a> or message Member Services from your portal.
              </p>
              <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #C1B19C;">
                <p style="font-weight: 600; color: #1C170F; margin: 0;">&mdash; The Storm Wellness Club Team</p>
              </div>
            </div>
            ${getEmailFooter()}
          </div>
        `;
        break;
      }

      case 'past_due_formal_notice': {
        const firstName = data.first_name || 'Member';
        const lastName = data.last_name || '';
        const memberEmail = data.member_email || to;
        const tier = data.tier || 'Membership';
        const totalOwed = Number(data.total_owed || 0).toFixed(2);
        const monthsLate = data.months_late ?? '—';
        const oldestDueDate = data.oldest_due_date || '—';
        const cardBrand = data.card_brand || 'card on file';
        const last4 = data.card_last4 ? `ending in ${data.card_last4}` : '(no card on file)';
        const lastAttemptDate = data.last_attempt_date || '—';
        const invoices: Array<{ period: string; amount: number | string; days_overdue?: number | string }> = Array.isArray(data.unpaid_invoices) ? data.unpaid_invoices : [];
        const portalUrl = `${BASE_URL}/member/payment-methods`;

        const itemsHtml = invoices.length
          ? `<table style="width:100%; border-collapse: collapse; margin: 10px 0;">
              <thead>
                <tr style="background:#DEDACE;">
                  <th align="left" style="padding:8px; border:1px solid #C1B19C; font-family:Georgia,serif; font-size:14px;">Period</th>
                  <th align="right" style="padding:8px; border:1px solid #C1B19C; font-family:Georgia,serif; font-size:14px;">Amount</th>
                  <th align="right" style="padding:8px; border:1px solid #C1B19C; font-family:Georgia,serif; font-size:14px;">Days Overdue</th>
                </tr>
              </thead>
              <tbody>
                ${invoices.map(inv => `
                  <tr>
                    <td style="padding:8px; border:1px solid #C1B19C; font-family:Georgia,serif; font-size:14px;">${inv.period}</td>
                    <td align="right" style="padding:8px; border:1px solid #C1B19C; font-family:Georgia,serif; font-size:14px;">$${Number(inv.amount).toFixed(2)}</td>
                    <td align="right" style="padding:8px; border:1px solid #C1B19C; font-family:Georgia,serif; font-size:14px;">${inv.days_overdue ?? '—'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>`
          : '';

        subject = 'Past-Due Membership Balance — Immediate Payment Required';
        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            <div style="${emailStyles.content}">
              <h2 style="${emailStyles.heading}">${firstName} ${lastName},</h2>
              <p style="font-size: 16px; line-height: 1.8; color: #1C170F; margin-bottom: 20px;">
                Our records indicate that your Storm Wellness Club membership account is past due. Despite multiple billing attempts, the following balance remains outstanding:
              </p>
              <div style="${emailStyles.warningBox}">
                <p style="margin:4px 0; font-family:Georgia,serif; color:#1C170F;"><strong>Account:</strong> ${memberEmail}</p>
                <p style="margin:4px 0; font-family:Georgia,serif; color:#1C170F;"><strong>Membership Tier:</strong> ${tier}</p>
                <p style="margin:4px 0; font-family:Georgia,serif; color:#1C170F;"><strong>Outstanding Balance:</strong> $${totalOwed}</p>
                <p style="margin:4px 0; font-family:Georgia,serif; color:#1C170F;"><strong>Months Past Due:</strong> ${monthsLate} (since ${oldestDueDate})</p>
                <p style="margin:4px 0; font-family:Georgia,serif; color:#1C170F;"><strong>Card on File:</strong> ${cardBrand} ${last4} — last declined ${lastAttemptDate}</p>
              </div>
              ${itemsHtml ? `<p style="font-size:16px; color:#1C170F; margin-bottom:6px;"><strong>Itemized balance:</strong></p>${itemsHtml}` : ''}
              <p style="font-size: 16px; line-height: 1.8; color: #1C170F; margin-top: 24px;">
                Per the Membership Agreement you signed at enrollment, you are responsible for all monthly dues for the duration of your membership term, regardless of usage or attendance.
              </p>
              <p style="font-size: 16px; line-height: 1.8; color: #1C170F; margin-top: 20px;">
                <strong>Required action within 7 days of this notice:</strong><br/>
                Remit the full balance of <strong>$${totalOwed}</strong> by updating your payment method and authorizing the charge at the link below, or by contacting our billing office directly.
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${portalUrl}" style="${emailStyles.button}">Pay Outstanding Balance</a>
              </div>
              <p style="font-size: 16px; line-height: 1.8; color: #1C170F; margin-top: 20px;">
                <strong>Failure to resolve this balance will result in:</strong>
              </p>
              <ol style="font-size: 15px; line-height: 1.8; color: #1C170F; padding-left: 22px;">
                <li>Assessment of a <strong>$25 late fee</strong> per outstanding month, added to your balance.</li>
                <li><strong>Revocation of membership acceptance</strong>, including loss of any founding-member status, tier benefits, accrued credits, and class reservations.</li>
                <li>Continued responsibility for the <strong>full unpaid balance</strong>, which will be referred to a third-party collections agency and reported accordingly.</li>
                <li>Permanent forfeiture of eligibility to re-apply for membership at Storm Wellness Club.</li>
              </ol>
              <p style="font-size: 16px; line-height: 1.8; color: #1C170F; margin-top: 20px;">
                Cancellation of your membership does not release you from amounts already owed for periods in which your membership was active.
              </p>
              <p style="font-size: 16px; line-height: 1.8; color: #1C170F; margin-top: 20px;">
                If you believe this notice is in error, or if you wish to discuss a payment arrangement, contact our billing office immediately at <a href="mailto:admin@stormwellnessclub.com" style="${emailStyles.link}">admin@stormwellnessclub.com</a> or reply to this email.
              </p>
              <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #C1B19C;">
                <p style="font-weight: 600; color: #1C170F; margin: 0;">Sincerely,</p>
                <p style="font-weight: 600; color: #1C170F; margin: 4px 0 0;">Storm Wellness Club — Billing Office</p>
                <p style="color: #88766B; font-size: 13px; margin: 4px 0 0;">stormwellnessclub.com</p>
              </div>
            </div>
            ${getEmailFooter()}
          </div>
        `;
        break;
      }

      case 'card_expiring': {
        const firstName = data.first_name || 'Member';
        const cardBrand = data.card_brand || 'Card';
        const last4 = data.card_last4 || '••••';
        const expMonth = String(data.exp_month ?? '').padStart(2, '0');
        const expYear = String(data.exp_year ?? '').slice(-2);
        const nextBillingDate = data.next_billing_date || 'your next billing date';
        const nextAmount = data.next_amount != null ? `$${Number(data.next_amount).toFixed(2)}` : null;
        const daysOut = Number(data.days_out ?? 60);
        const portalUrl = `${BASE_URL}/member/payment-methods`;
        const urgencyNote = daysOut <= 7
          ? `Your card expires within the next week. Please update immediately to prevent a failed charge.`
          : daysOut <= 30
            ? `Your card expires within the next 30 days.`
            : `Your card expires within the next two months.`;

        subject = `Your card on file expires soon — update to avoid interruption`;
        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            <div style="${emailStyles.content}">
              <h2 style="${emailStyles.heading}">Hi ${firstName},</h2>
              <p style="font-size: 16px; line-height: 1.8; color: #1C170F; margin-bottom: 20px;">
                The credit card we have on file for your Storm Wellness Club membership is expiring soon. ${urgencyNote}
              </p>
              <div style="${emailStyles.warningBox}">
                <p style="margin:4px 0; font-family:Georgia,serif; color:#1C170F;"><strong>Card:</strong> ${cardBrand} ending in ${last4}</p>
                <p style="margin:4px 0; font-family:Georgia,serif; color:#1C170F;"><strong>Expires:</strong> ${expMonth}/${expYear}</p>
                ${nextAmount ? `<p style="margin:4px 0; font-family:Georgia,serif; color:#1C170F;"><strong>Next charge:</strong> ${nextBillingDate} — ${nextAmount}</p>` : `<p style="margin:4px 0; font-family:Georgia,serif; color:#1C170F;"><strong>Next charge:</strong> ${nextBillingDate}</p>`}
              </div>
              <p style="font-size: 16px; line-height: 1.8; color: #1C170F; margin-top: 20px;">
                To avoid a failed payment and any interruption to your membership benefits — including class bookings, recovery services, and club access — please update your payment method before your next billing date.
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${portalUrl}" style="${emailStyles.button}">Update Payment Method</a>
              </div>
              <p style="font-size: 15px; line-height: 1.7; color: #1C170F; margin-top: 20px;">
                If your card has already been replaced, updating now takes less than a minute and prevents late fees or service holds.
              </p>
              <p style="font-size: 15px; line-height: 1.7; color: #1C170F; margin-top: 20px;">
                Questions? Reply to this email or contact us at <a href="mailto:admin@stormwellnessclub.com" style="${emailStyles.link}">admin@stormwellnessclub.com</a>.
              </p>
              <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #C1B19C;">
                <p style="font-weight: 600; color: #1C170F; margin: 0;">— Storm Wellness Club</p>
                <p style="color: #88766B; font-size: 13px; margin: 4px 0 0;">stormwellnessclub.com</p>
              </div>
            </div>
            ${getEmailFooter()}
          </div>
        `;
        break;
      }

      case 'waitlist_joined': {
        subject = `You're on the waitlist — ${data.className}`;
        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            <div style="${emailStyles.content}">
              <h2 style="${emailStyles.heading}">You're on the Waitlist</h2>
              <p>We've added you to the waitlist for <strong>${data.className}</strong> on <strong>${data.date}</strong> at <strong>${data.time}</strong>${data.position ? `. You're #${data.position} in line.` : '.'}</p>
              <div style="${emailStyles.infoBox}">
                <p style="margin: 0; color: #1C170F; font-size: 14px;">
                  If a spot opens, we'll text and email you and your held credit will be applied automatically. If the spot doesn't open, your credit will be refunded.
                </p>
              </div>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${BASE_URL}/member/bookings" style="${emailStyles.button}">View My Bookings</a>
              </div>
              <p style="margin: 30px 0 5px 0; color: #1C170F;">— The Storm Wellness Club Team</p>
            </div>
            ${getEmailFooter()}
          </div>
        `;
        break;
      }

      case 'spa_appointment_confirmation': {
        subject = `Spa appointment confirmed — ${data.service}`;
        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            <div style="${emailStyles.content}">
              <h2 style="${emailStyles.heading}">Appointment Confirmed ✓</h2>
              <p>Looking forward to seeing you. Here are the details:</p>
              <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr><td style="padding: 8px 0; color: #6b7280;">Service</td><td style="padding: 8px 0; font-weight: 600;">${data.service}</td></tr>
                  <tr><td style="padding: 8px 0; color: #6b7280;">Date</td><td style="padding: 8px 0; font-weight: 600;">${data.date}</td></tr>
                  <tr><td style="padding: 8px 0; color: #6b7280;">Time</td><td style="padding: 8px 0; font-weight: 600;">${data.time}</td></tr>
                  ${data.provider ? `<tr><td style="padding: 8px 0; color: #6b7280;">With</td><td style="padding: 8px 0; font-weight: 600;">${data.provider}</td></tr>` : ''}
                  ${data.duration ? `<tr><td style="padding: 8px 0; color: #6b7280;">Duration</td><td style="padding: 8px 0; font-weight: 600;">${data.duration} min</td></tr>` : ''}
                </table>
              </div>
              <div style="background: #FEF8E7; border-left: 3px solid #D4A84B; border-radius: 6px; padding: 14px 16px; margin: 20px 0;">
                <p style="margin: 0 0 4px 0; font-weight: 600; color: #1C170F; font-size: 14px;">Arrival</p>
                <p style="margin: 0; color: #4B4537; font-size: 13px; line-height: 1.5;">Please arrive 10 minutes early to settle in. Cancellations within 24 hours may incur a fee.</p>
              </div>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${BASE_URL}/member/bookings" style="${emailStyles.button}">View My Appointments</a>
              </div>
              <p style="margin: 30px 0 5px 0; color: #1C170F;">— The Storm Wellness Club Team</p>
            </div>
            ${getEmailFooter()}
          </div>
        `;
        break;
      }

      case 'spa_appointment_reminder': {
        const when = data.window === '2h' ? 'in 2 hours' : 'tomorrow';
        subject = `Reminder — your spa appointment is ${when}`;
        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            <div style="${emailStyles.content}">
              <h2 style="${emailStyles.heading}">Reminder: ${data.service}</h2>
              <p>This is a friendly reminder that your appointment is <strong>${when}</strong>.</p>
              <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr><td style="padding: 8px 0; color: #6b7280;">Service</td><td style="padding: 8px 0; font-weight: 600;">${data.service}</td></tr>
                  <tr><td style="padding: 8px 0; color: #6b7280;">Date</td><td style="padding: 8px 0; font-weight: 600;">${data.date}</td></tr>
                  <tr><td style="padding: 8px 0; color: #6b7280;">Time</td><td style="padding: 8px 0; font-weight: 600;">${data.time}</td></tr>
                  ${data.provider ? `<tr><td style="padding: 8px 0; color: #6b7280;">With</td><td style="padding: 8px 0; font-weight: 600;">${data.provider}</td></tr>` : ''}
                </table>
              </div>
              <p style="${emailStyles.muted}">Need to reschedule? <a href="${BASE_URL}/member/bookings" style="${emailStyles.link}">Manage your appointment</a>.</p>
              <p style="margin: 30px 0 5px 0; color: #1C170F;">— The Storm Wellness Club Team</p>
            </div>
            ${getEmailFooter()}
          </div>
        `;
        break;
      }

      case 'spa_appointment_cancellation': {
        subject = `Spa appointment cancelled — ${data.service}`;
        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            <div style="${emailStyles.content}">
              <h2 style="${emailStyles.heading}">Appointment Cancelled</h2>
              <p>Your <strong>${data.service}</strong> appointment on <strong>${data.date}</strong> at <strong>${data.time}</strong> has been cancelled.${data.refundNote ? ` ${data.refundNote}` : ''}</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${BASE_URL}/member/spa" style="${emailStyles.button}">Book Again</a>
              </div>
              <p style="margin: 30px 0 5px 0; color: #1C170F;">— The Storm Wellness Club Team</p>
            </div>
            ${getEmailFooter()}
          </div>
        `;
        break;
      }

      case 'custom_message': {
        subject = String(data?.subject || 'A message from Storm Wellness Club');
        const bodyHtml = String(data?.bodyHtml || '');
        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            <div style="${emailStyles.content}">
              ${bodyHtml}
            </div>
            ${getEmailFooter()}
          </div>
        `;
        break;
      }

      default:

        throw new Error(`Unknown email type: ${type}`);
    }

    // Use named sender for application emails
    const senderAddress = type === 'application_submitted'
      ? 'Storm Wellness Club <membership@stormwellnessclub.com>'
      : 'Storm Wellness Club <admin@stormwellnessclub.com>';

    const sendPayload: any = {
      from: senderAddress,
      to: [to],
      subject,
      html,
    };
    if (data?.replyTo) sendPayload.reply_to = String(data.replyTo);

    const emailResponse = await resend.emails.send(sendPayload);


    console.log("Email sent successfully:", emailResponse);

    // Log to email_audit_log for tracking
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
      
      await supabaseAdmin.from('email_audit_log').insert({
        email_type: type,
        recipient_email: to,
        recipient_name: data?.name || data?.first_name || null,
        subject,
        status: 'sent',
        sent_at: new Date().toISOString(),
        trigger_source: 'send-email-function',
        template_data: data || null,
      });
    } catch (auditErr) {
      console.warn("Failed to log email audit:", auditErr);
      // Don't fail the response if audit logging fails
    }

    return new Response(
      JSON.stringify({ success: true, data: emailResponse }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: unknown) {
    console.error("Error sending email:", error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
