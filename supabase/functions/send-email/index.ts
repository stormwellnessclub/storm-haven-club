import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailRequest {
  type: 'application_submitted' | 'application_approved' | 'booking_confirmation' | 'booking_cancellation' | 'waiver_reminder' | 'class_reminder' | 'waitlist_notification' | 'waitlist_claim_confirmation' | 'activation_reminder_day3' | 'activation_reminder_day5' | 'membership_activated' | 'payment_update_request' | 'charge_confirmation' | 'application_approved_locked_date';
  to: string;
  data: Record<string, any>;
}

const BASE_URL = Deno.env.get('APP_BASE_URL') ?? 'https://storm-haven-club.lovable.app';

// Email template styling - Brand colors: Gold #C9A227, Charcoal #312D28
const emailStyles = {
  container: 'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;',
  header: 'background: linear-gradient(135deg, #312D28 0%, #3D3830 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;',
  content: 'background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none;',
  footer: 'background: #f9fafb; padding: 20px; text-align: center; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;',
  button: 'display: inline-block; background: #C9A227; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 10px 5px;',
  buttonSecondary: 'display: inline-block; background: #312D28; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 500; margin: 10px 5px;',
  link: 'color: #C9A227; text-decoration: none;',
  muted: 'color: #6b7280; font-size: 14px;',
  heading: 'color: #312D28; margin-top: 0;',
};

const getEmailHeader = () => `
  <div style="${emailStyles.header}">
    <img src="${BASE_URL}/storm-logo-gold.png" alt="Storm Wellness Club" height="60" style="display: block; margin: 0 auto;" />
  </div>
`;

const getEmailFooter = () => `
  <div style="${emailStyles.footer}">
    <p style="${emailStyles.muted}">
      Have questions? Visit your member portal:<br>
      <a href="${BASE_URL}/member/support" style="${emailStyles.link}">Contact Support</a> · 
      <a href="${BASE_URL}/member/bookings" style="${emailStyles.link}">Manage Bookings</a>
    </p>
    <p style="${emailStyles.muted}">
      Storm Wellness Club<br>
      <a href="${BASE_URL}" style="${emailStyles.link}">stormwellnessclub.com</a>
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

      case 'application_approved':
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
              
              <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 20px; margin: 25px 0;">
                <p style="margin: 0; font-weight: 600; color: #92400e;">
                  ⏰ Please sign in to your member portal within the next 7 days to select your membership start date.
                </p>
                <p style="margin: 10px 0 0 0; color: #92400e; font-size: 14px;">
                  Your billing will begin on the date you choose. If no date is selected by <strong>${data.activationDeadline || 'the deadline'}</strong>, your membership will automatically begin on that date.
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
              
              <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <p style="margin: 0; font-weight: 600; color: #92400e;">
                  ⏰ Your membership activation window closes in 2 days.
                </p>
              </div>
              
              <p style="font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 20px;">
                Please sign in to select your preferred start date. If no date is selected by <strong>${data.activationDeadline}</strong>, your membership will automatically begin on that date.
              </p>
              
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
              
              <div style="background: #ecfdf5; border: 1px solid #10b981; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Membership Tier</td>
                    <td style="padding: 8px 0; font-weight: 600;">${data.membershipType}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Start Date</td>
                    <td style="padding: 8px 0; font-weight: 600;">${data.startDate}</td>
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
              <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <table style="width: 100%; border-collapse: collapse;">
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
              <div style="background: #ecfdf5; border: 1px solid #10b981; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <table style="width: 100%; border-collapse: collapse;">
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
                </table>
              </div>
              <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; font-weight: 600; color: #92400e;">⏰ Act fast! You have 5 minutes to claim this spot.</p>
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
              <div style="background: #ecfdf5; border: 1px solid #10b981; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <table style="width: 100%; border-collapse: collapse;">
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
              <p style="color: #10b981; font-weight: 500;">✓ Your spot is now confirmed!</p>
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
              
              <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 20px; margin: 25px 0;">
                <p style="margin: 0; font-weight: 600; color: #92400e;">
                  Please click the button below to securely add your payment method.
                </p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${BASE_URL}/apply" style="${emailStyles.button}">Add Payment Information</a>
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

      case 'charge_confirmation':
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
              
              <div style="background: #ecfdf5; border: 1px solid #10b981; border-radius: 8px; padding: 20px; margin: 25px 0;">
                <h3 style="margin: 0 0 15px 0; color: #065f46;">Receipt Details</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Description</td>
                    <td style="padding: 8px 0; font-weight: 600; text-align: right;">${data.description}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Amount</td>
                    <td style="padding: 8px 0; font-weight: 600; text-align: right; font-size: 18px; color: #065f46;">$${data.amount}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Date</td>
                    <td style="padding: 8px 0; font-weight: 600; text-align: right;">${data.date}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Payment Method</td>
                    <td style="padding: 8px 0; font-weight: 600; text-align: right;">${data.cardBrand} •••• ${data.cardLast4}</td>
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
            ${getEmailFooter()}
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
