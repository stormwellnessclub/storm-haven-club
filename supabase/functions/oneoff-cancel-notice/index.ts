// One-off dispatcher to send class-cancellation notices to Mallak & Mariam.
// Uses the in-env service role key to authenticate against send-email.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const recipients = [
  { name: "Mallak", email: "mallakmak07@gmail.com" },
  { name: "Mariam", email: "mariammakled1@gmail.com" },
];

const message = `We are sorry to let you know that Signature Flow on Tuesday, May 27 at 11:00 AM has been cancelled.

Here is what we have already done for you:

✓ Your class credit has been refunded back to your pass — it is ready to use on any upcoming class.

✓ We have added an extra week to your pass expiration as a thank-you for your patience. Your pass now expires June 8, 2026 (was June 1).

You can rebook anytime from your member portal at stormwellnessclub.com/portal/book/class.

Thank you for being part of the Storm Wellness Club family. If you have any questions, just reply to this email or text us.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const results: any[] = [];
  for (const r of recipients) {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SRK}`,
      },
      body: JSON.stringify({
        to: r.email,
        type: "staff_reply",
        data: {
          name: r.name,
          subject: "Tomorrow's 11 AM Signature Flow — Cancelled (credit restored + 1 week added)",
          message,
        },
      }),
    });
    results.push({ to: r.email, status: res.status, body: await res.text() });
  }
  return new Response(JSON.stringify({ results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
