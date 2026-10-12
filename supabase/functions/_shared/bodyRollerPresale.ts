// Lymphatic Body Roller member presale: server-authoritative options + branded campaign emails.
// Keep OPTIONS in sync with src/lib/bodyRollerPresale.ts.

export const PRESALE_OPTIONS: Record<string, {
  price_id: string; label: string; duration: 30 | 60; sessions: number; cents: number; regular_cents: number;
}> = {
  "30_single": { price_id: "price_1UPeVcLyZrsSqLhs5jEDphcQ", label: "30-Minute Session", duration: 30, sessions: 1, cents: 3500, regular_cents: 4900 },
  "30_5pack": { price_id: "price_1UPeVdLyZrsSqLhs0y2jMqWk", label: "30-Minute 5-Pack", duration: 30, sessions: 5, cents: 15000, regular_cents: 24500 },
  "30_10pack": { price_id: "price_1UPeVeLyZrsSqLhsZdWnmHwV", label: "30-Minute 10-Pack", duration: 30, sessions: 10, cents: 30000, regular_cents: 49000 },
  "60_single": { price_id: "price_1UPeVfLyZrsSqLhsZHYz2KCD", label: "60-Minute Session", duration: 60, sessions: 1, cents: 7000, regular_cents: 9000 },
  "60_5pack": { price_id: "price_1UPeVfLyZrsSqLhsBzkZzYCb", label: "60-Minute 5-Pack", duration: 60, sessions: 5, cents: 32500, regular_cents: 45000 },
  "60_10pack": { price_id: "price_1UPeVgLyZrsSqLhsYfd7rLOJ", label: "60-Minute 10-Pack", duration: 60, sessions: 10, cents: 60000, regular_cents: 90000 },
};

/** 6% MI tax, then card fee gross-up (total + $0.30) / (1 - 0.029). */
export function presaleTotals(subtotal: number) {
  const tax = Math.round(subtotal * 0.06);
  const base = subtotal + tax;
  const total = Math.round((base + 30) / (1 - 0.029));
  return { subtotal, tax, fee: total - base, total };
}

export const SITE = "https://stormwellnessclub.com";
export const PRESALE_URL = `${SITE}/body-roller-presale`;
const IMG = {
  hero: `${SITE}/__l5e/assets-v1/89a367c4-0e67-4abd-9278-5ef7d9ebaa93/body-roller-Image_9.jpeg`,
  legs: `${SITE}/__l5e/assets-v1/cb89f811-ea21-47a6-a994-0eb072f26068/body-roller-Image_16.jpeg`,
  machine: `${SITE}/__l5e/assets-v1/02d95957-88b3-46b0-be34-9c615f961e69/body-roller-Image_57.jpeg`,
};

export type EmailKind = "launch" | "halfway" | "last_chance" | "arrived";

export const EMAIL_META: Record<EmailKind, { key: string; subject: string }> = {
  launch: { key: "body_roller_presale_launch", subject: "Introducing the Lymphatic Body Roller — Member Presale Now Open" },
  halfway: { key: "body_roller_presale_halfway", subject: "Your member presale pricing on the Body Roller is still open" },
  last_chance: { key: "body_roller_presale_last_chance", subject: "Last days: Body Roller member presale pricing ends soon" },
  arrived: { key: "body_roller_presale_arrived", subject: "The Body Roller has arrived — your sessions are ready to book" },
};

const C = { maroon: "#4A1A1F", espresso: "#1F1410", gold: "#B8955A", cream: "#F6F1E8", ink: "#2A1E18", muted: "#7A6658" };

function priceRow(label: string, regular: string, sale: string) {
  return `<tr>
    <td style="padding:12px 0;border-bottom:1px solid #E6DCCB;font-size:15px;color:${C.ink};">${label}</td>
    <td style="padding:12px 0;border-bottom:1px solid #E6DCCB;text-align:right;font-size:15px;">
      ${regular ? `<span style="color:${C.muted};text-decoration:line-through;font-size:13px;margin-right:8px;">${regular}</span>` : ""}
      <strong style="color:${C.maroon};">${sale}</strong>
    </td></tr>`;
}

function priceTable(title: string, rows: string) {
  return `<td valign="top" width="50%" style="padding:0 8px;">
    <p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:11px;letter-spacing:3px;color:${C.gold};">${title}</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rows}</table>
  </td>`;
}

export function buildPresaleEmail(kind: EmailKind, firstName: string | null, endsLabel: string): string {
  const hi = firstName ? `${firstName},` : "Hello,";
  const btn = (label: string, url: string) => `<table cellpadding="0" cellspacing="0" align="center" style="margin:30px auto;"><tr><td style="background:${C.maroon};border-radius:2px;">
    <a href="${url}" style="display:inline-block;padding:16px 40px;color:#F6F1E8;font-family:Georgia,serif;font-size:15px;letter-spacing:2px;text-decoration:none;">${label}</a></td></tr></table>`;

  const eyebrow = { launch: "MEMBER PRESALE", halfway: "STILL OPEN", last_chance: "FINAL DAYS", arrived: "NOW BOOKING" }[kind];
  const headline = {
    launch: "The Lymphatic Body Roller is coming to Storm",
    halfway: "Your presale pricing is waiting",
    last_chance: "Presale pricing ends soon",
    arrived: "It's here. Your sessions are ready.",
  }[kind];
  const intro = {
    launch: `A new ritual is arriving at the club. The Lymphatic Body Roller uses warm, rhythmic compression across rows of sculpted wooden rollers to encourage circulation, ease tension and leave the body feeling lighter and restored. Before it arrives, members can reserve sessions at presale pricing.`,
    halfway: `A quick note that member presale pricing on the Lymphatic Body Roller is still open. Reserve a single session or a pack now and your sessions will be waiting in your account the moment the machine arrives.`,
    last_chance: `Member presale pricing on the Lymphatic Body Roller closes on <strong>${endsLabel}</strong>. After that, sessions return to regular pricing. If you've been meaning to reserve, now is the time.`,
    arrived: `The Lymphatic Body Roller has arrived at Storm. Your presale sessions are in your account and ready to book. Thank you for reserving early — we can't wait for you to experience it.`,
  }[kind];

  const pricing = kind === "arrived" ? "" : `
    <tr><td style="padding:10px 32px 0;">
      <p style="margin:0 0 18px;text-align:center;font-family:Georgia,serif;font-size:20px;color:${C.ink};">Member presale pricing</p>
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        ${priceTable("30 MINUTES", priceRow("Single", "$49", "$35") + priceRow("5-Pack", "", "$150") + priceRow("10-Pack", "", "$300"))}
        ${priceTable("60 MINUTES", priceRow("Single", "$90", "$70") + priceRow("5-Pack", "", "$325") + priceRow("10-Pack", "", "$600"))}
      </tr></table>
      <p style="margin:16px 0 0;text-align:center;font-family:Arial,sans-serif;font-size:12px;color:${C.muted};line-height:1.6;">
        Sessions and packs expire 6 months after purchase. Presale ends ${endsLabel}. Michigan sales tax and card fee added at checkout.
      </p>
    </td></tr>`;

  const gallery = `<tr><td style="padding:28px 32px 0;"><table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td width="50%" style="padding-right:6px;"><img src="${IMG.legs}" alt="Lymphatic Body Roller session" width="262" style="display:block;width:100%;height:auto;border:0;" /></td>
      <td width="50%" style="padding-left:6px;"><img src="${IMG.machine}" alt="The Lymphatic Body Roller" width="262" style="display:block;width:100%;height:auto;border:0;" /></td>
    </tr></table></td></tr>`;

  const benefits = kind === "arrived" ? "" : `<tr><td style="padding:30px 40px 0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${[["Circulation", "Rhythmic compression supports natural lymphatic flow."], ["Release", "Warm wooden rollers ease tight, tired muscles."], ["Renewal", "Leave feeling lighter, smoother and restored."]].map(([t, d]) => `
        <tr><td style="padding:10px 0;border-top:1px solid #E6DCCB;">
          <span style="font-family:Georgia,serif;font-size:16px;color:${C.maroon};">${t}</span>
          <span style="font-family:Arial,sans-serif;font-size:13px;color:${C.muted};"> &mdash; ${d}</span>
        </td></tr>`).join("")}
      </table></td></tr>`;

  const cta = kind === "arrived" ? btn("BOOK YOUR SESSION", `${SITE}/member/book`) : btn(kind === "launch" ? "RESERVE AT PRESALE PRICING" : "RESERVE YOUR SESSIONS", PRESALE_URL);
  const note = kind === "arrived" ? "" : `<p style="margin:0 40px 6px;text-align:center;font-family:Georgia,serif;font-style:italic;font-size:13px;color:${C.muted};">Estimated arrival early November. Arrival date subject to change.</p>`;

  return `<!doctype html><html><body style="margin:0;padding:0;background:${C.cream};">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${C.cream};"><tr><td align="center" style="padding:28px 12px;">
  <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;">
    <tr><td style="background:${C.espresso};padding:26px;text-align:center;">
      <div style="font-family:Georgia,serif;color:#F6F1E8;font-size:18px;letter-spacing:6px;">STORM WELLNESS CLUB</div>
      <div style="font-family:Arial,sans-serif;color:${C.gold};font-size:10px;letter-spacing:4px;margin-top:8px;">${eyebrow}</div>
    </td></tr>
    <tr><td><img src="${IMG.hero}" alt="The Lymphatic Body Roller" width="600" style="display:block;width:100%;height:auto;border:0;" /></td></tr>
    <tr><td style="height:4px;background:${C.gold};line-height:4px;font-size:0;">&nbsp;</td></tr>
    <tr><td style="padding:40px 40px 0;text-align:center;">
      <h1 style="margin:0 0 18px;font-family:Georgia,serif;font-weight:normal;font-size:30px;line-height:1.25;color:${C.maroon};">${headline}</h1>
      <p style="margin:0 0 14px;font-family:Georgia,serif;font-size:16px;color:${C.ink};text-align:left;">${hi}</p>
      <p style="margin:0;font-family:Georgia,serif;font-size:16px;line-height:1.75;color:${C.ink};text-align:left;">${intro}</p>
    </td></tr>
    ${benefits}
    ${gallery}
    ${pricing}
    <tr><td>${cta}${note}</td></tr>
    <tr><td style="padding:24px 40px 36px;font-family:Georgia,serif;font-size:15px;color:${C.ink};">With warmth,<br/>The Storm Wellness Club Team</td></tr>
    <tr><td style="background:${C.maroon};padding:22px;text-align:center;font-family:Georgia,serif;font-size:12px;color:#E9DCCB;line-height:1.7;">
      Storm Wellness Club &middot; stormwellnessclub.com<br/>
      Questions? <a href="mailto:admin@stormwellnessclub.com" style="color:${C.gold};">admin@stormwellnessclub.com</a>
    </td></tr>
  </table></td></tr></table></body></html>`;
}
