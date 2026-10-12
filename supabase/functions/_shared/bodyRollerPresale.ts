// Lymphatic Body Roller member presale: server-authoritative options + branded campaign emails.
// Keep OPTIONS in sync with src/lib/bodyRollerPresale.ts.

export const PRESALE_OPTIONS: Record<string, {
  price_id: string; audience: "member" | "non_member"; label: string; duration: 30 | 60; sessions: number; cents: number; regular_cents: number;
}> = {
  "30_single": { price_id: "price_1UPeVcLyZrsSqLhs5jEDphcQ", audience: "member", label: "30-Minute Session", duration: 30, sessions: 1, cents: 3500, regular_cents: 4900 },
  "30_5pack": { price_id: "price_1UPeVdLyZrsSqLhs0y2jMqWk", audience: "member", label: "30-Minute 5-Pack", duration: 30, sessions: 5, cents: 15000, regular_cents: 23000 },
  "30_10pack": { price_id: "price_1UPeVeLyZrsSqLhsZdWnmHwV", audience: "member", label: "30-Minute 10-Pack", duration: 30, sessions: 10, cents: 30000, regular_cents: 49000 },
  "60_single": { price_id: "price_1UPeVfLyZrsSqLhsZHYz2KCD", audience: "member", label: "60-Minute Session", duration: 60, sessions: 1, cents: 7000, regular_cents: 9000 },
  "60_5pack": { price_id: "price_1UPeVfLyZrsSqLhsBzkZzYCb", audience: "member", label: "60-Minute 5-Pack", duration: 60, sessions: 5, cents: 32500, regular_cents: 45000 },
  "60_10pack": { price_id: "price_1UPeVgLyZrsSqLhsYfd7rLOJ", audience: "member", label: "60-Minute 10-Pack", duration: 60, sessions: 10, cents: 60000, regular_cents: 80000 },
  // Non-member early purchase at regular price (singles only for now).
  "nm_30_single": { price_id: "price_1UPebMLyZrsSqLhsxsaxaBhA", audience: "non_member", label: "30-Minute Session (Non-Member)", duration: 30, sessions: 1, cents: 4900, regular_cents: 4900 },
  "nm_60_single": { price_id: "price_1UPebMLyZrsSqLhs7ucmYTbZ", audience: "non_member", label: "60-Minute Session (Non-Member)", duration: 60, sessions: 1, cents: 9000, regular_cents: 9000 },
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

const C = { maroon: "#4A1A1F", wine: "#6B2A31", espresso: "#1A110D", bark: "#2A1C16", gold: "#C6A267", goldSoft: "#E7D3A8", cream: "#F6F1E8", sand: "#EDE3D2", ink: "#2A1E18", muted: "#8A7566" };
const SERIF = "Didot,'Bodoni 72','Playfair Display',Georgia,serif";
const SANS = "'Helvetica Neue',Helvetica,Arial,sans-serif";
const $ = (c: number) => `$${(c / 100).toFixed(0)}`;
const opts = (d: 30 | 60) => Object.values(PRESALE_OPTIONS).filter((o) => o.audience === "member" && o.duration === d);

const eyebrow = (t: string, color = C.gold) => `<p style="margin:0 0 14px;font-family:${SANS};font-size:10px;letter-spacing:5px;color:${color};text-transform:uppercase;">${t}</p>`;
const rule = (color = C.gold) => `<table cellpadding="0" cellspacing="0" align="center" style="margin:22px auto;"><tr><td style="width:40px;height:1px;background:${color};font-size:0;line-height:1px;">&nbsp;</td><td style="padding:0 10px;color:${color};font-size:10px;">&#9670;</td><td style="width:40px;height:1px;background:${color};font-size:0;line-height:1px;">&nbsp;</td></tr></table>`;
const btn = (label: string, url: string, bg = C.gold, fg = C.espresso) => `<table cellpadding="0" cellspacing="0" align="center" style="margin:34px auto 0;"><tr><td style="background:${bg};">
  <a href="${url}" style="display:inline-block;padding:18px 46px;color:${fg};font-family:${SANS};font-size:12px;font-weight:bold;letter-spacing:4px;text-decoration:none;">${label}</a></td></tr></table>`;
const img = (src: string, alt: string, h: number) => `<img src="${src}" alt="${alt}" width="600" height="${h}" style="display:block;width:100%;height:${h}px;object-fit:cover;border:0;" />`;

/** Menu-style price card: each option with regular price struck and the savings called out. */
function priceMenu(dark: boolean) {
  const fg = dark ? C.cream : C.ink, line = dark ? "#3A2A22" : "#E2D6C2", sub = dark ? "#A8968A" : C.muted;
  const col = (d: 30 | 60, name: string) => `<td valign="top" width="50%" style="padding:0 10px;">
    <p style="margin:0;font-family:${SERIF};font-size:44px;line-height:1;color:${C.gold};">${d}<span style="font-size:14px;letter-spacing:3px;"> MIN</span></p>
    <p style="margin:6px 0 14px;font-family:${SERIF};font-style:italic;font-size:15px;color:${sub};">${name}</p>
    ${opts(d).map((o) => `<table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${line};"><tr>
      <td style="padding:12px 0;font-family:${SANS};font-size:13px;letter-spacing:1px;color:${fg};">${o.sessions === 1 ? "Single" : `${o.sessions}-Pack`}
        <br/><span style="font-size:10px;letter-spacing:2px;color:${C.gold};">SAVE ${$(o.regular_cents - o.cents)}</span></td>
      <td align="right" style="padding:12px 0;"><span style="font-family:${SANS};font-size:12px;color:${sub};text-decoration:line-through;">${$(o.regular_cents)}</span>
        <span style="font-family:${SERIF};font-size:22px;color:${fg};">&nbsp;${$(o.cents)}</span></td></tr></table>`).join("")}
  </td>`;
  return `<table width="100%" cellpadding="0" cellspacing="0"><tr>${col(30, "The Reset")}${col(60, "The Full Ritual")}</tr></table>`;
}

const pillars = (dark: boolean) => {
  const fg = dark ? C.cream : C.ink, sub = dark ? "#A8968A" : C.muted;
  return `<table width="100%" cellpadding="0" cellspacing="0"><tr>${[
    ["I", "Roll", "Sculpted wooden rollers move in a rhythmic wave, supporting natural lymphatic flow."],
    ["II", "Glow", "Built-in red light therapy bathes the body in warm, restorative light as you roll."],
    ["III", "Release", "Rise lighter, de-puffed and loosened &mdash; the whole body reset in one session."],
  ].map(([n, t, d]) => `<td valign="top" width="33%" style="padding:0 10px;text-align:center;">
      <p style="margin:0;font-family:${SERIF};font-size:13px;letter-spacing:3px;color:${C.gold};">${n}</p>
      <p style="margin:8px 0 8px;font-family:${SERIF};font-size:22px;color:${fg};">${t}</p>
      <p style="margin:0;font-family:${SANS};font-size:12px;line-height:1.7;color:${sub};">${d}</p></td>`).join("")}</tr></table>`;
};

function shell(bg: string, inner: string, footerDark = true) {
  const fbg = footerDark ? C.espresso : C.sand, fc = footerDark ? "#8F7C70" : C.muted;
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="color-scheme" content="light only"/></head>
<body style="margin:0;padding:0;background:${C.espresso};">
<table width="100%" cellpadding="0" cellspacing="0" style="background:${C.espresso};"><tr><td align="center" style="padding:24px 10px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${bg};">
  <tr><td style="padding:22px 30px;background:${C.espresso};border-bottom:1px solid #3A2A22;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="font-family:${SERIF};font-size:14px;letter-spacing:6px;color:${C.cream};">STORM</td>
      <td align="right" style="font-family:${SANS};font-size:9px;letter-spacing:4px;color:${C.gold};">WELLNESS CLUB &middot; LIVONIA</td>
    </tr></table></td></tr>
  ${inner}
  <tr><td style="background:${fbg};padding:30px 40px;text-align:center;font-family:${SANS};font-size:11px;line-height:1.8;color:${fc};">
    Storm Wellness Club &middot; Livonia, Michigan<br/>Questions? Simply reply to this email.<br/>
    <a href="${SITE}" style="color:${C.gold};text-decoration:none;letter-spacing:2px;">STORMWELLNESSCLUB.COM</a>
  </td></tr>
</table></td></tr></table></body></html>`;
}

const fine = (endsLabel: string, color: string) => `<p style="margin:22px 0 0;text-align:center;font-family:${SANS};font-size:11px;line-height:1.8;color:${color};">
  Member pricing &middot; Presale ends ${endsLabel} &middot; All sessions expire 6 months after purchase<br/>6% Michigan sales tax and card fee added at checkout<br/>
  <em style="font-family:${SERIF};font-size:13px;">Estimated arrival early November. Arrival date subject to change.</em></p>`;

export function buildPresaleEmail(kind: EmailKind, firstName: string | null, endsLabel: string): string {
  const name = firstName ? firstName : "Member";

  if (kind === "launch") return shell(C.espresso, `
  <tr><td style="position:relative;">${img(IMG.hero, "The Lymphatic Body Roller", 420)}</td></tr>
  <tr><td style="padding:50px 40px 10px;text-align:center;">
    ${eyebrow("A members-first presale")}
    <h1 style="margin:0;font-family:${SERIF};font-weight:normal;font-size:58px;line-height:1;color:${C.cream};">Roll. Glow.<br/><em style="color:${C.gold};">Release.</em></h1>
    ${rule()}
    <p style="margin:0 auto;max-width:440px;font-family:${SERIF};font-size:17px;line-height:1.8;color:#D9CBBB;">
      ${name}, something new is arriving at Storm &mdash; the <strong style="color:${C.cream};font-weight:normal;">Lymphatic Body Roller</strong>.
      Rows of warm, sculpted wood roll in a slow wave from ankle to shoulder while <strong style="color:${C.cream};font-weight:normal;">red light therapy</strong> glows beneath you.
      Two rituals, one session. Before it lands, our members reserve first &mdash; at prices no one else will see.</p>
  </td></tr>
  <tr><td style="padding:44px 30px 0;">${pillars(true)}</td></tr>
  <tr><td style="padding:44px 0 0;">${img(IMG.legs, "A Body Roller session", 300)}</td></tr>
  <tr><td style="padding:48px 30px 50px;background:${C.bark};">
    <p style="margin:0 0 6px;text-align:center;font-family:${SERIF};font-size:30px;color:${C.cream};">The Presale Menu</p>
    <p style="margin:0 0 30px;text-align:center;font-family:${SERIF};font-style:italic;font-size:14px;color:${C.gold};">save up to ${$(Math.max(...Object.values(PRESALE_OPTIONS).map((o) => o.regular_cents - o.cents)))}</p>
    ${priceMenu(true)}
    ${btn("RESERVE MY SESSIONS", PRESALE_URL)}
    ${fine(endsLabel, "#8F7C70")}
  </td></tr>`);

  if (kind === "halfway") return shell(C.cream, `
  <tr><td style="background:${C.maroon};padding:56px 40px;text-align:center;">
    ${eyebrow("The presale, halfway through", C.goldSoft)}
    <p style="margin:0;font-family:${SERIF};font-size:96px;line-height:1;color:${C.gold};">&frac12;</p>
    <h1 style="margin:14px 0 0;font-family:${SERIF};font-weight:normal;font-size:36px;line-height:1.2;color:${C.cream};">Halfway to arrival.<br/><em>Your price is still held.</em></h1>
  </td></tr>
  <tr><td>${img(IMG.machine, "The Lymphatic Body Roller", 340)}</td></tr>
  <tr><td style="padding:46px 44px 0;">
    <p style="margin:0 0 16px;font-family:${SERIF};font-size:17px;color:${C.ink};">${name},</p>
    <p style="margin:0;font-family:${SERIF};font-size:17px;line-height:1.8;color:${C.ink};">Picture it: a warm wave of wooden rollers working from your calves upward, red light glowing beneath you, twenty minutes in and your body finally <em>exhales</em>.
    The machine is on its way &mdash; and member presale pricing is still open until <strong>${endsLabel}</strong>.</p>
  </td></tr>
  <tr><td style="padding:40px 44px 0;">
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.gold};"><tr><td style="padding:26px;text-align:center;">
      ${eyebrow("Most loved")}
      <p style="margin:0;font-family:${SERIF};font-size:28px;color:${C.maroon};">The 60-Minute 10-Pack</p>
      <p style="margin:10px 0 0;font-family:${SANS};font-size:14px;color:${C.muted};"><span style="text-decoration:line-through;">$800</span> &nbsp;<strong style="font-family:${SERIF};font-size:26px;color:${C.ink};font-weight:normal;">$600</strong> &nbsp;&middot;&nbsp; $60 a session</p>
    </td></tr></table>
  </td></tr>
  <tr><td style="padding:40px 30px 50px;">${priceMenu(false)}${btn("HOLD MY PRESALE PRICE", PRESALE_URL, C.maroon, C.cream)}${fine(endsLabel, C.muted)}</td></tr>`, false);

  if (kind === "last_chance") return shell(C.espresso, `
  <tr><td style="background:${C.wine};padding:14px;text-align:center;font-family:${SANS};font-size:11px;letter-spacing:5px;color:${C.goldSoft};">PRESALE CLOSES ${endsLabel.toUpperCase()}</td></tr>
  <tr><td style="padding:60px 40px 20px;text-align:center;">
    ${eyebrow("Final call")}
    <h1 style="margin:0;font-family:${SERIF};font-weight:normal;font-size:64px;line-height:.95;color:${C.cream};">The door<br/>is <em style="color:${C.gold};">closing.</em></h1>
    ${rule()}
    <p style="margin:0 auto;max-width:430px;font-family:${SERIF};font-size:17px;line-height:1.8;color:#D9CBBB;">${name}, after ${endsLabel}, the Lymphatic Body Roller returns to regular pricing &mdash; for good. This is the last moment to lock in member presale rates on roller + red light sessions.</p>
  </td></tr>
  <tr><td style="padding:30px 30px 0;"><table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td width="50%" style="padding-right:4px;"><img src="${IMG.legs}" alt="A Body Roller session" width="296" height="260" style="display:block;width:100%;height:260px;object-fit:cover;border:0;"/></td>
    <td width="50%" style="padding-left:4px;"><img src="${IMG.machine}" alt="The Lymphatic Body Roller" width="296" height="260" style="display:block;width:100%;height:260px;object-fit:cover;border:0;"/></td>
  </tr></table></td></tr>
  <tr><td style="padding:46px 30px 0;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      ${[["$35", "vs $49", "30-min single"], ["$150", "vs $230", "30-min 5-pack"], ["$600", "vs $800", "60-min 10-pack"]].map(([a, b, c]) => `<td width="33%" style="padding:0 5px;"><table width="100%" cellpadding="0" cellspacing="0" style="border:1px dashed ${C.gold};"><tr><td style="padding:20px 6px;text-align:center;">
        <p style="margin:0;font-family:${SERIF};font-size:32px;color:${C.gold};">${a}</p>
        <p style="margin:4px 0 0;font-family:${SANS};font-size:11px;color:#8F7C70;text-decoration:line-through;">${b.replace("vs ", "")}</p>
        <p style="margin:8px 0 0;font-family:${SANS};font-size:10px;letter-spacing:2px;color:${C.cream};text-transform:uppercase;">${c}</p></td></tr></table></td>`).join("")}
    </tr></table>
  </td></tr>
  <tr><td style="padding:44px 30px 50px;">
    <p style="margin:0 0 26px;text-align:center;font-family:${SERIF};font-style:italic;font-size:16px;color:${C.goldSoft};">Every option, before it's gone</p>
    ${priceMenu(true)}${btn("RESERVE BEFORE IT CLOSES", PRESALE_URL)}${fine(endsLabel, "#8F7C70")}
  </td></tr>`);

  // arrived — buyers only
  return shell(C.cream, `
  <tr><td>${img(IMG.hero, "The Lymphatic Body Roller has arrived", 460)}</td></tr>
  <tr><td style="padding:54px 40px 10px;text-align:center;">
    ${eyebrow("It has arrived")}
    <h1 style="margin:0;font-family:${SERIF};font-weight:normal;font-size:52px;line-height:1.05;color:${C.maroon};">Your first roll<br/><em style="color:${C.gold};">awaits.</em></h1>
    ${rule()}
    <p style="margin:0 auto;max-width:440px;font-family:${SERIF};font-size:17px;line-height:1.8;color:${C.ink};">${name}, thank you for believing in it before it was here. The Lymphatic Body Roller &mdash; with built-in red light therapy &mdash; is now in the club, and the sessions you reserved are waiting in your account.</p>
  </td></tr>
  <tr><td style="padding:40px 40px 0;">
    <table width="100%" cellpadding="0" cellspacing="0">${[
      ["01", "Book", "Choose a time in your member portal &mdash; your presale sessions apply automatically."],
      ["02", "Arrive", "Come in comfortable clothing a few minutes early. Hydrate well beforehand."],
      ["03", "Roll &amp; glow", "Lie back, let the rollers and red light work, and leave lighter."],
    ].map(([n, t, d]) => `<tr><td valign="top" width="70" style="padding:16px 0;border-top:1px solid #E2D6C2;font-family:${SERIF};font-size:34px;color:${C.gold};">${n}</td>
      <td style="padding:16px 0;border-top:1px solid #E2D6C2;"><p style="margin:0;font-family:${SERIF};font-size:20px;color:${C.maroon};">${t}</p>
      <p style="margin:4px 0 0;font-family:${SANS};font-size:13px;line-height:1.7;color:${C.muted};">${d}</p></td></tr>`).join("")}</table>
  </td></tr>
  <tr><td style="padding:10px 40px 50px;">${btn("BOOK MY FIRST SESSION", `${SITE}/member/book`, C.maroon, C.cream)}
    <p style="margin:20px 0 0;text-align:center;font-family:${SANS};font-size:11px;color:${C.muted};">Reserved sessions expire 6 months after purchase.</p></td></tr>
  <tr><td>${img(IMG.legs, "A Body Roller session", 280)}</td></tr>`, false);
}
