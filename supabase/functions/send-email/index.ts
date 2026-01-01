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
          <h1>Thank you for applying, ${data.name}!</h1>
          <p>We have received your membership application for the <strong>${data.membershipPlan}</strong> plan.</p>
          <p>Our team will review your application and get back to you within 2-3 business days.</p>
          <p>Best regards,<br>Storm Wellness Club Team</p>
        `;
        break;

      case 'application_approved':
        subject = 'Welcome to Storm Wellness Club!';
        html = `
          <h1>Congratulations, ${data.name}!</h1>
          <p>Your membership application has been approved!</p>
          <p>Your Member ID: <strong>${data.memberId}</strong></p>
          <p>You can now sign in and start booking classes.</p>
          <p>We look forward to seeing you at the club!</p>
          <p>Best regards,<br>Storm Wellness Club Team</p>
        `;
        break;

      case 'booking_confirmation':
        subject = `Booking Confirmed - ${data.className}`;
        html = `
          <h1>Booking Confirmed!</h1>
          <p>You're all set for:</p>
          <ul>
            <li><strong>Class:</strong> ${data.className}</li>
            <li><strong>Date:</strong> ${data.date}</li>
            <li><strong>Time:</strong> ${data.time}</li>
            <li><strong>Instructor:</strong> ${data.instructor}</li>
            ${data.room ? `<li><strong>Room:</strong> ${data.room}</li>` : ''}
          </ul>
          <p>See you there!</p>
          <p>Best regards,<br>Storm Wellness Club Team</p>
        `;
        break;

      case 'booking_cancellation':
        subject = `Booking Cancelled - ${data.className}`;
        html = `
          <h1>Booking Cancelled</h1>
          <p>Your booking has been cancelled:</p>
          <ul>
            <li><strong>Class:</strong> ${data.className}</li>
            <li><strong>Date:</strong> ${data.date}</li>
            <li><strong>Time:</strong> ${data.time}</li>
          </ul>
          ${data.creditRefunded ? '<p>Your class credit has been refunded.</p>' : ''}
          <p>Best regards,<br>Storm Wellness Club Team</p>
        `;
        break;

      case 'waiver_reminder':
        subject = 'Action Required: Sign Your Waiver';
        html = `
          <h1>Waiver Signature Required</h1>
          <p>Hi ${data.name},</p>
          <p>Please sign your liability waiver before your first class.</p>
          <p><a href="${data.waiverLink}">Click here to sign your waiver</a></p>
          <p>Best regards,<br>Storm Wellness Club Team</p>
        `;
        break;

      default:
        throw new Error(`Unknown email type: ${type}`);
    }

    const emailResponse = await resend.emails.send({
      from: 'Storm Wellness Club <onboarding@resend.dev>',
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
