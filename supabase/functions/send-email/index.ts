import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailRequest {
  type: 'application_submitted' | 'application_approved' | 'booking_confirmation' | 'booking_cancellation' | 'waiver_reminder';
  to: string;
  data: Record<string, any>;
}

const BASE_URL = 'https://stormwellnessclub.com';

// Email template styling
const emailStyles = {
  container: 'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;',
  header: 'background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;',
  logo: 'color: #c4a052; font-size: 24px; font-weight: bold; margin: 0;',
  content: 'background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none;',
  footer: 'background: #f9fafb; padding: 20px; text-align: center; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;',
  button: 'display: inline-block; background: #c4a052; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 10px 5px;',
  buttonSecondary: 'display: inline-block; background: #1a1a2e; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 500; margin: 10px 5px;',
  link: 'color: #c4a052; text-decoration: none;',
  muted: 'color: #6b7280; font-size: 14px;',
};

const getEmailHeader = () => `
  <div style="${emailStyles.header}">
    <h1 style="${emailStyles.logo}">STORM WELLNESS CLUB</h1>
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
              <h2 style="color: #1a1a2e; margin-top: 0;">Thank you for applying, ${data.name}!</h2>
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
        subject = 'Welcome to Storm Wellness Club!';
        html = `
          <div style="${emailStyles.container}">
            ${getEmailHeader()}
            <div style="${emailStyles.content}">
              <h2 style="color: #1a1a2e; margin-top: 0;">Congratulations, ${data.name}!</h2>
              <p>Your membership application has been <strong style="color: #10b981;">approved</strong>!</p>
              <div style="background: #f0fdf4; border: 1px solid #10b981; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <p style="margin: 0;"><strong>Your Member ID:</strong> ${data.memberId}</p>
              </div>
              <p>You can now sign in to your member portal and start booking classes.</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${BASE_URL}/auth" style="${emailStyles.button}">Sign In to Member Portal</a>
              </div>
              <p>We look forward to seeing you at the club!</p>
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
              <h2 style="color: #1a1a2e; margin-top: 0;">Booking Confirmed! ✓</h2>
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
              <h2 style="color: #1a1a2e; margin-top: 0;">Booking Cancelled</h2>
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
              <h2 style="color: #1a1a2e; margin-top: 0;">Waiver Signature Required</h2>
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
