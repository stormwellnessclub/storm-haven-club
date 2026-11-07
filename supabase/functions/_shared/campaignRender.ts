// Campaign Studio email renderer: brand-locked blocks -> email-safe HTML.
// Colors, fonts and sign-off are fixed here so every campaign matches the Storm brand.

export type Block =
  | { type: "eyebrow"; text: string }
  | { type: "heading"; text: string }
  | { type: "text"; text: string }
  | { type: "image"; url: string; alt?: string }
  | { type: "cover"; url: string; title?: string; author?: string }
  // Event photo: large for invitations, thumbnail for confirmations, none = logo-only.
  | { type: "event_photo"; eventId?: string; url?: string | null; alt?: string; size?: "large" | "thumbnail" | "none"; position?: "top" | "center" | "bottom" }
  | { type: "button"; label: string; url: string }
  | { type: "details"; items: { label: string; value: string }[] }
  | { type: "divider" }
  | { type: "signature" };

export const BRAND = {
  bg: "#1E0A0F", footer: "#140609", cream: "#FBF7F2", gold: "#C5A880", muted: "#B9A79A",
};

const esc = (s: unknown) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const safeUrl = (u: unknown) => /^https:\/\//i.test(String(u ?? "")) ? esc(u) : "";

function block(b: Block, firstName: string | null): string {
  switch (b.type) {
    case "eyebrow":
      return `<p style="color:${BRAND.gold};font-family:Arial,sans-serif;letter-spacing:3px;font-size:11px;margin:0 0 10px;text-transform:uppercase;">${esc(b.text)}</p>`;
    case "heading":
      return `<h1 style="font-weight:400;margin:0 0 22px;font-size:30px;line-height:1.2;color:${BRAND.cream};">${esc(b.text)}</h1>`;
    case "text":
      return String(b.text ?? "").split(/\n\s*\n/).filter((p) => p.trim())
        .map((p) => `<p style="margin:0 0 16px;">${esc(p.trim().replace(/\{first_name\}/g, firstName || "there"))}</p>`).join("");
    case "image": {
      const u = safeUrl(b.url); if (!u) return "";
      return `<img src="${u}" alt="${esc(b.alt)}" width="532" style="display:block;width:100%;height:auto;border:0;margin:0 0 22px;border-radius:3px;" />`;
    }
    case "event_photo": {
      const u = safeUrl(b.url); if (!u || b.size === "none") return "";
      const pos = ["top", "center", "bottom"].includes(String(b.position)) ? b.position : "center";
      if (b.size === "thumbnail")
        return `<img src="${u}" alt="${esc(b.alt)}" width="140" height="94" style="display:block;width:140px;height:94px;object-fit:cover;object-position:${pos};border:0;margin:0 0 20px;border-radius:3px;" />`;
      return `<img src="${u}" alt="${esc(b.alt)}" width="532" style="display:block;width:100%;height:auto;max-height:340px;object-fit:cover;object-position:${pos};border:0;margin:0 0 22px;border-radius:3px;" />`;
    }
    case "cover": {
      const u = safeUrl(b.url); if (!u) return "";
      return `<div style="text-align:center;margin:0 0 26px;"><img src="${u}" alt="${esc(b.title)}" width="180" style="display:inline-block;width:180px;max-width:60%;height:auto;border:0;border-radius:3px;box-shadow:0 6px 18px rgba(0,0,0,.45);" />${b.title ? `<p style="margin:12px 0 0;font-size:18px;color:${BRAND.cream};">${esc(b.title)}</p>` : ""}${b.author ? `<p style="margin:2px 0 0;font-family:Arial,sans-serif;font-size:12px;letter-spacing:2px;color:${BRAND.gold};">${esc(b.author).toUpperCase()}</p>` : ""}</div>`;
    }
    case "button": {
      const u = safeUrl(b.url); if (!u || !b.label) return "";
      return `<div style="text-align:center;margin:28px 0 32px;"><a href="${u}" style="display:inline-block;background:${BRAND.gold};color:${BRAND.bg};padding:15px 34px;text-decoration:none;border-radius:4px;font-family:Arial,sans-serif;font-weight:600;letter-spacing:.5px;">${esc(b.label)}</a></div>`;
    }
    case "details":
      return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;border-top:1px solid #3a2128;">${(b.items ?? []).map((i) =>
        `<tr><td style="padding:10px 0;border-bottom:1px solid #3a2128;font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;color:${BRAND.gold};text-transform:uppercase;width:38%;">${esc(i.label)}</td><td style="padding:10px 0;border-bottom:1px solid #3a2128;color:${BRAND.cream};">${esc(i.value)}</td></tr>`).join("")}</table>`;
    case "divider":
      return `<div style="height:1px;background:#3a2128;margin:24px 0;"></div>`;
    case "signature":
      return `<p style="margin:8px 0 30px;">With warmth,<br/>The Storm Wellness Club Team</p>`;
    default:
      return "";
  }
}

export function renderCampaignHtml(blocks: Block[], opts: { firstName?: string | null; preheader?: string } = {}): string {
  const first = opts.firstName ?? null;
  const body = (Array.isArray(blocks) ? blocks : []).map((b) => block(b, first)).join("\n");
  const pre = opts.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(opts.preheader)}</div>` : "";
  return `<html><body style="margin:0;background:#ffffff;">${pre}
<div style="font-family:Georgia,'Times New Roman',serif;max-width:600px;margin:0 auto;background:${BRAND.bg};">
  <div style="padding:22px 34px;text-align:center;border-bottom:1px solid #3a2128;font-family:Arial,sans-serif;letter-spacing:4px;font-size:12px;color:${BRAND.gold};">STORM WELLNESS CLUB</div>
  <div style="padding:34px 34px 6px;color:${BRAND.cream};line-height:1.75;font-size:16px;">${body}</div>
  <div style="background:${BRAND.footer};padding:22px;text-align:center;color:${BRAND.gold};font-size:13px;font-family:Arial,sans-serif;">
    Built with intention. Guided by science.<br/>Questions? <a href="mailto:admin@stormwellnessclub.com" style="color:${BRAND.gold};">admin@stormwellnessclub.com</a>
  </div>
</div></body></html>`;
}

// Words and patterns the brand never uses in marketing.
export const BANNED = [
  "free", "buy tickets", "sanctuary", "your body called", "you deserve this", "unleash your potential",
];
export function brandIssues(text: string): string[] {
  const t = String(text || "").toLowerCase();
  const out: string[] = [];
  for (const w of BANNED) if (new RegExp(`\\b${w.replace(/ /g, "\\s+")}\\b`).test(t)) out.push(`Uses "${w}"`);
  if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(text)) out.push("Contains emojis");
  if (/!{2,}/.test(text)) out.push("Multiple exclamation points");
  if (/\bbook club\b/.test(t)) out.push('Says "book club" (use Higher Self Society)');
  return out;
}

export function blocksText(blocks: Block[]): string {
  return (blocks ?? []).map((b: any) => [b.text, b.label, b.title, ...(b.items ?? []).map((i: any) => `${i.label} ${i.value}`)].filter(Boolean).join(" ")).join("\n");
}
