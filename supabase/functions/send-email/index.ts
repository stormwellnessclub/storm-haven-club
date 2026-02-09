import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailRequest {
  type: 'application_submitted' | 'approval_with_deadline' | 'approval_letter' | 'approval_letter_personalized' | 'application_rejected' | 'booking_confirmation' | 'booking_cancellation' | 'waiver_reminder' | 'class_reminder' | 'waitlist_notification' | 'waitlist_claim_confirmation' | 'activation_reminder_day3' | 'activation_reminder_day5' | 'membership_activated' | 'payment_update_request' | 'charge_confirmation' | 'application_approved_locked_date' | 'add_card_for_dues' | 'staff_reply' | 'payment_failed' | 'freeze_completed' | 'annual_fee_payment_request' | 'annual_fee_final_notice' | 'setup_instructions' | 'member_activation_setup' | 'pwa_reinstall_instructions' | 'phase_one_setup' | 'waiver_reminder_email' | 'admin_payment_failed_alert' | 'membership_scheduled';
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
    console.log(`Processing email type: ${type} for: ${to}`);

    let subject = '';
    let html = '';

    switch (type) {
      case 'application_submitted':
        subject = 'Application Received - Storm Wellness Club';
        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            <div style="${emailStyles.content}">
              <h2 style="${emailStyles.heading}">Thank you for applying, ${data.name}!</h2>
              <p>We have received your membership application for the <strong>${data.membershipPlan}</strong> plan.</p>
              <p>Our team will review your application and get back to you within 2-3 business days.</p>
              <p>In the meantime, feel free to explore our facilities and class offerings:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${BASE_URL}/classes" style="${emailStyles.button}">View Classes</a>
                <a href="${BASE_URL}/amenities" style="${emailStyles.buttonSecondary}">Explore Amenities</a>
              </div>
            </div>
            ${getEmailFooter()}
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
                We are currently finalizing the last details before our opening. Please keep an eye out in the coming days for more emails from us with instructions on how to create your account and complete your membership setup.
              </p>
              
              <div style="background: #DEDACE; border: 1px solid #C1B19C; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <p style="margin: 0; font-weight: 600; color: #1C170F; font-family: Georgia, serif;">
                  ✓ Your spot is secured as a <strong>${data.membershipTier}</strong> member.
                </p>
              </div>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                Thank you for your patience as we prepare to welcome you.
              </p>
              
              <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="font-style: italic; color: #6b7280; margin-bottom: 5px;">Warmly,</p>
                <p style="font-weight: 600; color: #1f2937; margin: 0;">Storm</p>
                <p style="color: #6b7280; margin: 0;">Founder, Storm Wellness Club</p>
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
                </table>
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
              <p>Your booking has been cancelled:</p>
              <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin: 20px 0;">
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
                </table>
              </div>
              ${data.creditRefunded ? '<p style="color: #10b981; font-weight: 500;">✓ Your class credit has been refunded.</p>' : ''}
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
                If you have any further questions or concerns, please don't hesitate to reach out to us through your member portal.
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${BASE_URL}/member/support" style="${emailStyles.button}">Contact Support</a>
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

      case 'member_activation_setup':
      case 'setup_instructions':
        subject = 'Action Required: Complete Your Membership Setup - Storm Wellness Club';
        const launchDate = data.launchDate || 'February 9, 2026';
        const hasCardOnFile = data.hasCardOnFile || false;
        const hasSignedAgreement = data.hasSignedAgreement || false;
        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            <div style="${emailStyles.content}; font-family: Georgia, 'Times New Roman', Times, serif;">
              <h2 style="${emailStyles.heading}; font-family: Georgia, 'Times New Roman', Times, serif;">Dear ${data.name},</h2>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px; font-family: Georgia, 'Times New Roman', Times, serif;">
                We're excited to announce that Storm Wellness Club is opening its doors on <strong>${launchDate}</strong>! 
                To ensure you're ready to enjoy your membership from day one, please complete the following setup steps.
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
              
              <div style="background: #DEDACE; border: 1px solid #88766B; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <p style="margin: 0 0 10px 0; font-size: 14px; color: #1C170F; font-family: Georgia, 'Times New Roman', Times, serif;">
                  <strong>One-Time Courtesy:</strong> If you'd like to change your membership tier, 
                  you may do so once from the My Membership page before activation.
                </p>
                <p style="margin: 0; font-size: 14px; color: #6C5D3E; font-family: Georgia, 'Times New Roman', Times, serif;">
                  Founding members can also contact us to discuss opt-in or opt-out of founding status if needed.
                </p>
              </div>
              
              <div style="background: #F0DFC4; border: 2px solid #B8A068; border-radius: 8px; padding: 20px; margin: 25px 0;">
                <p style="margin: 0; font-weight: 600; color: #1C170F; font-family: Georgia, 'Times New Roman', Times, serif; font-size: 16px;">
                  ⏰ Please complete these steps before ${launchDate}
                </p>
                <p style="margin: 10px 0 0 0; color: #6C5D3E; font-size: 14px; font-family: Georgia, 'Times New Roman', Times, serif;">
                  Your membership will be activated on opening day once your setup is complete.
                </p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${BASE_URL}/auth" style="${emailStyles.button}; font-family: Georgia, 'Times New Roman', Times, serif; font-size: 16px;">Complete Your Setup</a>
              </div>
              
              <p style="font-size: 14px; line-height: 1.8; color: #6b7280; margin-bottom: 20px; font-family: Georgia, 'Times New Roman', Times, serif;">
                After signing in, you can access your payment methods at <a href="${BASE_URL}/member/payment-methods" style="${emailStyles.link}">Payment Methods</a> 
                and sign agreements at <a href="${BASE_URL}/member/waivers" style="${emailStyles.link}">Waivers & Agreements</a>.
              </p>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px; font-family: Georgia, 'Times New Roman', Times, serif;">
                We look forward to welcoming you to Storm Wellness Club.
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

      default:
        throw new Error(`Unknown email type: ${type}`);
    }

    const emailResponse = await resend.emails.send({
      from: 'Storm Wellness Club <admin@stormwellnessclub.com>',
      to: [to],
      subject,
      html,
    });

    console.log("Email sent successfully:", emailResponse);

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
