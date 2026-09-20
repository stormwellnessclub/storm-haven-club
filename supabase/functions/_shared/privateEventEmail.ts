// Shared Storm-branded email shell for private event correspondence.

export const BRAND_FROM = "Storm Wellness Club <events@stormwellnessclub.com>";
export const FALLBACK_FROM = "Storm Wellness Club <admin@stormwellnessclub.com>";
export const REPLY_TO = "admin@stormwellnessclub.com";

// Reservation terms shown on proposals and deposit invoices.
export const RESERVATION_TERMS_TEXT = `RESERVATION TERMS

Clear terms allow Storm to reserve the date, schedule the team and prepare the guest experience with intention.

To reserve the date:
• 50% nonrefundable deposit required to secure the event date and time
• Remaining balance due 72 hours before the event
• Final guest count due 7 days before the event
• Final dietary restrictions due 7 days before the event
• Date is not held until the proposal is accepted and the deposit is received
• Outside vendors, sponsors and branded materials require prior approval
• ALL PARTICIPANTS MUST COMPLETE STORM WAIVERS BEFORE USE OF THE WET SPA

This proposal includes designated use of the agreed event areas for the contracted event. It does not include full-facility closure or exclusive use of the entire club. If the event is scheduled within regular business hours, use will be coordinated alongside normal member areas.`;

export function reservationTermsHtml(): string {
  const items = [
    "50% nonrefundable deposit required to secure the event date and time",
    "Remaining balance due 72 hours before the event",
    "Final guest count due 7 days before the event",
    "Final dietary restrictions due 7 days before the event",
    "Date is not held until the proposal is accepted and the deposit is received",
    "Outside vendors, sponsors and branded materials require prior approval",
  ]
    .map(
      (t) =>
        `<li style="margin:0 0 8px;color:#374151;font-size:14px;line-height:1.6;">${t}</li>`,
    )
    .join("");

  return `
  <div style="margin:28px 0 0;border-top:1px solid #e5e7eb;padding-top:22px;">
    <h2 style="margin:0 0 8px;font-size:17px;color:#111827;">Reservation Terms</h2>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#6b7280;">Clear terms allow Storm to reserve the date, schedule the team and prepare the guest experience with intention.</p>
    <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.14em;color:#9ca3af;">TO RESERVE THE DATE</p>
    <ul style="margin:0 0 16px;padding-left:20px;">${items}</ul>
    <div style="background:#fdf6e3;border:1px solid #c9a86a;border-left:4px solid #c9a86a;border-radius:6px;padding:14px 16px;margin:0 0 18px;">
      <p style="margin:0;font-size:14px;line-height:1.6;color:#3a2e1a;font-weight:700;">All participants must complete Storm waivers before use of the wet spa.</p>
    </div>
    <p style="margin:0;font-size:12px;line-height:1.6;color:#9ca3af;">This proposal includes designated use of the agreed event areas for the contracted event. It does not include full-facility closure or exclusive use of the entire club. If the event is scheduled within regular business hours, use will be coordinated alongside normal member areas.</p>
  </div>`;
}

export function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function eventEmailShell(opts: {
  heading: string;
  intro: string;
  rows?: { label: string; value: string }[];
  ctaLabel?: string;
  ctaUrl?: string;
  outro?: string;
}): string {
  const rows = (opts.rows ?? [])
    .map(
      (r) => `
      <tr>
        <td style="padding:8px 0;color:#6b7280;font-size:14px;">${r.label}</td>
        <td style="padding:8px 0;color:#111827;font-size:14px;text-align:right;font-weight:600;">${r.value}</td>
      </tr>`,
    )
    .join("");

  const cta =
    opts.ctaUrl && opts.ctaLabel
      ? `<div style="margin:28px 0;text-align:center;">
           <a href="${opts.ctaUrl}" style="background:#1f2937;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:6px;font-size:15px;letter-spacing:0.04em;display:inline-block;">${opts.ctaLabel}</a>
         </div>`
      : "";

  return `
  <div style="background:#f6f5f2;padding:32px 0;font-family:Georgia,'Times New Roman',serif;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
      <div style="background:#111827;padding:24px;text-align:center;">
        <div style="color:#ffffff;font-size:20px;letter-spacing:0.18em;">STORM WELLNESS CLUB</div>
        <div style="color:#9ca3af;font-size:11px;letter-spacing:0.22em;margin-top:6px;">PRIVATE EVENTS</div>
      </div>
      <div style="padding:32px;">
        <h1 style="margin:0 0 16px;font-size:22px;color:#111827;">${opts.heading}</h1>
        <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#374151;">${opts.intro}</p>
        ${rows ? `<table style="width:100%;border-collapse:collapse;border-top:1px solid #e5e7eb;">${rows}</table>` : ""}
        ${cta}
        ${opts.outro ? `<p style="margin:20px 0 0;font-size:14px;line-height:1.7;color:#6b7280;">${opts.outro}</p>` : ""}
      </div>
      <div style="padding:20px 32px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:12px;text-align:center;">
        Storm Wellness Club &middot; stormwellnessclub.com &middot; (248) 232-8487
      </div>
    </div>
  </div>`;
}

export async function sendBrandedEmail(params: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return { ok: false, error: "RESEND_API_KEY is not configured" };

  const send = async (from: string) => {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [params.to],
        subject: params.subject,
        html: params.html,
        ...(params.replyTo ? { reply_to: params.replyTo } : {}),
      }),
    });
    return res;
  };

  let res = await send(BRAND_FROM);
  if (!res.ok) {
    // events@ may not be verified on the domain yet — fall back to the known-good sender.
    res = await send(FALLBACK_FROM);
  }
  if (!res.ok) {
    const text = await res.text();
    return { ok: false, error: text };
  }
  return { ok: true };
}
