// Lymphatic Body Roller member presale: server-authoritative options + branded campaign emails.
// Keep OPTIONS in sync with src/lib/bodyRollerPresale.ts.

export const PRESALE_OPTIONS: Record<string, {
  price_id?: string; audience: "member" | "non_member"; label: string; duration: 30 | 60; sessions: number; cents: number; regular_cents: number;
}> = {
  "30_single": { price_id: "price_1UPeVcLyZrsSqLhs5jEDphcQ", audience: "member", label: "30-Minute Session", duration: 30, sessions: 1, cents: 3500, regular_cents: 4900 },
  "30_5pack": { price_id: "price_1UPeVdLyZrsSqLhs0y2jMqWk", audience: "member", label: "30-Minute 5-Pack", duration: 30, sessions: 5, cents: 15000, regular_cents: 23000 },
  "30_10pack": { price_id: "price_1UPeVeLyZrsSqLhsZdWnmHwV", audience: "member", label: "30-Minute 10-Pack", duration: 30, sessions: 10, cents: 30000, regular_cents: 49000 },
  "60_single": { price_id: "price_1UPeVfLyZrsSqLhsZHYz2KCD", audience: "member", label: "60-Minute Session", duration: 60, sessions: 1, cents: 7000, regular_cents: 9000 },
  "60_5pack": { price_id: "price_1UPeVfLyZrsSqLhsBzkZzYCb", audience: "member", label: "60-Minute 5-Pack", duration: 60, sessions: 5, cents: 32500, regular_cents: 45000 },
  "60_10pack": { audience: "member", label: "60-Minute 10-Pack", duration: 60, sessions: 10, cents: 50000, regular_cents: 80000 },
  // Non-member presale pricing.
  "nm_30_single": { audience: "non_member", label: "30-Minute Session (Non-Member)", duration: 30, sessions: 1, cents: 4000, regular_cents: 4900 },
  "nm_30_5pack": { audience: "non_member", label: "30-Minute 5-Pack (Non-Member)", duration: 30, sessions: 5, cents: 19000, regular_cents: 23000 },
  "nm_30_10pack": { audience: "non_member", label: "30-Minute 10-Pack (Non-Member)", duration: 30, sessions: 10, cents: 36000, regular_cents: 49000 },
  "nm_60_single": { audience: "non_member", label: "60-Minute Session (Non-Member)", duration: 60, sessions: 1, cents: 7000, regular_cents: 9000 },
  "nm_60_5pack": { audience: "non_member", label: "60-Minute 5-Pack (Non-Member)", duration: 60, sessions: 5, cents: 35000, regular_cents: 45000 },
  "nm_60_10pack": { audience: "non_member", label: "60-Minute 10-Pack (Non-Member)", duration: 60, sessions: 10, cents: 60000, regular_cents: 80000 },
};

/** No sales tax (services); card fee gross-up (total + $0.30) / (1 - 0.029). */
export function presaleTotals(subtotal: number) {
  const tax = 0; // Michigan does not tax services
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
  // Animated loop of the machine (GIF so it plays inside every inbox)
  loop: `${SITE}/__l5e/assets-v1/73105d48-2a4c-479e-8c37-faa19257b095/body-roller-loop.gif`,
};
const loop = (alt: string) => `<img src="${IMG.loop}" alt="${alt}" width="600" height="338" style="display:block;width:100%;height:auto;border:0;" />`;

export type EmailKind = "launch" | "halfway" | "last_chance" | "arrived" | "nm_launch" | "nm_halfway" | "nm_last_chance";
export type Audience = "member" | "non_member";

export const EMAIL_META: Record<EmailKind, { key: string; subject: string }> = {
  launch: { key: "body_roller_presale_launch", subject: "Something new is coming to Storm Wellness Club" },
  halfway: { key: "body_roller_presale_halfway", subject: "The part of training no one schedules" },
  last_chance: { key: "body_roller_presale_last_chance", subject: "Member presale pricing closes soon" },
  arrived: { key: "body_roller_presale_arrived", subject: "The Lymphatic Body Roller is here" },
  nm_launch: { key: "body_roller_presale_nm_launch", subject: "Something new is coming to Storm Wellness Club" },
  nm_halfway: { key: "body_roller_presale_nm_halfway", subject: "The part of training no one schedules" },
  nm_last_chance: { key: "body_roller_presale_nm_last_chance", subject: "Presale pricing closes soon" },
};

const C = { maroon: "#4A1A1F", wine: "#6B2A31", espresso: "#1A110D", bark: "#2A1C16", gold: "#C6A267", goldSoft: "#E7D3A8", cream: "#F6F1E8", sand: "#EDE3D2", ink: "#2A1E18", muted: "#8A7566" };
const SERIF = "Didot,'Bodoni 72','Playfair Display',Georgia,serif";
const SANS = "'Helvetica Neue',Helvetica,Arial,sans-serif";
const $ = (c: number) => `$${(c / 100).toFixed(0)}`;
let AUD: Audience = "member";
const opts = (d: 30 | 60) => Object.values(PRESALE_OPTIONS).filter((o) => o.audience === AUD && o.duration === d);
const opt = (k: string) => PRESALE_OPTIONS[(AUD === "non_member" ? "nm_" : "") + k];

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

export const JOURNAL_URL = `${SITE}/journal/lymphatic-body-roller`;

function shell(bg: string, inner: string, footerDark = true) {
  const fbg = footerDark ? C.espresso : C.sand, fc = footerDark ? "#8F7C70" : C.muted;
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="color-scheme" content="light only"/></head>
<body style="margin:0;padding:0;background:${C.espresso};">
<table width="100%" cellpadding="0" cellspacing="0" style="background:${C.espresso};"><tr><td align="center" style="padding:24px 10px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${bg};">
  <tr><td style="padding:26px 30px;background:${C.espresso};border-bottom:1px solid #3A2A22;text-align:center;">
    <p style="margin:0;font-family:${SERIF};font-size:15px;letter-spacing:7px;color:${C.cream};">STORM WELLNESS CLUB</p>
    <p style="margin:6px 0 0;font-family:${SANS};font-size:9px;letter-spacing:4px;color:${C.gold};">LIVONIA &middot; MICHIGAN</p>
  </td></tr>
  ${inner}
  <tr><td style="background:${fbg};padding:30px 40px;text-align:center;font-family:${SANS};font-size:11px;line-height:1.8;color:${fc};">
    Storm Wellness Club &middot; Livonia, Michigan<br/>Questions? Simply reply to this email.<br/>
    <a href="${SITE}" style="color:${C.gold};text-decoration:none;letter-spacing:2px;">STORMWELLNESSCLUB.COM</a>
  </td></tr>
</table></td></tr></table></body></html>`;
}

const fine = (endsLabel: string, color: string) => `<p style="margin:22px 0 0;text-align:center;font-family:${SANS};font-size:11px;line-height:1.8;color:${color};">
  ${AUD === "member" ? "Member presale pricing" : "Presale pricing"} &middot; Presale ends ${endsLabel} &middot; Sessions expire 6 months after purchase<br/>
  <em style="font-family:${SERIF};font-size:13px;">Expected in early November. Arrival date may shift.</em></p>`;

const p = (html: string, color: string) => `<p style="margin:0 0 18px;font-family:${SERIF};font-size:17px;line-height:1.85;color:${color};">${html}</p>`;
const readMore = (color: string) => `<p style="margin:26px 0 0;text-align:center;font-family:${SANS};font-size:11px;letter-spacing:3px;"><a href="${JOURNAL_URL}" style="color:${color};text-decoration:none;border-bottom:1px solid ${color};padding-bottom:2px;">READ ABOUT THE RITUAL</a></p>`;
const benefit = (title: string, body: string, fg: string, sub: string, line: string) => `<tr><td style="padding:22px 0;border-top:1px solid ${line};">
  <p style="margin:0 0 6px;font-family:${SERIF};font-size:21px;color:${fg};">${title}</p>
  <p style="margin:0;font-family:${SANS};font-size:13px;line-height:1.8;color:${sub};">${body}</p></td></tr>`;

export function buildPresaleEmail(rawKind: EmailKind, firstName: string | null, endsLabel: string): string {
  AUD = rawKind.startsWith("nm_") ? "non_member" : "member";
  const nm = AUD === "non_member";
  const kind = rawKind.replace(/^nm_/, "") as EmailKind;
  const name = firstName || (nm ? "Hello" : "Dear member");
  const greet = firstName ? `${firstName},` : `${name},`;
  const priceWord = nm ? "presale" : "member presale";

  if (kind === "launch") return shell(C.espresso, `
  <tr><td>${loop("The Lymphatic Body Roller in motion")}</td></tr>
  <tr><td style="padding:54px 46px 8px;">
    ${eyebrow(nm ? "Arriving this November" : "For members first")}
    <h1 style="margin:0 0 28px;font-family:${SERIF};font-weight:normal;font-size:42px;line-height:1.15;color:${C.cream};">Lie back.<br/>Let the body <em style="color:${C.gold};">let go.</em></h1>
    ${p(greet, "#D9CBBB")}
    ${p(`This November, Storm Wellness Club welcomes the Lymphatic Body Roller. Rows of warm, turned wood move beneath you in a slow, steady wave, from the ankles upward, while red light glows softly underneath.`, "#D9CBBB")}
    ${p(`It does what the lymphatic system can't do for itself. With no pump of its own, lymph depends on movement. The rhythm of the rollers guides fluid toward the body's natural drainage points at the knees, hips and underarms.`, "#D9CBBB")}
    ${p(`Most people feel it first in their legs. They feel lighter and less swollen, as if they've finally set something down.`, "#D9CBBB")}
  </td></tr>
  <tr><td style="padding:10px 46px 0;"><table width="100%" cellpadding="0" cellspacing="0">
    ${benefit("Less puffiness", "Rhythmic compression helps release trapped fluid and the bloated feeling that settles into the legs, arms and midsection.", C.cream, "#A8968A", "#3A2A22")}
    ${benefit("Lymph in motion", "A gentle mechanical stimulus that supports the body's own drainage, so it can clear what it no longer needs.", C.cream, "#A8968A", "#3A2A22")}
  </table></td></tr>
  <tr><td style="padding:46px 30px 50px;background:${C.bark};">
    <p style="margin:0 0 8px;text-align:center;font-family:${SERIF};font-size:28px;color:${C.cream};">Reserve before it arrives</p>
    <p style="margin:0 0 30px;text-align:center;font-family:${SERIF};font-style:italic;font-size:15px;color:${C.goldSoft};">${nm ? "Presale pricing, held only until launch." : "Presale pricing, for members only."}</p>
    ${priceMenu(true)}
    ${btn("RESERVE MY SESSIONS", PRESALE_URL)}
    ${fine(endsLabel, "#8F7C70")}
    ${readMore(C.goldSoft)}
  </td></tr>`);

  if (kind === "halfway") return shell(C.cream, `
  <tr><td>${loop("The Lymphatic Body Roller in motion")}</td></tr>
  <tr><td style="padding:54px 46px 8px;">
    ${eyebrow("On recovery", C.wine)}
    <h1 style="margin:0 0 28px;font-family:${SERIF};font-weight:normal;font-size:40px;line-height:1.15;color:${C.maroon};">The part of training<br/>no one <em style="color:${C.gold};">schedules.</em></h1>
    ${p(greet, C.ink)}
    ${p(`You plan the class, the reps and the miles. Recovery is usually whatever time is left over.`, C.ink)}
    ${p(`The Body Roller makes it a deliberate part of your week. The rolling works deep, like a long session on a foam roller, but you get to stay still. Tight fascia softens, sore legs loosen, and blood and lymph move more freely.`, C.ink)}
    ${p(`Many guests say they feel more energized afterward, not sleepy. Better circulation brings oxygen back to tired muscle.`, C.ink)}
  </td></tr>
  <tr><td style="padding:10px 46px 0;"><table width="100%" cellpadding="0" cellspacing="0">
    ${benefit("Muscle release", "Eases post-workout soreness and tension through slow, rhythmic pressure.", C.maroon, C.muted, "#E2D6C2")}
    ${benefit("Circulation &amp; energy", "Improved flow carries oxygen and nutrients to soft tissue, so you leave feeling restored, not drained.", C.maroon, C.muted, "#E2D6C2")}
  </table></td></tr>
  <tr><td style="padding:40px 46px 0;">
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.gold};"><tr><td style="padding:26px;text-align:center;">
      ${eyebrow("For a weekly ritual", C.wine)}
      <p style="margin:0;font-family:${SERIF};font-size:26px;color:${C.maroon};">The 60-Minute 10-Pack</p>
      <p style="margin:10px 0 0;font-family:${SANS};font-size:14px;color:${C.muted};"><span style="text-decoration:line-through;">${$(opt("60_10pack").regular_cents)}</span> &nbsp;<strong style="font-family:${SERIF};font-size:26px;color:${C.ink};font-weight:normal;">${$(opt("60_10pack").cents)}</strong> &nbsp;&middot;&nbsp; ${$(opt("60_10pack").cents / 10)} a session</p>
    </td></tr></table>
  </td></tr>
  <tr><td style="padding:40px 30px 50px;">
    <p style="margin:0 0 26px;text-align:center;font-family:${SERIF};font-style:italic;font-size:15px;color:${C.muted};">${priceWord[0].toUpperCase() + priceWord.slice(1)} pricing holds until ${endsLabel}.</p>
    ${priceMenu(false)}${btn("HOLD MY PRESALE PRICE", PRESALE_URL, C.maroon, C.cream)}${fine(endsLabel, C.muted)}${readMore(C.wine)}
  </td></tr>`, false);

  if (kind === "last_chance") return shell(C.espresso, `
  <tr><td style="background:${C.wine};padding:14px;text-align:center;font-family:${SANS};font-size:11px;letter-spacing:5px;color:${C.goldSoft};">PRESALE CLOSES ${endsLabel.toUpperCase()}</td></tr>
  <tr><td style="padding:56px 46px 8px;">
    ${eyebrow("The final days")}
    <h1 style="margin:0 0 28px;font-family:${SERIF};font-weight:normal;font-size:40px;line-height:1.15;color:${C.cream};">Smoother skin,<br/>a firmer <em style="color:${C.gold};">silhouette.</em></h1>
    ${p(greet, "#D9CBBB")}
    ${p(`Regular sessions do more than relax you. Steady rolling and better circulation can soften the look of cellulite and help skin look and feel firmer. Combined with how you already train and eat, it supports your body-shaping goals.`, "#D9CBBB")}
    ${p(`The red light underneath adds gentle warmth that reaches deeper into the tissue, so the whole session feels comforting from start to finish.`, "#D9CBBB")}
    ${p(`After ${endsLabel}, ${priceWord} pricing ends and the machine goes to regular rates.`, "#D9CBBB")}
  </td></tr>
  <tr><td style="padding:16px 30px 0;">${loop("The Lymphatic Body Roller in motion")}</td></tr>
  <tr><td style="padding:46px 30px 0;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      ${[["30_single", "30-min single"], ["30_5pack", "30-min 5-pack"], ["60_10pack", "60-min 10-pack"]].map(([k, c]) => `<td width="33%" style="padding:0 5px;"><table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #3A2A22;"><tr><td style="padding:20px 6px;text-align:center;">
        <p style="margin:0;font-family:${SERIF};font-size:30px;color:${C.gold};">${$(opt(k).cents)}</p>
        <p style="margin:4px 0 0;font-family:${SANS};font-size:11px;color:#8F7C70;text-decoration:line-through;">${$(opt(k).regular_cents)}</p>
        <p style="margin:8px 0 0;font-family:${SANS};font-size:10px;letter-spacing:2px;color:${C.cream};text-transform:uppercase;">${c}</p></td></tr></table></td>`).join("")}
    </tr></table>
  </td></tr>
  <tr><td style="padding:44px 30px 50px;">
    <p style="margin:0 0 26px;text-align:center;font-family:${SERIF};font-style:italic;font-size:16px;color:${C.goldSoft};">Every option, while the presale lasts</p>
    ${priceMenu(true)}${btn("RESERVE BEFORE IT CLOSES", PRESALE_URL)}${fine(endsLabel, "#8F7C70")}${readMore(C.goldSoft)}
  </td></tr>`);

  // arrived (buyers only)
  return shell(C.cream, `
  <tr><td>${loop("The Lymphatic Body Roller has arrived")}</td></tr>
  <tr><td style="padding:54px 46px 8px;">
    ${eyebrow("Now in the club", C.wine)}
    <h1 style="margin:0 0 28px;font-family:${SERIF};font-weight:normal;font-size:42px;line-height:1.15;color:${C.maroon};">Your first session<br/>is <em style="color:${C.gold};">waiting.</em></h1>
    ${p(greet, C.ink)}
    ${p(`Thank you for reserving early. The Lymphatic Body Roller, with built-in red light, is now at Storm Wellness Club, and the sessions you reserved are already in your account.`, C.ink)}
  </td></tr>
  <tr><td style="padding:10px 46px 0;">
    <table width="100%" cellpadding="0" cellspacing="0">${[
      ["01", "Book", "Choose a time from your account. Your reserved sessions apply automatically."],
      ["02", "Prepare", "Drink water through the day, wear something light and comfortable, and arrive a few minutes early."],
      ["03", "Roll", "Lie back and breathe slowly. Afterward, keep drinking water and take a short walk to keep things moving."],
    ].map(([n, t, d]) => `<tr><td valign="top" width="70" style="padding:16px 0;border-top:1px solid #E2D6C2;font-family:${SERIF};font-size:32px;color:${C.gold};">${n}</td>
      <td style="padding:16px 0;border-top:1px solid #E2D6C2;"><p style="margin:0;font-family:${SERIF};font-size:20px;color:${C.maroon};">${t}</p>
      <p style="margin:4px 0 0;font-family:${SANS};font-size:13px;line-height:1.7;color:${C.muted};">${d}</p></td></tr>`).join("")}</table>
  </td></tr>
  <tr><td style="padding:10px 40px 50px;">${btn("BOOK MY FIRST SESSION", nm ? `${SITE}/portal` : `${SITE}/member/book`, C.maroon, C.cream)}
    <p style="margin:20px 0 0;text-align:center;font-family:${SANS};font-size:11px;color:${C.muted};">Reserved sessions expire 6 months after purchase.</p>${readMore(C.wine)}</td></tr>`, false);
}
