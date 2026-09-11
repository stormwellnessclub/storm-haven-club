// Shared Storm-branded email shell for private event correspondence.

export const BRAND_FROM = "Storm Wellness Club <events@stormwellnessclub.com>";
export const FALLBACK_FROM = "Storm Wellness Club <admin@stormwellnessclub.com>";

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
